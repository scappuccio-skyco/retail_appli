"""
Subscription lifecycle routes: switch-interval, cancel, reactivate
"""
from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, Optional
import stripe
import logging

from core.constants import ERR_CONFIG_STRIPE_MANQUANTE
from core.exceptions import (
    AppException, NotFoundError, ValidationError,
    BusinessLogicError, ConflictError,
)
from core.security import get_current_gerant
from core.config import settings
from services.gerant_service import GerantService
from services.stripe_client import StripeClient
from api.dependencies import get_gerant_service, get_stripe_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


# ==========================================
# BILLING INTERVAL SWITCH
# ==========================================

class SwitchIntervalRequest(BaseModel):
    """Request body for switching billing interval"""
    interval: str  # 'month' ou 'year'


class SwitchIntervalResponse(BaseModel):
    """Response for interval switch"""
    success: bool
    message: str
    previous_interval: str
    new_interval: str
    new_monthly_cost: float
    new_yearly_cost: float
    proration_amount: float
    next_billing_date: str


@router.post("/subscription/switch-interval", response_model=SwitchIntervalResponse)
async def switch_billing_interval(
    request: SwitchIntervalRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
):
    """
    Switch billing interval between monthly and yearly.

    IMPORTANT RULES:
    - Monthly → Yearly: ALLOWED (upsell with 20% discount)
    - Yearly → Monthly: NOT ALLOWED (must cancel and re-subscribe)

    This endpoint:
    1. Validates the requested change
    2. Calls Stripe API to modify the subscription
    3. Updates local database
    4. Returns the new billing details
    """
    try:
        gerant_id = current_user['id']
        new_interval = request.interval

        # Validate interval
        if new_interval not in ['month', 'year']:
            raise ValidationError("Intervalle invalide. Utilisez 'month' ou 'year'.")

        subscription = await gerant_service.get_subscription_by_user_and_status(
            gerant_id, ["active", "trialing"]
        )

        if not subscription:
            raise NotFoundError("Aucun abonnement actif trouvé")

        current_interval = subscription.get('billing_interval', 'month')
        current_seats = subscription.get('seats', 1)
        is_trial = subscription.get('status') == 'trialing'

        # Check if already on requested interval
        if current_interval == new_interval:
            raise ValidationError(
                f"Vous êtes déjà sur un abonnement {'annuel' if new_interval == 'year' else 'mensuel'}."
            )

        # Block downgrade from annual to monthly
        if current_interval == 'year' and new_interval == 'month':
            raise ValidationError(
                "Impossible de passer de l'annuel au mensuel. Pour changer, veuillez annuler votre abonnement actuel puis en souscrire un nouveau."
            )

        # Get Stripe IDs
        stripe_subscription_id = subscription.get('stripe_subscription_id')
        stripe_subscription_item_id = subscription.get('stripe_subscription_item_id')

        monthly_cost = 0.0
        yearly_cost = 0.0
        proration_amount = 0.0
        next_billing_date = ""

        if is_trial:
            await gerant_service.update_subscription_by_user(
                gerant_id,
                {
                    "billing_interval": new_interval,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            )

            next_billing_date = subscription.get('trial_end', '')

            logger.info(f"Trial user {current_user['email']} switched to {new_interval} (no Stripe call)")

        elif stripe_subscription_id and stripe_subscription_item_id:
            # Active subscriber - call Stripe API
            if not settings.STRIPE_API_KEY:
                raise ValidationError(ERR_CONFIG_STRIPE_MANQUANTE)

            try:
                # Get new price ID based on interval (using new simplified structure)
                new_price_id = settings.STRIPE_PRICE_ID_YEARLY if new_interval == 'year' else settings.STRIPE_PRICE_ID_MONTHLY

                # CRITICAL: Modify subscription with new price
                updated_subscription = stripe_client.modify_subscription(
                    stripe_subscription_id,
                    items=[{
                        'id': stripe_subscription_item_id,
                        'price': new_price_id,
                        'quantity': current_seats,
                    }],
                    proration_behavior='create_prorations',
                    payment_behavior='allow_incomplete',
                )

                logger.info(f"Stripe subscription {stripe_subscription_id} switched to {new_interval}")

                # Get proration from Stripe API only (no server-side calculation)
                proration_amount = 0.0
                try:
                    upcoming = stripe_client.upcoming_invoice(stripe_subscription_id)
                    proration_amount = upcoming.get('amount_due', 0) / 100
                except Exception as e:
                    logger.warning(f"Could not get proration: {e}")

                # Get costs from Stripe subscription (for display only)
                if updated_subscription['items']['data']:
                    price_obj = updated_subscription['items']['data'][0]['price']
                    unit_amount = price_obj.get('unit_amount', 0) / 100  # Convert cents to euros
                    quantity = updated_subscription['items']['data'][0]['quantity']

                    if new_interval == 'year':
                        yearly_cost = unit_amount * quantity
                        monthly_cost = yearly_cost / 12
                    else:
                        monthly_cost = unit_amount * quantity
                        yearly_cost = monthly_cost * 12 * 0.8  # Estimated 20% discount

                # Get next billing date
                if updated_subscription.current_period_end:
                    next_billing_date = datetime.fromtimestamp(
                        updated_subscription.current_period_end,
                        tz=timezone.utc
                    ).isoformat()

            except stripe.StripeError as e:
                logger.error(f"Stripe error: {str(e)}")
                raise ValidationError(f"Erreur Stripe: {str(e)}")

            # Update local database
            update_data = {
                "billing_interval": new_interval,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if next_billing_date:
                update_data["current_period_end"] = next_billing_date

            await gerant_service.update_subscription_by_user(gerant_id, update_data)

            workspace_id = current_user.get('workspace_id')
            if workspace_id:
                await gerant_service.update_workspace_one(
                    workspace_id,
                    {"billing_interval": new_interval, "updated_at": datetime.now(timezone.utc).isoformat()}
                )

        else:
            raise ValidationError("Impossible de modifier l'abonnement. Données Stripe manquantes.")

        interval_label = "annuel" if new_interval == 'year' else "mensuel"

        message = f"Passage à l'abonnement {interval_label} réussi !"
        if new_interval == 'year':
            message += " Vous bénéficiez d'une réduction avec l'abonnement annuel."

        logger.info(f"{current_user['email']} switched from {current_interval} to {new_interval}")

        return SwitchIntervalResponse(
            success=True,
            message=message,
            previous_interval=current_interval,
            new_interval=new_interval,
            new_monthly_cost=monthly_cost,
            new_yearly_cost=yearly_cost,
            proration_amount=proration_amount,
            next_billing_date=next_billing_date
        )
    except Exception:
        raise


# ==========================================
# CANCEL
# ==========================================

class CancelSubscriptionRequest(BaseModel):
    """Request body for canceling subscription"""
    cancel_immediately: bool = False  # True = annule maintenant, False = à la fin de période
    stripe_subscription_id: Optional[str] = None  # Support mode: explicitly target a subscription
    support_mode: bool = False  # If True, allow auto-selection even with multiples


class CancelSubscriptionResponse(BaseModel):
    """Response for subscription cancellation"""
    success: bool
    message: str
    canceled_at: Optional[str] = None
    cancel_at_period_end: bool
    period_end: Optional[str] = None


@router.post("/subscription/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
):
    """
    Annule l'abonnement actif du gérant.

    Options:
    - cancel_immediately=True: Annule immédiatement (remboursement prorata possible)
    - cancel_immediately=False: Annule à la fin de la période (pas de remboursement, accès jusqu'à la fin)

    Returns:
        Dict avec statut de l'annulation et date de fin d'accès
    """
    try:
        gerant_id = current_user['id']
        cancel_immediately = request.cancel_immediately

        active_subscriptions = await gerant_service.get_active_subscriptions_for_gerant(
            gerant_id, limit=10
        )

        if not active_subscriptions:
            raise NotFoundError("Aucun abonnement actif trouvé")

        # If multiple active subscriptions, handle according to mode
        if len(active_subscriptions) > 1:
            # Support mode: allow explicit targeting or auto-selection
            if request.support_mode or request.stripe_subscription_id:
                if request.stripe_subscription_id:
                    # Explicitly target the specified subscription
                    subscription = next(
                        (s for s in active_subscriptions if s.get('stripe_subscription_id') == request.stripe_subscription_id),
                        None
                    )
                    if not subscription:
                        raise NotFoundError(f"Abonnement {request.stripe_subscription_id} non trouvé parmi les abonnements actifs")
                else:
                    # Auto-select most recent (support mode)
                    subscription = max(
                        active_subscriptions,
                        key=lambda s: (
                            s.get('current_period_end', '') or s.get('created_at', ''),
                            s.get('status') == 'active'  # Prefer active over trialing
                        )
                    )
                    logger.warning(
                        f"MULTIPLE ACTIVE SUBSCRIPTIONS for {current_user['email']}: {len(active_subscriptions)}. "
                        f"Support mode: auto-selected {subscription.get('stripe_subscription_id')}"
                    )
            else:
                # DEFAULT: Return 409 with list (production-safe)
                active_list = [
                    {
                        "stripe_subscription_id": s.get('stripe_subscription_id'),
                        "status": s.get('status'),
                        "seats": s.get('seats'),
                        "billing_interval": s.get('billing_interval'),
                        "workspace_id": s.get('workspace_id'),
                        "price_id": s.get('price_id'),
                        "created_at": s.get('created_at'),
                        "current_period_end": s.get('current_period_end')
                    }
                    for s in active_subscriptions
                ]

                logger.warning(
                    f"MULTIPLE ACTIVE SUBSCRIPTIONS for {current_user['email']}: {len(active_subscriptions)}. "
                    f"Returning 409 - user must specify which to cancel."
                )

                raise ConflictError(
                    detail=f"{len(active_subscriptions)} abonnements actifs détectés. Veuillez spécifier lequel annuler en fournissant 'stripe_subscription_id', ou 'support_mode=true' pour la sélection automatique.",
                    error_code="MULTIPLE_ACTIVE_SUBSCRIPTIONS",
                )
        else:
            subscription = active_subscriptions[0]

        stripe_subscription_id = subscription.get('stripe_subscription_id')
        is_trial = subscription.get('status') == 'trialing'

        # For trial users, just update the database
        if is_trial:
            update_data = {
                "status": "canceled",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "cancel_at_period_end": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if stripe_subscription_id:
                await gerant_service.update_subscription_by_stripe_id(
                    stripe_subscription_id, update_data
                )
            else:
                await gerant_service.update_subscription_by_user(
                    gerant_id,
                    {**update_data, "status": "trialing"}
                )

            workspace_id = current_user.get('workspace_id')
            if workspace_id:
                await gerant_service.update_workspace_one(
                    workspace_id,
                    {"subscription_status": "canceled", "updated_at": datetime.now(timezone.utc).isoformat()}
                )

            logger.info(f"Trial subscription canceled for {current_user['email']}")

            return {
                "success": True,
                "message": "Abonnement d'essai annulé",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "cancel_at_period_end": False,
                "period_end": subscription.get('trial_end')
            }

        # For active subscribers, call Stripe API
        if not stripe_subscription_id:
            raise ValidationError("Impossible d'annuler: aucun abonnement Stripe associé")

        if not settings.STRIPE_API_KEY:
            raise BusinessLogicError("Configuration Stripe manquante")

        try:
            if cancel_immediately:
                # Cancel immediately - Stripe will handle proration/refund
                canceled_subscription = stripe_client.delete_subscription(stripe_subscription_id)

                await gerant_service.update_subscription_by_stripe_id(
                    stripe_subscription_id,
                    {
                        "status": "canceled",
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "cancel_at_period_end": False,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                )

                workspace_id = current_user.get('workspace_id')
                if workspace_id:
                    await gerant_service.update_workspace_one(
                        workspace_id,
                        {"subscription_status": "canceled", "updated_at": datetime.now(timezone.utc).isoformat()}
                    )

                logger.info(f"Subscription {stripe_subscription_id} canceled immediately for {current_user['email']}")

                return {
                    "success": True,
                    "message": "Abonnement annulé immédiatement. L'accès est terminé.",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "cancel_at_period_end": False,
                    "period_end": None
                }
            else:
                # Cancel at period end - keep access until end of billing period
                updated_subscription = stripe_client.modify_subscription(
                    stripe_subscription_id,
                    cancel_at_period_end=True,
                )

                # Get period end date
                period_end = None
                if updated_subscription.current_period_end:
                    period_end = datetime.fromtimestamp(
                        updated_subscription.current_period_end,
                        tz=timezone.utc
                    ).isoformat()

                await gerant_service.update_subscription_by_stripe_id(
                    stripe_subscription_id,
                    {
                        "cancel_at_period_end": True,
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                )

                logger.info(f"Subscription {stripe_subscription_id} scheduled for cancellation at period end for {current_user['email']}")

                period_end_str = period_end[:10] if period_end else "fin de période"

                return {
                    "success": True,
                    "message": f"Abonnement programmé pour annulation. Vous conservez l'accès jusqu'au {period_end_str}.",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "cancel_at_period_end": True,
                    "period_end": period_end
                }

        except stripe.InvalidRequestError as e:
            logger.error(f"Stripe error canceling subscription: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")

    except AppException:
        raise


# ==========================================
# REACTIVATE
# ==========================================

class ReactivateSubscriptionRequest(BaseModel):
    """Request body for reactivating subscription"""
    stripe_subscription_id: Optional[str] = None  # Optionnel, requis si abonnements multiples
    support_mode: bool = False  # Si True, permet la sélection automatique même avec multiples


class ReactivateSubscriptionResponse(BaseModel):
    """Response for subscription reactivation"""
    success: bool
    message: str
    subscription: Dict
    reactivated_at: str


@router.post("/subscription/reactivate", response_model=ReactivateSubscriptionResponse)
async def reactivate_subscription(
    request: ReactivateSubscriptionRequest = Body(...),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
):
    """
    Réactive un abonnement qui a été programmé pour annulation (cancel_at_period_end=True).

    Conditions:
    - L'abonnement doit avoir cancel_at_period_end=True
    - L'abonnement doit être actif (status='active' ou 'trialing')

    Comportement:
    1. Vérifie que l'abonnement est programmé pour annulation
    2. Appelle Stripe API pour réactiver (cancel_at_period_end=False)
    3. Met à jour la base de données MongoDB
    4. Retourne le nouveau statut

    Returns:
        Dict avec statut de la réactivation et détails de l'abonnement
    """
    try:
        gerant_id = current_user['id']

        active_subscriptions = await gerant_service.get_active_subscriptions_for_gerant(
            gerant_id, limit=10
        )

        if not active_subscriptions:
            raise NotFoundError("Aucun abonnement actif trouvé")

        # Filter subscriptions that are scheduled for cancellation
        scheduled_subscriptions = [
            s for s in active_subscriptions
            if s.get('cancel_at_period_end') is True
        ]

        if not scheduled_subscriptions:
            raise ValidationError(
                "Aucun abonnement programmé pour annulation trouvé. Seuls les abonnements avec cancel_at_period_end=True peuvent être réactivés."
            )

        # If multiple scheduled subscriptions, handle according to mode
        if len(scheduled_subscriptions) > 1:
            if request.support_mode or request.stripe_subscription_id:
                if request.stripe_subscription_id:
                    subscription = next(
                        (s for s in scheduled_subscriptions if s.get('stripe_subscription_id') == request.stripe_subscription_id),
                        None
                    )
                    if not subscription:
                        raise NotFoundError(f"Abonnement {request.stripe_subscription_id} non trouvé parmi les abonnements programmés pour annulation")
                else:
                    subscription = max(
                        scheduled_subscriptions,
                        key=lambda s: (
                            s.get('current_period_end', '') or s.get('created_at', ''),
                            s.get('status') == 'active'  # Prefer active over trialing
                        )
                    )
                    logger.warning(
                        f"MULTIPLE SCHEDULED SUBSCRIPTIONS for {current_user['email']}: {len(scheduled_subscriptions)}. "
                        f"Support mode: auto-selected {subscription.get('stripe_subscription_id')}"
                    )
            else:
                scheduled_list = [
                    {
                        "stripe_subscription_id": s.get('stripe_subscription_id'),
                        "status": s.get('status'),
                        "seats": s.get('seats'),
                        "billing_interval": s.get('billing_interval'),
                        "current_period_end": s.get('current_period_end')
                    }
                    for s in scheduled_subscriptions
                ]

                logger.warning(
                    f"MULTIPLE SCHEDULED SUBSCRIPTIONS for {current_user['email']}: {len(scheduled_subscriptions)}. "
                    f"Returning 409 - user must specify which to reactivate."
                )

                raise ConflictError(
                    detail=f"{len(scheduled_subscriptions)} abonnement(s) programmé(s) pour annulation détecté(s). Veuillez spécifier lequel réactiver en fournissant 'stripe_subscription_id', ou 'support_mode=true' pour la sélection automatique.",
                    error_code="MULTIPLE_SCHEDULED_SUBSCRIPTIONS",
                )
        else:
            subscription = scheduled_subscriptions[0]

        stripe_subscription_id = subscription.get('stripe_subscription_id')
        is_trial = subscription.get('status') == 'trialing'

        if is_trial:
            update_data = {
                "cancel_at_period_end": False,
                "canceled_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if stripe_subscription_id:
                await gerant_service.update_subscription_by_stripe_id(
                    stripe_subscription_id, update_data
                )
                updated_subscription = await gerant_service.get_subscription_by_stripe_id(stripe_subscription_id)
            else:
                await gerant_service.update_subscription_by_user(
                    gerant_id,
                    {**update_data, "status": "trialing"}
                )
                updated_subscription = await gerant_service.get_subscription_by_user_and_status(
                    gerant_id, ["trialing"]
                )

            logger.info(f"Trial subscription reactivated for {current_user['email']} (no Stripe call)")

            return ReactivateSubscriptionResponse(
                success=True,
                message="Abonnement d'essai réactivé avec succès",
                subscription=updated_subscription or subscription,
                reactivated_at=datetime.now(timezone.utc).isoformat()
            )

        # For active subscribers, call Stripe API
        if not stripe_subscription_id:
            raise ValidationError("Impossible de réactiver l'abonnement. Identifiant Stripe manquant.")

        if not settings.STRIPE_API_KEY:
            raise BusinessLogicError("Configuration Stripe manquante")

        try:
            # Reactivate subscription in Stripe
            updated_stripe_subscription = stripe_client.modify_subscription(
                stripe_subscription_id,
                cancel_at_period_end=False,
            )

            logger.info(f"Stripe subscription {stripe_subscription_id} reactivated for {current_user['email']}")

            # Update database
            update_data = {
                "cancel_at_period_end": False,
                "canceled_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            # Update current_period_end if available from Stripe
            if updated_stripe_subscription.current_period_end:
                update_data["current_period_end"] = datetime.fromtimestamp(
                    updated_stripe_subscription.current_period_end,
                    tz=timezone.utc
                ).isoformat()

            await gerant_service.update_subscription_by_stripe_id(
                stripe_subscription_id, update_data
            )

            workspace_id = current_user.get('workspace_id')
            if workspace_id:
                await gerant_service.update_workspace_one(
                    workspace_id,
                    {"subscription_status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}
                )

            updated_subscription = await gerant_service.get_subscription_by_stripe_id(stripe_subscription_id)

            if not updated_subscription:
                updated_subscription = {**subscription, **update_data}

            logger.info(f"Subscription reactivated successfully for {current_user['email']}")

            return ReactivateSubscriptionResponse(
                success=True,
                message="Abonnement réactivé avec succès. L'annulation programmée a été annulée.",
                subscription=updated_subscription,
                reactivated_at=datetime.now(timezone.utc).isoformat()
            )

        except stripe.InvalidRequestError as e:
            logger.error(f"Stripe error reactivating subscription: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")
    except Exception:
        raise
