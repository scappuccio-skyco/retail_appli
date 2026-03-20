"""
Gérant subscription routes: subscription/*, seats/*, stripe/*, switch-interval, cancel,
reactivate, subscriptions list, audit, billing-profile.
"""
from fastapi import APIRouter, Depends, Query, Body
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, Optional
import stripe
import uuid
import logging

from core.constants import ERR_CONFIG_STRIPE_MANQUANTE
from core.exceptions import (
    AppException, NotFoundError, ValidationError, ForbiddenError,
    BusinessLogicError, ConflictError,
)
from core.security import get_current_gerant
from core.config import settings
from services.gerant_service import GerantService
from services.payment_service import PaymentService
from services.vat_service import validate_vat_number, calculate_vat_rate, is_eu_country
from models.billing import BillingProfileCreate, BillingProfileUpdate, BillingProfile, BillingProfileResponse
from api.dependencies import get_gerant_service, get_payment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


@router.get("/subscription/status")
async def get_subscription_status(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get subscription status for the current gérant

    Checks:
    1. Workspace trial status (priority)
    2. Stripe subscription status
    3. Local database subscription fallback

    Returns:
        Dict with subscription details, plan, seats, trial info
    """
    status = await gerant_service.get_subscription_status(current_user['id'])
    return status


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
                stripe.api_key = settings.STRIPE_API_KEY

                gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
                stripe_customer_id = gerant.get('stripe_customer_id') if gerant else None

                if stripe_customer_id:
                    # Get current subscription details from Stripe
                    current_stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
                    current_price_id = current_stripe_sub['items']['data'][0]['price']['id']
                    current_quantity = current_stripe_sub['items']['data'][0]['quantity']

                    # Get price details from Stripe
                    current_price_obj = stripe.Price.retrieve(current_price_id)

                    # Preview new subscription with updated quantity/interval
                    new_price_id = settings.STRIPE_PRICE_ID_YEARLY if new_interval == 'year' else settings.STRIPE_PRICE_ID_MONTHLY

                    # Use Stripe Invoice.create_preview for accurate amounts
                    preview_invoice = stripe.Invoice.create_preview(
                        customer=stripe_customer_id,
                        subscription=stripe_subscription_id,
                        subscription_details={
                            'items': [{
                                'id': stripe_subscription_item_id,
                                'price': new_price_id,
                                'quantity': new_seats,
                            }],
                            'proration_behavior': 'create_prorations'
                        }
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
            STRIPE_API_KEY = settings.STRIPE_API_KEY
            if STRIPE_API_KEY:
                try:
                    stripe.api_key = STRIPE_API_KEY

                    gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
                    stripe_customer_id = gerant.get('stripe_customer_id') if gerant else None

                    if stripe_customer_id:
                        # Call Stripe's Invoice preview API for accurate proration
                        preview_invoice = stripe.Invoice.create_preview(
                            customer=stripe_customer_id,
                            subscription=stripe_subscription_id,
                            subscription_details={
                                'items': [{
                                    'id': stripe_subscription_item_id,
                                    'quantity': new_seats,
                                }],
                                'proration_behavior': 'create_prorations'
                            }
                        )

                        # Extract amounts from Stripe (in cents, convert to euros)
                        proration_estimate = round(preview_invoice.amount_due / 100, 2)

                        # Get monthly costs from line items
                        for line in preview_invoice.lines.data:
                            if line.type == 'subscription':
                                new_monthly_cost = round(line.amount / 100, 2) / new_seats if new_seats > 0 else 0
                                break

                        # Get current subscription for comparison
                        current_stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
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


# ===== STRIPE CHECKOUT =====

class GerantCheckoutRequest(BaseModel):
    """Request body for creating a checkout session"""
    quantity: Optional[int] = None  # Nombre de vendeurs (si None, utiliser le compte actif)
    billing_period: str = "monthly"  # 'monthly' ou 'yearly'
    origin_url: str  # URL d'origine pour les redirections


class BillingPortalRequest(BaseModel):
    return_url: str  # URL to redirect back to after the portal session


@router.post("/stripe/portal")
async def create_billing_portal_session(
    data: BillingPortalRequest,
    current_user: dict = Depends(get_current_gerant),
):
    """
    Create a Stripe Customer Portal session so the gérant can update their
    payment method, view invoices, or manage their subscription directly on Stripe.
    """
    if not settings.STRIPE_API_KEY:
        raise ValidationError("Stripe n'est pas configuré")

    stripe_customer_id = current_user.get('stripe_customer_id')
    if not stripe_customer_id:
        raise ValidationError("Aucun compte de facturation Stripe associé à ce compte")

    stripe.api_key = settings.STRIPE_API_KEY
    try:
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=data.return_url,
        )
        return {"portal_url": session.url}
    except stripe.error.InvalidRequestError as e:
        raise ValidationError(f"Impossible d'ouvrir le portail de facturation : {str(e)}")


@router.post("/stripe/checkout")
async def create_gerant_checkout_session(
    checkout_data: GerantCheckoutRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Créer une session de checkout Stripe pour un gérant.
    Tarification basée sur le nombre de vendeurs actifs :
    - 1-5 vendeurs actifs : 29€/vendeur
    - 6-15 vendeurs actifs : 25€/vendeur
    - >15 vendeurs : sur devis (erreur)

    VALIDATION FISCALE B2B:
    - Le profil de facturation DOIT être complet avant tout paiement
    - Blocage si champs obligatoires manquants
    - Blocage si VAT number UE invalide

    ACCESSIBILITÉ:
    - Cette route est accessible même si trial_expired (c'est pour souscrire)
    - Pas de vérification require_active_space() car c'est justement pour créer un abonnement
    """
    logger.info(f"[CHECKOUT] Début création session pour gérant {current_user.get('id')}, période: {checkout_data.billing_period}")
    try:
        logger.info(f"[CHECKOUT] Vérification STRIPE_API_KEY...")
        if not settings.STRIPE_API_KEY:
            logger.error("[CHECKOUT] STRIPE_API_KEY manquante")
            raise BusinessLogicError("Configuration Stripe manquante")
        logger.info(f"[CHECKOUT] STRIPE_API_KEY présente")

        logger.info(f"[CHECKOUT] Recherche profil de facturation pour gérant {current_user['id']}...")
        billing_profile = await gerant_service.get_billing_profile_by_gerant(current_user['id'])
        logger.info(f"[CHECKOUT] Profil de facturation trouvé: {billing_profile is not None}")

        if not billing_profile or not billing_profile.get('billing_profile_completed'):
            logger.warning(f"[CHECKOUT] Profil de facturation incomplet pour gérant {current_user['id']}")
            raise ValidationError(
                "Profil de facturation incomplet. "
                "Veuillez compléter vos informations de facturation B2B avant de procéder au paiement. "
                "Ces informations sont obligatoires pour générer des factures conformes."
            )

        # Vérifier les champs obligatoires
        required_fields = ['company_name', 'billing_email', 'address_line1', 'postal_code', 'city', 'country', 'country_code']
        missing_fields = []

        for field in required_fields:
            if not billing_profile.get(field):
                missing_fields.append(field.replace('_', ' ').title())

        if missing_fields:
            raise ValidationError(
                f"Champs de facturation manquants: {', '.join(missing_fields)}. "
                "Veuillez compléter votre profil de facturation avant de procéder au paiement."
            )

        # Vérifier le VAT number si pays UE hors FR
        country = billing_profile.get('country', '').upper()
        if country != 'FR' and country in ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']:
            if not billing_profile.get('vat_number'):
                raise ValidationError(
                    f"Numéro de TVA intracommunautaire obligatoire pour les pays UE hors France (pays sélectionné: {country}). "
                    "Veuillez compléter votre profil de facturation avant de procéder au paiement."
                )

            if not billing_profile.get('vat_number_validated'):
                raise ValidationError(
                    f"Le numéro de TVA intracommunautaire n'a pas été validé pour le pays {country}. "
                    "Veuillez vérifier et mettre à jour votre profil de facturation avant de procéder au paiement."
                )

        logger.info(f"Profil de facturation validé pour gérant {current_user['id']} avant checkout")

        stripe.api_key = settings.STRIPE_API_KEY

        # Compter les vendeurs ACTIFS uniquement
        active_sellers_count = await gerant_service.count_active_sellers_for_gerant(current_user['id'])
        logger.info(f"[CHECKOUT] Vendeurs actifs: {active_sellers_count}")

        # Utiliser la quantité fournie ou celle calculée
        quantity = checkout_data.quantity if checkout_data.quantity else active_sellers_count
        logger.info(f"[CHECKOUT] Quantité finale: {quantity}")
        quantity = max(quantity, 1)  # Minimum 1 vendeur

        # Validation des limites : bloquer si > 15 vendeurs
        if quantity > 15:
            raise ValidationError("Au-delà de 15 vendeurs, veuillez nous contacter pour un devis personnalisé.")

        # Vérifier si le gérant a déjà un customer ID Stripe
        gerant = await gerant_service.get_gerant_by_id(current_user['id'], include_password=False)
        if not gerant:
            logger.error(f"Gérant {current_user['id']} non trouvé dans la base de données")
            raise NotFoundError("Gérant non trouvé")
        stripe_customer_id = gerant.get('stripe_customer_id')

        existing_subscriptions = await gerant_service.get_active_subscriptions_for_gerant(
            current_user['id'], limit=10
        )

        # Vérifier dans Stripe si les abonnements existent encore et sont actifs
        active_count = 0
        active_stripe_ids = []
        for existing_sub in existing_subscriptions:
            stripe_sub_id = existing_sub.get('stripe_subscription_id')
            if stripe_sub_id:
                try:
                    stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
                    if stripe_sub.status in ['active', 'trialing']:
                        active_count += 1
                        active_stripe_ids.append(stripe_sub_id)
                except stripe.InvalidRequestError:
                    # Abonnement n'existe plus dans Stripe, ignorer
                    logger.warning(f"Abonnement Stripe {stripe_sub_id} introuvable dans Stripe")
                except Exception as e:
                    logger.warning(f"Erreur lors de la vérification Stripe: {e}")

        # Bloquer avec HTTP 409 si >=1 abonnement actif
        if active_count >= 1:
            if active_count > 1:
                logger.warning(
                    f"MULTIPLE ACTIVE SUBSCRIPTIONS detected for user {current_user['id']}: "
                    f"{active_count} active subscriptions found. Stripe IDs: {active_stripe_ids}"
                )

            raise ConflictError(
                f"Un abonnement actif existe déjà. "
                f"Veuillez utiliser 'Modifier mon abonnement' ou 'Annuler mon abonnement' avant d'en créer un nouveau. "
                f"(Abonnements actifs détectés: {active_count})"
            )

        # Créer ou récupérer le client Stripe
        if stripe_customer_id:
            try:
                customer = stripe.Customer.retrieve(stripe_customer_id)
                if customer.get('deleted'):
                    stripe_customer_id = None
                logger.info(f"Réutilisation du client Stripe: {stripe_customer_id}")
            except stripe.InvalidRequestError:
                stripe_customer_id = None
                logger.warning(f"Client Stripe introuvable, création d'un nouveau")

        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user['email'],
                name=current_user['name'],
                metadata={
                    'gerant_id': current_user['id'],
                    'role': 'gerant'
                }
            )
            stripe_customer_id = customer.id

            await gerant_service.update_gerant_user_one(
                current_user['id'],
                {"stripe_customer_id": stripe_customer_id}
            )
            logger.info(f"Nouveau client Stripe créé: {stripe_customer_id}")

        # URLs de succès et d'annulation
        success_url = f"{checkout_data.origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_data.origin_url}/dashboard"

        # Sélectionner le Price ID selon la période (monthly ou yearly)
        if checkout_data.billing_period == 'monthly':
            price_id = settings.STRIPE_PRICE_ID_MONTHLY
        else:
            price_id = settings.STRIPE_PRICE_ID_YEARLY

        # Vérifier que le price_id est défini
        if not price_id:
            logger.error(f"STRIPE_PRICE_ID_{'MONTHLY' if checkout_data.billing_period == 'monthly' else 'YEARLY'} non configuré")
            raise BusinessLogicError(f"Configuration Stripe incomplète: Price ID manquant pour la période {checkout_data.billing_period}")

        billing_interval = 'month' if checkout_data.billing_period == 'monthly' else 'year'

        # Vérifier que origin_url est fourni
        if not checkout_data.origin_url or not checkout_data.origin_url.strip():
            logger.error("origin_url manquant dans checkout_data")
            raise ValidationError("URL d'origine requise pour créer la session de checkout")

        # Generate correlation_id (unique per checkout attempt)
        correlation_id = str(uuid.uuid4())

        # Créer la session de checkout avec metadata complète
        try:
            session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            client_reference_id=f"gerant_{current_user['id']}_{correlation_id}",  # For correlation
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,  # Use price_id instead of price_data for better correlation
                'quantity': quantity,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'gerant_id': current_user['id'],
                'workspace_id': current_user.get('workspace_id', ''),
                'seller_quantity': str(quantity),
                'correlation_id': correlation_id,
                'source': 'app_checkout',
                'billing_interval': billing_interval
            },
            subscription_data={
                'metadata': {
                    'correlation_id': correlation_id,
                    'checkout_session_id': '{{CHECKOUT_SESSION_ID}}',  # Stripe will replace
                    'user_id': current_user['id'],
                    'workspace_id': current_user.get('workspace_id', ''),
                    'source': 'app_checkout',
                    'price_id': price_id,
                    'billing_interval': billing_interval,
                    'quantity': str(quantity)
                }
            }
            )
        except stripe.InvalidRequestError as e:
            logger.error(f"Erreur Stripe InvalidRequestError: {str(e)}")
            raise ValidationError(f"Erreur lors de la création de la session Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"Erreur Stripe: {str(e)}")
            raise BusinessLogicError(f"Erreur Stripe: {str(e)}")

        logger.info(f"Session checkout créée {session.id} pour {current_user['name']} avec {quantity} vendeur(s)")

        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "quantity": quantity,
            "active_sellers_count": active_sellers_count,
            "billing_interval": billing_interval
        }
    except (ValidationError, NotFoundError, ConflictError, BusinessLogicError):
        raise
    except Exception as e:
        logger.error("Checkout error: %s", e, exc_info=True)
        raise


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
            STRIPE_API_KEY = settings.STRIPE_API_KEY
            if not STRIPE_API_KEY:
                raise ValidationError(ERR_CONFIG_STRIPE_MANQUANTE)

            stripe.api_key = STRIPE_API_KEY

            try:
                # Get new price ID based on interval (using new simplified structure)
                new_price_id = settings.STRIPE_PRICE_ID_YEARLY if new_interval == 'year' else settings.STRIPE_PRICE_ID_MONTHLY

                # CRITICAL: Modify subscription with new price
                updated_subscription = stripe.Subscription.modify(
                    stripe_subscription_id,
                    items=[{
                        'id': stripe_subscription_item_id,
                        'price': new_price_id,
                        'quantity': current_seats
                    }],
                    proration_behavior='create_prorations',  # Charge/credit the difference
                    payment_behavior='allow_incomplete'  # Allow if payment fails
                )

                logger.info(f"Stripe subscription {stripe_subscription_id} switched to {new_interval}")

                # Get proration from Stripe API only (no server-side calculation)
                proration_amount = 0.0
                try:
                    upcoming = stripe.Invoice.upcoming(subscription=stripe_subscription_id)
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

        STRIPE_API_KEY = settings.STRIPE_API_KEY
        if not STRIPE_API_KEY:
            raise BusinessLogicError("Configuration Stripe manquante")

        stripe.api_key = STRIPE_API_KEY

        try:
            if cancel_immediately:
                # Cancel immediately - Stripe will handle proration/refund
                canceled_subscription = stripe.Subscription.delete(stripe_subscription_id)

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
                updated_subscription = stripe.Subscription.modify(
                    stripe_subscription_id,
                    cancel_at_period_end=True
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

        STRIPE_API_KEY = settings.STRIPE_API_KEY
        if not STRIPE_API_KEY:
            raise BusinessLogicError("Configuration Stripe manquante")

        stripe.api_key = STRIPE_API_KEY

        try:
            # Reactivate subscription in Stripe
            updated_stripe_subscription = stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=False
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


@router.get("/subscriptions")
async def get_all_subscriptions(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Liste tous les abonnements du gérant (actifs, annulés, expirés).

    Utile pour:
    - Détecter les abonnements multiples
    - Voir l'historique des abonnements
    - Déboguer les problèmes d'abonnement

    Returns:
        Liste de tous les abonnements avec leurs détails
    """
    try:
        gerant_id = current_user['id']

        subscriptions_result = await gerant_service.get_subscriptions_paginated(
            gerant_id, page=1, size=50
        )
        subscriptions = subscriptions_result.items

        # Count active subscriptions
        active_count = sum(1 for s in subscriptions if s.get('status') in ['active', 'trialing'])

        # Format subscriptions
        formatted_subscriptions = []
        for sub in subscriptions:
            formatted_sub = {
                "id": sub.get('id'),
                "status": sub.get('status'),
                "plan": sub.get('plan'),
                "seats": sub.get('seats', 1),
                "billing_interval": sub.get('billing_interval', 'month'),
                "stripe_subscription_id": sub.get('stripe_subscription_id'),
                "created_at": sub.get('created_at'),
                "updated_at": sub.get('updated_at'),
                "canceled_at": sub.get('canceled_at'),
                "cancel_at_period_end": sub.get('cancel_at_period_end', False),
                "current_period_start": sub.get('current_period_start'),
                "current_period_end": sub.get('current_period_end'),
                "trial_start": sub.get('trial_start'),
                "trial_end": sub.get('trial_end')
            }
            formatted_subscriptions.append(formatted_sub)

        return {
            "success": True,
            "total_subscriptions": len(subscriptions),
            "active_subscriptions": active_count,
            "subscriptions": formatted_subscriptions,
            "warning": f"{active_count} abonnement(s) actif(s) détecté(s)" if active_count > 1 else None
        }
    except Exception as e:
        raise AppException(detail=str(e), status_code=500)


@router.get("/subscription/audit")
async def audit_subscription(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Endpoint d'audit pour diagnostic rapide des problèmes d'abonnement.

    Retourne:
    - Nombre d'abonnements actifs
    - Liste des stripe_subscription_id actifs
    - has_multiple_active
    - last_event_created/id pour chaque abonnement
    - Metadata clés (workspace_id, price_id, correlation_id)

    Utile pour le support client et le debugging.
    """
    try:
        gerant_id = current_user['id']

        active_subscriptions_result = await gerant_service.get_active_subscriptions_paginated(
            gerant_id, page=1, size=20
        )
        active_subscriptions = active_subscriptions_result.items

        all_subscriptions_result = await gerant_service.get_subscriptions_paginated(
            gerant_id, page=1, size=50
        )
        all_subscriptions = all_subscriptions_result.items

        # Format active subscriptions with audit details
        active_list = []
        for sub in active_subscriptions:
            active_list.append({
                "stripe_subscription_id": sub.get('stripe_subscription_id'),
                "status": sub.get('status'),
                "plan": sub.get('plan'),
                "seats": sub.get('seats', 1),
                "billing_interval": sub.get('billing_interval', 'month'),
                "workspace_id": sub.get('workspace_id'),
                "price_id": sub.get('price_id'),
                "correlation_id": sub.get('correlation_id'),
                "checkout_session_id": sub.get('checkout_session_id'),
                "source": sub.get('source', 'unknown'),
                "has_multiple_active": sub.get('has_multiple_active', False),
                "last_event_created": sub.get('last_event_created'),
                "last_event_id": sub.get('last_event_id'),
                "created_at": sub.get('created_at'),
                "current_period_end": sub.get('current_period_end'),
                "cancel_at_period_end": sub.get('cancel_at_period_end', False)
            })

        # Count by status
        status_counts = {}
        for sub in all_subscriptions:
            status = sub.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1

        # Check for potential issues
        issues = []
        critical_issues = []

        if len(active_subscriptions) > 1:
            issues.append({
                "severity": "warning",
                "type": "MULTIPLE_ACTIVE_SUBSCRIPTIONS",
                "message": f"{len(active_subscriptions)} abonnements actifs détectés",
                "stripe_subscription_ids": [s.get('stripe_subscription_id') for s in active_subscriptions]
            })
            critical_issues.append("MULTIPLE_ACTIVE_SUBSCRIPTIONS")

        # Check for missing metadata
        for sub in active_subscriptions:
            if sub.get('source') == 'app_checkout' and not sub.get('checkout_session_id'):
                issues.append({
                    "severity": "warning",
                    "type": "MISSING_METADATA",
                    "message": f"Subscription {sub.get('stripe_subscription_id')} from app_checkout but missing checkout_session_id",
                    "stripe_subscription_id": sub.get('stripe_subscription_id')
                })
                critical_issues.append("MISSING_METADATA")

            # Check for missing correlation_id
            if sub.get('source') == 'app_checkout' and not sub.get('correlation_id'):
                issues.append({
                    "severity": "warning",
                    "type": "MISSING_CORRELATION_ID",
                    "message": f"Subscription {sub.get('stripe_subscription_id')} from app_checkout but missing correlation_id",
                    "stripe_subscription_id": sub.get('stripe_subscription_id')
                })
                critical_issues.append("MISSING_CORRELATION_ID")

        # Check for missing workspace_id
        for sub in active_subscriptions:
            if not sub.get('workspace_id'):
                issues.append({
                    "severity": "info",
                    "type": "MISSING_WORKSPACE_ID",
                    "message": f"Subscription {sub.get('stripe_subscription_id')} missing workspace_id",
                    "stripe_subscription_id": sub.get('stripe_subscription_id')
                })

        # Check for missing price_id
        for sub in active_subscriptions:
            if not sub.get('price_id'):
                issues.append({
                    "severity": "warning",
                    "type": "MISSING_PRICE_ID",
                    "message": f"Subscription {sub.get('stripe_subscription_id')} missing price_id",
                    "stripe_subscription_id": sub.get('stripe_subscription_id')
                })
                critical_issues.append("MISSING_PRICE_ID")

        # Determine recommended_action
        if len(active_subscriptions) > 1:
            all_have_metadata = all(
                s.get('source') == 'app_checkout' and
                (s.get('correlation_id') or s.get('checkout_session_id')) and
                s.get('workspace_id') and
                s.get('price_id')
                for s in active_subscriptions
            )

            if all_have_metadata:
                recommended_action = "CLEANUP_REQUIRED"
                recommended_action_details = (
                    "Multiple active subscriptions detected but all have required metadata. "
                    "Webhook cancellation logic can safely identify duplicates. "
                    "Manual review recommended to verify which subscription should remain active."
                )
            else:
                recommended_action = "CHECK_STRIPE_METADATA"
                recommended_action_details = (
                    "Multiple active subscriptions detected but missing required metadata. "
                    "Cannot safely auto-cancel. Please verify metadata in Stripe Dashboard and update manually."
                )
        elif "MISSING_METADATA" in critical_issues or "MISSING_CORRELATION_ID" in critical_issues:
            recommended_action = "CHECK_STRIPE_METADATA"
            recommended_action_details = (
                "Subscription missing critical metadata. Verify in Stripe Dashboard that subscription.metadata contains "
                "checkout_session_id, correlation_id, workspace_id, and price_id."
            )
        else:
            recommended_action = "OK"
            recommended_action_details = "No issues detected. Subscription status is healthy."

        return {
            "success": True,
            "gerant_id": gerant_id,
            "active_subscriptions_count": len(active_subscriptions),
            "has_multiple_active": len(active_subscriptions) > 1,
            "active_subscriptions": active_list,
            "status_counts": status_counts,
            "total_subscriptions": len(all_subscriptions),
            "detected_issues": issues,
            "recommended_action": recommended_action,
            "recommended_action_details": recommended_action_details,
            "audit_timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception:
        raise


# ==========================================
# BILLING PROFILE ROUTES (B2B FISCAL COMPLIANCE)
# ==========================================

@router.get("/billing-profile")
async def get_billing_profile(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Récupère le profil de facturation B2B du gérant.
    """
    try:
        billing_profile = await gerant_service.get_billing_profile_by_gerant(current_user['id'])

        if not billing_profile:
            return {"exists": False, "profile": None}

        return {"exists": True, "profile": billing_profile}
    except Exception as e:
        raise AppException(detail=str(e), status_code=500)


@router.post("/billing-profile")
async def create_billing_profile(
    profile_data: BillingProfileCreate,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Crée ou met à jour le profil de facturation B2B du gérant.

    Validations:
    - Si country != FR: vat_number obligatoire
    - Si country ∈ UE hors FR: validation VIES du vat_number
    - Synchronisation avec Stripe Customer
    """
    try:
        gerant_id = current_user['id']

        existing_profile = await gerant_service.get_billing_profile_by_gerant(gerant_id)

        # LOGIQUE MÉTIER: Validation des champs obligatoires
        country = profile_data.country.upper()

        # Si country != FR, vat_number est obligatoire
        if country != 'FR' and not profile_data.vat_number:
            raise ValidationError(f"Le numéro de TVA est obligatoire pour les pays hors France (pays sélectionné: {country})")

        # Si country ∈ UE hors FR, valider le VAT via VIES
        vat_validated = False
        is_vat_exempt = False
        vat_validation_data = None
        vat_validation_date = None

        if profile_data.vat_number:
            if country != 'FR' and is_eu_country(country):
                # Valider via VIES pour les pays UE hors FR
                is_valid, validation_data, error_msg = await validate_vat_number(
                    profile_data.vat_number,
                    country
                )

                if not is_valid:
                    raise ValidationError(f"Numéro de TVA invalide: {error_msg}. Veuillez vérifier votre numéro de TVA intracommunautaire.")

                vat_validated = True
                vat_validation_data = validation_data
                vat_validation_date = datetime.now(timezone.utc)
                is_vat_exempt = True  # Auto-liquidation pour UE hors FR avec VAT valide

                logger.info(f"VAT validé via VIES pour {country}{profile_data.vat_number}")

        # Si country == FR, TVA 20% (pas de validation VIES nécessaire)
        if country == 'FR':
            is_vat_exempt = False
            vat_rate, legal_mention = calculate_vat_rate('FR', False, False)
        else:
            vat_rate, legal_mention = calculate_vat_rate(country, vat_validated, is_vat_exempt)

        # Vérifier si des factures existent déjà (pour le verrouillage)
        has_invoices = False
        if existing_profile:
            has_invoices = existing_profile.get('has_invoices', False)

        # Préparer le profil de facturation
        profile_id = existing_profile['id'] if existing_profile else str(uuid.uuid4())

        billing_profile = {
            "id": profile_id,
            "gerant_id": gerant_id,
            "company_name": profile_data.company_name,
            "billing_email": profile_data.billing_email,
            "address_line1": profile_data.address_line1,
            "address_line2": profile_data.address_line2,
            "postal_code": profile_data.postal_code,
            "city": profile_data.city,
            "country": country,
            "country_code": profile_data.country_code.upper(),
            "vat_number": profile_data.vat_number.upper() if profile_data.vat_number else None,
            "siren": profile_data.siren,
            "is_vat_exempt": is_vat_exempt,
            "billing_profile_completed": True,
            "has_invoices": has_invoices,
            "vat_number_validated": vat_validated,
            "vat_validation_date": vat_validation_date,
            "vat_rate": vat_rate,
            "legal_mention": legal_mention,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        if not existing_profile:
            billing_profile["created_at"] = datetime.now(timezone.utc).isoformat()

        if existing_profile:
            await gerant_service.update_billing_profile_by_gerant(gerant_id, billing_profile)
            logger.info(f"Profil de facturation mis à jour pour gérant {gerant_id}")
        else:
            await gerant_service.create_billing_profile(billing_profile)
            logger.info(f"Profil de facturation créé pour gérant {gerant_id}")

        try:
            stripe.api_key = settings.STRIPE_API_KEY

            gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
            stripe_customer_id = gerant.get('stripe_customer_id')

            if stripe_customer_id:
                # Mettre à jour le customer Stripe avec les informations de facturation
                customer_update_data = {
                    "name": billing_profile["company_name"],
                    "email": billing_profile["billing_email"],
                    "address": {
                        "line1": billing_profile["address_line1"],
                        "line2": billing_profile.get("address_line2"),
                        "postal_code": billing_profile["postal_code"],
                        "city": billing_profile["city"],
                        "country": billing_profile["country_code"]
                    },
                    "metadata": {
                        "gerant_id": gerant_id,
                        "billing_profile_id": profile_id,
                        "country": country,
                        "vat_rate": str(vat_rate),
                        "legal_mention": legal_mention
                    }
                }

                # Ajouter le tax_id (numéro de TVA) si présent
                if billing_profile["vat_number"]:
                    customer_update_data["tax_ids"] = [{
                        "type": "eu_vat",
                        "value": billing_profile["vat_number"]
                    }]

                stripe.Customer.modify(stripe_customer_id, **customer_update_data)
                logger.info(f"Stripe Customer {stripe_customer_id} mis à jour avec le profil de facturation")
            else:
                logger.warning(f"Gérant {gerant_id} n'a pas de customer Stripe, impossible de synchroniser")

        except stripe.StripeError as e:
            logger.error(f"Erreur lors de la mise à jour Stripe Customer: {str(e)}")
            # Ne pas bloquer la création du profil si Stripe échoue

        return {
            "success": True,
            "message": "Profil de facturation enregistré avec succès",
            "profile": billing_profile
        }

    except AppException:
        raise


@router.put("/billing-profile")
async def update_billing_profile(
    profile_data: BillingProfileUpdate,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Met à jour partiellement le profil de facturation B2B.

    Attention: Si has_invoices = true, certains champs peuvent être verrouillés.
    """
    try:
        gerant_id = current_user['id']

        existing_profile = await gerant_service.get_billing_profile_by_gerant(gerant_id)

        if not existing_profile:
            raise NotFoundError("Profil de facturation introuvable")

        # Vérifier si des factures existent (verrouillage)
        has_invoices = existing_profile.get('has_invoices', False)
        if has_invoices:
            logger.warning(f"Tentative de modification du profil de facturation avec factures existantes pour gérant {gerant_id}")
            # On autorise la modification mais on log un warning

        # Construire les données de mise à jour (seulement les champs fournis)
        update_data = {}

        # Mettre à jour les champs fournis
        if profile_data.company_name is not None:
            update_data["company_name"] = profile_data.company_name
        if profile_data.billing_email is not None:
            update_data["billing_email"] = profile_data.billing_email
        if profile_data.address_line1 is not None:
            update_data["address_line1"] = profile_data.address_line1
        if profile_data.address_line2 is not None:
            update_data["address_line2"] = profile_data.address_line2
        if profile_data.postal_code is not None:
            update_data["postal_code"] = profile_data.postal_code
        if profile_data.city is not None:
            update_data["city"] = profile_data.city
        if profile_data.siren is not None:
            update_data["siren"] = profile_data.siren

        # Gestion du pays (peut nécessiter une revalidation VAT)
        country = existing_profile.get('country', 'FR')
        if profile_data.country is not None:
            country = profile_data.country.upper()
            update_data["country"] = country
            update_data["country_code"] = profile_data.country_code.upper() if profile_data.country_code else country

        # Gestion du VAT number (nécessite revalidation si pays UE hors FR)
        if profile_data.vat_number is not None:
            vat_number = profile_data.vat_number.upper() if profile_data.vat_number else None
            update_data["vat_number"] = vat_number

            # Valider le VAT si pays UE hors FR
            vat_validated = False
            is_vat_exempt = False
            vat_validation_date = None

            if vat_number and country != 'FR' and is_eu_country(country):
                is_valid, validation_data, error_msg = await validate_vat_number(vat_number, country)
                if not is_valid:
                    raise ValidationError(f"Numéro de TVA invalide: {error_msg}")
                vat_validated = True
                vat_validation_date = datetime.now(timezone.utc).isoformat()
                is_vat_exempt = True
                logger.info(f"VAT revalidé via VIES pour {country}{vat_number}")

            update_data["vat_number_validated"] = vat_validated
            update_data["vat_validation_date"] = vat_validation_date
            update_data["is_vat_exempt"] = is_vat_exempt

        # Recalculer le taux de TVA et la mention légale
        vat_rate, legal_mention = calculate_vat_rate(
            country,
            update_data.get("vat_number_validated", existing_profile.get("vat_number_validated", False)),
            update_data.get("is_vat_exempt", existing_profile.get("is_vat_exempt", False))
        )
        update_data["vat_rate"] = vat_rate
        update_data["legal_mention"] = legal_mention

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Mettre à jour en base
        await gerant_service.update_billing_profile_by_gerant(gerant_id, update_data)

        updated_profile = await gerant_service.get_billing_profile_by_gerant(gerant_id)

        try:
            stripe.api_key = settings.STRIPE_API_KEY

            gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
            stripe_customer_id = gerant.get('stripe_customer_id')

            if stripe_customer_id:
                customer_update = {
                    "name": updated_profile["company_name"],
                    "email": updated_profile["billing_email"],
                    "address": {
                        "line1": updated_profile["address_line1"],
                        "line2": updated_profile.get("address_line2"),
                        "postal_code": updated_profile["postal_code"],
                        "city": updated_profile["city"],
                        "country": updated_profile["country_code"]
                    }
                }

                if updated_profile.get("vat_number"):
                    customer_update["tax_ids"] = [{
                        "type": "eu_vat",
                        "value": updated_profile["vat_number"]
                    }]

                stripe.Customer.modify(stripe_customer_id, **customer_update)
                logger.info(f"Stripe Customer {stripe_customer_id} mis à jour")

        except stripe.StripeError as e:
            logger.error(f"Erreur Stripe lors de la mise à jour: {str(e)}")

        return {
            "success": True,
            "message": "Profil de facturation mis à jour avec succès",
            "profile": updated_profile
        }

    except AppException:
        raise
