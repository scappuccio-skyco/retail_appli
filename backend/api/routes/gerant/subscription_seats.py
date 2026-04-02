"""
Subscription seats routes: update-seats, preview (unified), seats/preview (legacy)
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import stripe
import logging

from core.exceptions import (
    AppException, NotFoundError, ValidationError,
    ConflictError,
)
from core.security import get_current_gerant
from core.config import settings
from services.gerant_service import GerantService
from services.payment_service import PaymentService
from services.stripe_client import StripeClient
from api.dependencies import get_gerant_service, get_payment_service, get_stripe_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


class UpdateSeatsRequest(BaseModel):
    """Request body for updating subscription seats"""
    seats: int
    stripe_subscription_id: Optional[str] = None  # Required if multiple active subscriptions


@router.post("/subscription/update-seats")
async def update_subscription_seats(
    request: UpdateSeatsRequest,
    current_user: dict = Depends(get_current_gerant),
    payment_service: PaymentService = Depends(get_payment_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update the number of seats in the subscription.

    For trial users: Just updates the database, no Stripe charges.
    For active subscribers: Calls Stripe API with proration.

    ATOMIC: If Stripe call fails, DB is not updated.

    Returns:
        success: bool
        message: str
        new_seats: int
        new_monthly_cost: float
        is_trial: bool
        proration_amount: float
    """
    try:
        gerant_id = current_user['id']
        new_seats = request.seats

        # Validate seats count
        if new_seats < 1:
            raise ValidationError("Le nombre de sièges doit être au moins 1")
        if new_seats > 50:
            raise ValidationError("Maximum 50 sièges. Contactez-nous pour un devis personnalisé.")

        # Get current subscription to check if trial (for info only, PaymentService will re-fetch)
        subscription = await gerant_service.get_subscription_by_user_and_status(
            gerant_id, ["active", "trialing"]
        )

        if not subscription:
            raise NotFoundError("Aucun abonnement trouvé")

        is_trial = subscription.get('status') == 'trialing'

        # Call PaymentService with optional stripe_subscription_id
        result = await payment_service.update_subscription_seats(
            gerant_id=gerant_id,
            new_seats=new_seats,
            is_trial=is_trial,
            stripe_subscription_id=request.stripe_subscription_id
        )

        logger.info(f"Sièges mis à jour: {result['previous_seats']} → {new_seats} pour {current_user['email']}")

        return {
            "success": True,
            "message": f"Abonnement mis à jour : {new_seats} siège{'s' if new_seats > 1 else ''}",
            "new_seats": result['new_seats'],
            "new_monthly_cost": result['new_monthly_cost'],
            "is_trial": is_trial,
            "proration_amount": result['proration_amount']
        }

    except AppException:
        raise
    except Exception as e:
        # Check if it's a MultipleActiveSubscriptionsError
        if hasattr(e, 'active_subscriptions') and hasattr(e, 'recommended_action'):
            from exceptions.subscription_exceptions import MultipleActiveSubscriptionsError
            if isinstance(e, MultipleActiveSubscriptionsError):
                raise ConflictError(
                    detail=e.message or "Plusieurs abonnements actifs. Spécifiez 'stripe_subscription_id' dans la requête pour cibler un abonnement spécifique.",
                    error_code="MULTIPLE_ACTIVE_SUBSCRIPTIONS",
                )

        # Check if it's a ValueError (other cases)
        if isinstance(e, ValueError):
            if "MULTIPLE_ACTIVE_SUBSCRIPTIONS" in str(e):
                raise ConflictError(
                    detail=str(e),
                    error_code="MULTIPLE_ACTIVE_SUBSCRIPTIONS",
                )
            raise ValidationError(str(e))
        raise


class PreviewUpdateRequest(BaseModel):
    """Request body for previewing subscription changes (seats and/or interval)"""
    new_seats: Optional[int] = None  # Si None, garde le nombre actuel
    new_interval: Optional[str] = None  # 'month' ou 'year', si None garde l'intervalle actuel


class PreviewUpdateResponse(BaseModel):
    """Response for subscription update preview"""
    # Seats info
    current_seats: int
    new_seats: int
    current_plan: str
    new_plan: str

    # Interval info
    current_interval: str  # 'month' ou 'year'
    new_interval: str
    interval_changing: bool

    # Cost breakdown
    current_monthly_cost: float
    new_monthly_cost: float
    current_yearly_cost: float
    new_yearly_cost: float

    # Price differences
    price_difference_monthly: float
    price_difference_yearly: float

    # Proration (what will be charged/credited NOW)
    proration_estimate: float
    proration_description: str

    # Flags
    is_upgrade: bool
    is_trial: bool
    annual_savings_percent: float  # Économie en passant à l'annuel


# Keep old endpoint for backward compatibility
class PreviewSeatsRequest(BaseModel):
    """Request body for previewing seat changes (legacy)"""
    new_seats: int


class PreviewSeatsResponse(BaseModel):
    """Response for seat preview (legacy)"""
    current_seats: int
    new_seats: int
    current_plan: str
    new_plan: str
    current_monthly_cost: float
    new_monthly_cost: float
    price_difference: float
    proration_estimate: float
    is_upgrade: bool
    is_trial: bool


@router.post("/subscription/preview", response_model=PreviewUpdateResponse)
async def preview_subscription_update(
    request: PreviewUpdateRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
):
    """
    Preview ANY subscription change: seats AND/OR billing interval.

    Use cases:
    - Change seats only: { "new_seats": 10 }
    - Change interval only: { "new_interval": "year" }
    - Change both: { "new_seats": 10, "new_interval": "year" }

    Returns detailed cost breakdown and proration estimate.
    """
    try:
        gerant_id = current_user['id']

        subscription = await gerant_service.get_subscription_by_user_and_status(
            gerant_id, ["active", "trialing"]
        )

        if not subscription:
            raise NotFoundError("Aucun abonnement trouvé")

        # Current values
        current_seats = subscription.get('seats', 1)
        current_interval = subscription.get('billing_interval', 'month')
        is_trial = subscription.get('status') == 'trialing'

        # New values (default to current if not specified)
        new_seats = request.new_seats if request.new_seats is not None else current_seats
        new_interval = request.new_interval if request.new_interval else current_interval

        # Validate
        if new_seats < 1:
            raise ValidationError("Minimum 1 siège")
        if new_seats > 50:
            raise ValidationError("Maximum 50 sièges")
        if new_interval not in ['month', 'year']:
            raise ValidationError("Intervalle invalide (month ou year)")

        # Block downgrade from annual to monthly
        if current_interval == 'year' and new_interval == 'month':
            raise ValidationError("Impossible de passer de l'annuel au mensuel. Pour changer, annulez votre abonnement actuel.")

        interval_changing = current_interval != new_interval

        # For display purposes, use generic plan names since Stripe handles tiered pricing
        current_plan = "tiered"
        new_plan = "tiered"

        # Get accurate costs from Stripe API (if subscription exists)
        current_monthly_cost = 0.0
        new_monthly_cost = 0.0
        current_yearly_cost = 0.0
        new_yearly_cost = 0.0
        proration_estimate = 0.0
        proration_description = ""

        stripe_subscription_id = subscription.get('stripe_subscription_id')
        stripe_subscription_item_id = subscription.get('stripe_subscription_item_id')

        if is_trial:
            proration_description = "Aucun frais pendant la période d'essai"
        elif stripe_subscription_id and stripe_subscription_item_id:
            # Get real costs from Stripe API
            try:
                gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
                stripe_customer_id = gerant.get('stripe_customer_id') if gerant else None

                if stripe_customer_id:
                    # Get current subscription details from Stripe
                    current_stripe_sub = stripe_client.retrieve_subscription(stripe_subscription_id)
                    current_quantity = current_stripe_sub['items']['data'][0]['quantity']

                    # Preview new subscription with updated quantity/interval
                    new_price_id = settings.STRIPE_PRICE_ID_YEARLY if new_interval == 'year' else settings.STRIPE_PRICE_ID_MONTHLY

                    # Use Stripe Invoice.create_preview for accurate amounts
                    preview_invoice = stripe_client.create_invoice_preview(
                        customer_id=stripe_customer_id,
                        subscription_id=stripe_subscription_id,
                        subscription_details={
                            'items': [{
                                'id': stripe_subscription_item_id,
                                'price': new_price_id,
                                'quantity': new_seats,
                            }],
                            'proration_behavior': 'create_prorations',
                        },
                    )

                    # Extract amounts from Stripe (in cents, convert to euros)
                    proration_estimate = round(preview_invoice.amount_due / 100, 2)

                    # Get line items for cost breakdown
                    for line in preview_invoice.lines.data:
                        if line.type == 'subscription':
                            new_monthly_cost = round(line.amount / 100, 2) / new_seats if new_seats > 0 else 0
                            break

                    # Calculate yearly cost (if applicable)
                    if new_interval == 'year':
                        new_yearly_cost = round(preview_invoice.amount_due / 100, 2)
                    else:
                        new_monthly_cost = round(preview_invoice.amount_due / 100, 2) / new_seats if new_seats > 0 else 0

                    # Get current costs from existing subscription
                    if current_interval == 'year':
                        current_yearly_cost = round(current_stripe_sub['items']['data'][0]['price']['unit_amount'] * current_quantity / 100, 2)
                    else:
                        current_monthly_cost = round(current_stripe_sub['items']['data'][0]['price']['unit_amount'] * current_quantity / 100, 2)

                    proration_description = f"Montant calculé par Stripe selon la tarification par paliers"

            except stripe.StripeError as e:
                logger.warning(f"Could not get Stripe preview: {str(e)}")
                proration_description = "Impossible de calculer le montant exact. Stripe calculera le montant final lors de la modification."
            except Exception as e:
                logger.warning(f"Error getting Stripe preview: {str(e)}")
                proration_description = "Impossible de calculer le montant exact. Stripe calculera le montant final lors de la modification."

        # Calculate differences (only if we have values from Stripe)
        price_difference_monthly = new_monthly_cost - current_monthly_cost if current_monthly_cost > 0 and new_monthly_cost > 0 else 0.0
        price_difference_yearly = new_yearly_cost - current_yearly_cost if current_yearly_cost > 0 and new_yearly_cost > 0 else 0.0

        # Annual savings (Stripe handles this via tiered pricing)
        annual_savings_percent = 20.0 if new_interval == 'year' else 0.0

        return PreviewUpdateResponse(
            current_seats=current_seats,
            new_seats=new_seats,
            current_plan=current_plan,
            new_plan=new_plan,
            current_interval=current_interval,
            new_interval=new_interval,
            interval_changing=interval_changing,
            current_monthly_cost=current_monthly_cost,
            new_monthly_cost=new_monthly_cost,
            current_yearly_cost=current_yearly_cost,
            new_yearly_cost=new_yearly_cost,
            price_difference_monthly=price_difference_monthly,
            price_difference_yearly=price_difference_yearly,
            proration_estimate=proration_estimate,
            proration_description=proration_description,
            is_upgrade=(new_seats > current_seats) or (new_interval == 'year' and current_interval == 'month'),
            is_trial=is_trial,
            annual_savings_percent=annual_savings_percent
        )

    except AppException:
        raise


@router.post("/seats/preview", response_model=PreviewSeatsResponse)
async def preview_seat_change(
    request: PreviewSeatsRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
):
    """
    Preview the cost of changing seat count.

    Shows the user what they'll pay BEFORE they commit.
    Does NOT modify anything - purely informational.

    IMPORTANT: Uses Stripe's upcoming invoice API for accurate proration.

    Returns:
        - current vs new costs
        - proration estimate (from Stripe)
        - plan changes
    """
    try:
        gerant_id = current_user['id']
        new_seats = request.new_seats

        # Validate
        if new_seats < 1:
            raise ValidationError("Le nombre de sièges doit être au moins 1")
        if new_seats > 50:
            raise ValidationError("Maximum 50 sièges")

        subscription = await gerant_service.get_subscription_by_user_and_status(
            gerant_id, ["active", "trialing"]
        )

        if not subscription:
            raise NotFoundError("Aucun abonnement trouvé")

        current_seats = subscription.get('seats', 1)
        is_trial = subscription.get('status') == 'trialing'
        stripe_subscription_id = subscription.get('stripe_subscription_id')
        stripe_subscription_item_id = subscription.get('stripe_subscription_item_id')

        # For display purposes, use generic plan names since Stripe handles tiered pricing
        current_plan = "tiered"
        new_plan = "tiered"

        # Get accurate costs from Stripe API (if subscription exists)
        current_monthly_cost = 0.0
        new_monthly_cost = 0.0
        price_difference = 0.0
        proration_estimate = 0.0

        if not is_trial and stripe_subscription_id and stripe_subscription_item_id:
            if settings.STRIPE_API_KEY:
                try:
                    gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
                    stripe_customer_id = gerant.get('stripe_customer_id') if gerant else None

                    if stripe_customer_id:
                        # Call Stripe's Invoice preview API for accurate proration
                        preview_invoice = stripe_client.create_invoice_preview(
                            customer_id=stripe_customer_id,
                            subscription_id=stripe_subscription_id,
                            subscription_details={
                                'items': [{
                                    'id': stripe_subscription_item_id,
                                    'quantity': new_seats,
                                }],
                                'proration_behavior': 'create_prorations',
                            },
                        )

                        # Extract amounts from Stripe (in cents, convert to euros)
                        proration_estimate = round(preview_invoice.amount_due / 100, 2)

                        # Get monthly costs from line items
                        for line in preview_invoice.lines.data:
                            if line.type == 'subscription':
                                new_monthly_cost = round(line.amount / 100, 2) / new_seats if new_seats > 0 else 0
                                break

                        # Get current subscription for comparison
                        current_stripe_sub = stripe_client.retrieve_subscription(stripe_subscription_id)
                        if current_stripe_sub['items']['data']:
                            current_price_amount = current_stripe_sub['items']['data'][0]['price']['unit_amount']
                            current_quantity = current_stripe_sub['items']['data'][0]['quantity']
                            current_monthly_cost = round(current_price_amount * current_quantity / 100, 2) / current_seats if current_seats > 0 else 0

                        price_difference = new_monthly_cost * new_seats - current_monthly_cost * current_seats

                        logger.info(f"Stripe preview retrieved for {current_seats}→{new_seats} seats")
                    else:
                        logger.info(f"No stripe_customer_id for gerant {gerant_id}")

                except stripe.StripeError as e:
                    logger.warning(f"Could not get Stripe proration preview: {str(e)}")
                except Exception as e:
                    logger.warning(f"Unexpected error in Stripe preview: {str(e)}")

        return PreviewSeatsResponse(
            current_seats=current_seats,
            new_seats=new_seats,
            current_plan=current_plan,
            new_plan=new_plan,
            current_monthly_cost=current_monthly_cost,
            new_monthly_cost=new_monthly_cost,
            price_difference=price_difference,
            proration_estimate=proration_estimate,
            is_upgrade=new_seats > current_seats,
            is_trial=is_trial
        )

    except AppException:
        raise
