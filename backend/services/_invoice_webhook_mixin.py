"""
PaymentService mixin — Gestion des webhooks de factures Stripe.
Handlers: invoice.payment_succeeded, invoice.payment_failed
"""
import asyncio
import logging
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from typing import Dict

from email_service import send_payment_confirmation_email, send_payment_failed_email

logger = logging.getLogger(__name__)


class InvoiceWebhookMixin:

    async def _handle_payment_succeeded(self, invoice: Dict) -> Dict:
        """
        Handle successful payment.
        Updates subscription status and period end date.
        """
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')

        if not customer_id:
            logger.warning("Payment succeeded but no customer_id")
            return {"status": "skipped", "reason": "no_customer"}

        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            logger.warning(f"Payment succeeded but customer {customer_id} not found in DB")
            return {"status": "skipped", "reason": "customer_not_found"}

        # Calculate new period end (1 month from now)
        period_end = datetime.now(timezone.utc) + timedelta(days=30)

        # Update subscription in database
        update_data = {
            "status": "active",
            "current_period_end": period_end.isoformat(),
            "last_payment_date": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # 🔴 RÈGLE ABSOLUE: Utiliser stripe_subscription_id si disponible, jamais user_id pour upsert
        if subscription_id:
            update_data["stripe_subscription_id"] = subscription_id
            await self.subscription_repo.upsert_by_stripe_subscription(subscription_id, update_data)
        else:
            # ⚠️ Pas de stripe_subscription_id: update simple (pas d'upsert) par user_id
            # Ce cas ne devrait pas arriver en production normale
            logger.warning(
                f"⚠️ Payment succeeded but no subscription_id for customer {customer_id}. "
                f"Using fallback update by user_id. "
                f"workspace_id: {gerant.get('workspace_id')}, "
                f"gerant_id: {gerant['id']}"
            )
            await self.subscription_repo.update_by_user(gerant["id"], update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(
                gerant["workspace_id"],
                {"subscription_status": "active", "stripe_subscription_id": subscription_id},
            )
        logger.info(f"✅ Payment succeeded for {gerant['email']} - subscription active until {period_end}")

        # Record payment transaction
        try:
            transaction = {
                "id": str(_uuid.uuid4()),
                "gerant_id": gerant["id"],
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "stripe_invoice_id": invoice.get("id"),
                "amount_eur": invoice.get("amount_paid", invoice.get("amount_due", 0)) / 100,
                "currency": invoice.get("currency", "eur"),
                "status": "succeeded",
                "billing_reason": invoice.get("billing_reason", "subscription_cycle"),
                "invoice_url": invoice.get("hosted_invoice_url"),
                "period_end": period_end.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await self.payment_transaction_repo.insert_one(transaction)
            logger.info(f"💳 Payment transaction recorded for {gerant['email']}")
        except Exception as e:
            logger.error(f"Failed to record payment transaction: {e}")

        # Send payment confirmation email
        try:
            # Fetch plan from subscription record
            plan_key = 'starter'
            if subscription_id:
                sub_record = await self.subscription_repo.find_by_stripe_subscription(subscription_id)
                if sub_record:
                    plan_key = sub_record.get('plan', 'starter')
            amount_eur = invoice.get('amount_paid', invoice.get('amount_due', 0)) / 100
            billing_reason = invoice.get('billing_reason', 'subscription_cycle')
            invoice_url = invoice.get('hosted_invoice_url')
            # Fire-and-forget: email envoyé en background pour ne pas bloquer le webhook
            _email, _name, _eur, _period, _plan, _reason, _url = (
                gerant['email'], gerant.get('name', gerant['email']),
                amount_eur, period_end.isoformat(), plan_key, billing_reason, invoice_url,
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_payment_confirmation_email(
                    recipient_email=_email, recipient_name=_name,
                    amount_eur=_eur, period_end_date=_period,
                    plan_key=_plan, billing_reason=_reason, invoice_url=_url,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email to {gerant['email']}: {e}")

        return {"status": "success", "user_id": gerant['id'], "period_end": period_end.isoformat()}

    async def _handle_payment_failed(self, invoice: Dict) -> Dict:
        """
        Handle failed payment.

        Actions:
        - Updates subscription status to 'past_due'
        - Updates workspace status
        - Records payment failure details for debugging
        - (Future: Send notification email to customer)

        Note: Stripe will automatically retry payments according to your
        Billing settings. This handler just tracks the state in our DB.
        """
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')

        if not customer_id:
            logger.warning("Payment failed event received without customer_id")
            return {"status": "skipped", "reason": "no_customer"}

        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            logger.warning(f"Payment failed for unknown customer: {customer_id}")
            return {"status": "skipped", "reason": "customer_not_found"}

        # Extract failure details from invoice
        attempt_count = invoice.get('attempt_count', 1)
        amount_due = invoice.get('amount_due', 0) / 100  # Convert cents to euros
        next_payment_attempt = invoice.get('next_payment_attempt')

        # Update subscription status to past_due
        update_data = {
            "status": "past_due",
            "last_payment_failed_at": datetime.now(timezone.utc).isoformat(),
            "payment_failure_count": attempt_count,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        if next_payment_attempt:
            update_data["next_payment_retry"] = datetime.fromtimestamp(
                next_payment_attempt, tz=timezone.utc
            ).isoformat()

        # 🔴 INTERDIT: Ne jamais upsert par user_id
        # Cette fonction est pour invoice.payment_failed, pas pour subscription webhooks
        # On fait un update simple (pas d'upsert) car on n'a pas de stripe_subscription_id ici
        logger.warning(
            f"⚠️ Payment failed - using fallback update by user_id. "
            f"workspace_id: {gerant.get('workspace_id')}, "
            f"gerant_id: {gerant['id']}, "
            f"subscription_id: {subscription_id or 'N/A'}"
        )
        await self.subscription_repo.update_by_user(gerant["id"], update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(gerant["workspace_id"], {"subscription_status": "past_due"})

        # Log detailed failure info
        logger.warning(
            f"⚠️ Payment FAILED for {gerant['email']} - "
            f"Amount: {amount_due}€, Attempt #{attempt_count}, "
            f"Subscription: {subscription_id}, Status: past_due"
        )

        # Send payment failed email
        try:
            next_retry_iso = None
            if next_payment_attempt:
                next_retry_iso = datetime.fromtimestamp(next_payment_attempt, tz=timezone.utc).isoformat()
            _email, _name, _eur, _attempts, _retry = (
                gerant['email'], gerant.get('name', gerant['email']),
                amount_due, attempt_count, next_retry_iso,
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_payment_failed_email(
                    recipient_email=_email, recipient_name=_name,
                    amount_eur=_eur, attempt_count=_attempts, next_retry_date=_retry,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send payment failed email to {gerant['email']}: {e}")

        return {
            "status": "success",
            "user_id": gerant['id'],
            "new_status": "past_due",
            "amount_due": amount_due,
            "attempt_count": attempt_count
        }
