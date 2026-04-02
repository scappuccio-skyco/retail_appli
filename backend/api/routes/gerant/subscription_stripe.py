"""
Stripe checkout/portal routes: POST /stripe/portal, /stripe/validate-promo, /stripe/checkout
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import stripe
import uuid
import logging

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


class GerantCheckoutRequest(BaseModel):
    """Request body for creating a checkout session"""
    quantity: Optional[int] = None  # Nombre de vendeurs (si None, utiliser le compte actif)
    billing_period: str = "monthly"  # 'monthly' ou 'yearly'
    origin_url: str  # URL d'origine pour les redirections
    promo_code: Optional[str] = None  # Code promo fondateurs (optionnel)


class BillingPortalRequest(BaseModel):
    return_url: str  # URL to redirect back to after the portal session


@router.post("/stripe/portal")
async def create_billing_portal_session(
    data: BillingPortalRequest,
    current_user: dict = Depends(get_current_gerant),
    stripe_client: StripeClient = Depends(get_stripe_client),
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

    try:
        session = stripe_client.create_billing_portal_session(
            customer_id=stripe_customer_id,
            return_url=data.return_url,
        )
        return {"portal_url": session.url}
    except stripe.error.InvalidRequestError as e:
        raise ValidationError(f"Impossible d'ouvrir le portail de facturation : {str(e)}")


@router.post("/stripe/validate-promo")
async def validate_promo_code(
    body: dict,
    current_user: dict = Depends(get_current_gerant),
):
    """Valide un code promo fondateurs (ne révèle pas le code, retourne juste valid/invalid)."""
    code = body.get("promo_code", "").strip().upper()
    founder_code = getattr(settings, 'FOUNDER_PROMO_CODE', None)
    if founder_code and code == founder_code.strip().upper():
        return {"valid": True, "type": "founder"}
    return {"valid": False}


@router.post("/stripe/checkout")
async def create_gerant_checkout_session(
    checkout_data: GerantCheckoutRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    stripe_client: StripeClient = Depends(get_stripe_client),
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
                    stripe_sub = stripe_client.retrieve_subscription(stripe_sub_id)
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
                customer = stripe_client.retrieve_customer(stripe_customer_id)
                if customer.get('deleted'):
                    stripe_customer_id = None
                logger.info(f"Réutilisation du client Stripe: {stripe_customer_id}")
            except stripe.InvalidRequestError:
                stripe_customer_id = None
                logger.warning(f"Client Stripe introuvable, création d'un nouveau")

        if not stripe_customer_id:
            customer = stripe_client.create_customer(
                email=current_user['email'],
                name=current_user['name'],
                metadata={'gerant_id': current_user['id'], 'role': 'gerant'},
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

        # Sélectionner le Price ID selon la période et le code promo fondateurs
        is_monthly = checkout_data.billing_period == 'monthly'
        is_founder = (
            checkout_data.promo_code
            and getattr(settings, 'FOUNDER_PROMO_CODE', None)
            and checkout_data.promo_code.strip().upper() == settings.FOUNDER_PROMO_CODE.strip().upper()
        )
        if is_founder and is_monthly and getattr(settings, 'STRIPE_PRICE_ID_MONTHLY_FONDATEURS', None):
            price_id = settings.STRIPE_PRICE_ID_MONTHLY_FONDATEURS
        elif is_founder and not is_monthly and getattr(settings, 'STRIPE_PRICE_ID_YEARLY_FONDATEURS', None):
            price_id = settings.STRIPE_PRICE_ID_YEARLY_FONDATEURS
        elif is_monthly:
            price_id = settings.STRIPE_PRICE_ID_MONTHLY
        else:
            price_id = settings.STRIPE_PRICE_ID_YEARLY

        if is_founder:
            logger.info(f"[CHECKOUT] Tarif fondateurs appliqué pour gérant {current_user.get('id')}")

        # Vérifier que le price_id est défini
        if not price_id:
            logger.error(f"Price ID manquant pour période={checkout_data.billing_period}, fondateur={is_founder}")
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
            session = stripe_client.create_checkout_session(
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
