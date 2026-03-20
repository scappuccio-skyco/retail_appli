"""
Gérant billing-profile routes: GET/POST/PUT /billing-profile.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import stripe
import uuid
import logging

from core.exceptions import AppException, NotFoundError, ValidationError
from core.security import get_current_gerant
from core.config import settings
from services.gerant_service import GerantService
from services.vat_service import validate_vat_number, calculate_vat_rate, is_eu_country
from models.billing import BillingProfileCreate, BillingProfileUpdate
from api.dependencies import get_gerant_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


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
