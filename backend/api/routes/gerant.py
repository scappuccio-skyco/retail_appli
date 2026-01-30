"""
Gérant-specific Routes
Dashboard stats, subscription status, and workspace management.
Phase 2: Exceptions métier (NotFoundError, ValidationError) ; pas de try/except 500.
"""
from fastapi import APIRouter, Depends, Query, BackgroundTasks, Body
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, Optional
import stripe
import uuid

from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError, BusinessLogicError, UnauthorizedError, ConflictError
from core.security import get_current_gerant, get_gerant_or_manager
from core.config import settings
from services.gerant_service import GerantService
from services.payment_service import PaymentService
from services.vat_service import validate_vat_number, calculate_vat_rate, is_eu_country
from models.billing import BillingProfileCreate, BillingProfileUpdate, BillingProfile, BillingProfileResponse
from api.dependencies import get_gerant_service, get_payment_service
from email_service import send_staff_email_update_confirmation, send_staff_email_update_alert
import logging

logger = logging.getLogger(__name__)

# ==========================================
# STRIPE PRICE CONFIGURATION
# ==========================================
# Single product with tiered pricing (managed by Stripe)
# Price IDs loaded from environment variables via settings

router = APIRouter(prefix="/gerant", tags=["Gérant"])


@router.get("/profile")
async def get_gerant_profile(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Get gérant profile information (name, email, phone, company_name).
    """
    gerant_id = current_user["id"]
    user = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
    if not user:
        raise NotFoundError("Utilisateur non trouvé")
    workspace_id = user.get("workspace_id")
    company_name = None
    if workspace_id:
        workspace = await gerant_service.get_workspace_by_id(workspace_id)
        if workspace:
            company_name = workspace.get("name")
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "company_name": company_name,
        "created_at": user.get("created_at")
    }


@router.put("/profile")
async def update_gerant_profile(
    update_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update gérant profile information.
    Allowed fields: name, email, phone, company_name
    """
    try:
        gerant_id = current_user["id"]
        user = await gerant_service.get_gerant_by_id(gerant_id, include_password=True)
        if not user:
            raise NotFoundError("Utilisateur non trouvé")
        ALLOWED_USER_FIELDS = ["name", "email", "phone"]
        user_updates = {}
        company_name_update = None
        for field in ALLOWED_USER_FIELDS:
            if field in update_data and update_data[field] is not None:
                user_updates[field] = update_data[field]
        if "company_name" in update_data and update_data["company_name"] is not None:
            company_name_update = update_data["company_name"].strip()
            if not company_name_update:
                raise ValidationError("Le nom de l'entreprise ne peut pas être vide")
        old_email = user.get("email", "").lower().strip() if user.get("email") else None
        email_changed = False
        if "email" in user_updates:
            import re
            email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(email_pattern, user_updates["email"]):
                raise ValidationError("Format d'email invalide")
            email_lower = user_updates["email"].lower().strip()
            if old_email and old_email != email_lower:
                email_changed = True
            user_updates["email"] = email_lower
            existing_user = await gerant_service.find_user_by_email(email_lower)
            if existing_user and existing_user.get("id") != gerant_id:
                raise ValidationError("Cet email est déjà utilisé par un autre utilisateur")
        if user_updates:
            user_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            await gerant_service.update_gerant_user_one(gerant_id, user_updates)
        old_company_name = None
        if company_name_update:
            workspace_id = user.get("workspace_id")
            if workspace_id:
                old_workspace = await gerant_service.get_workspace_by_id(workspace_id)
                if old_workspace:
                    old_company_name = old_workspace.get("name")
                await gerant_service.update_workspace_one(
                    workspace_id,
                    {"name": company_name_update, "updated_at": datetime.now(timezone.utc).isoformat()}
                )
                if old_company_name and old_company_name != company_name_update:
                    await gerant_service.log_company_name_change(
                        old_company_name, company_name_update, workspace_id
                    )
                    logger.info("Audit log: Company name changed from '%s' to '%s' by gérant %s", old_company_name, company_name_update, gerant_id)
            else:
                logger.warning("Gérant %s has no workspace_id, cannot update company_name", gerant_id)
        updated_user = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
        workspace_id = updated_user.get("workspace_id") if updated_user else None
        company_name = None
        if workspace_id:
            workspace = await gerant_service.get_workspace_by_id(workspace_id)
            if workspace:
                company_name = workspace.get("name")
        
        # Update Stripe customer email if email changed and customer exists
        if email_changed and old_email:
            stripe_customer_id = user.get('stripe_customer_id')
            if stripe_customer_id:
                try:
                    stripe.Customer.modify(
                        stripe_customer_id,
                        email=user_updates['email']
                    )
                    logger.info(f"Stripe customer {stripe_customer_id} email updated to {user_updates['email']}")
                except stripe.InvalidRequestError as stripe_error:
                    # Customer might not exist in Stripe, log but don't fail
                    logger.warning(f"Failed to update Stripe customer {stripe_customer_id} email: {str(stripe_error)}")
                except Exception as stripe_error:
                    # Other Stripe errors, log but don't fail the request
                    logger.error(f"Error updating Stripe customer email: {str(stripe_error)}", exc_info=True)
        
        logger.info("Gérant profile %s updated", gerant_id)

        return {
            "success": True,
            "message": "Profil mis à jour avec succès",
            "profile": {
                "id": updated_user.get('id'),
                "name": updated_user.get('name'),
                "email": updated_user.get('email'),
                "phone": updated_user.get('phone'),
                "company_name": company_name,
                "created_at": updated_user.get('created_at')
            }
        }
    except AppException:
        raise


@router.put("/profile/change-password")
async def change_gerant_password(
    password_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Change gérant password.
    
    Requires:
    - old_password: Current password for verification
    - new_password: New password (min 8 characters)
    
    Returns:
        Success message
    """
    try:
        from core.security import verify_password, get_password_hash
        
        gerant_id = current_user['id']
        old_password = password_data.get('old_password')
        new_password = password_data.get('new_password')
        
        if not old_password:
            raise ValidationError("L'ancien mot de passe est requis")

        if not new_password:
            raise ValidationError("Le nouveau mot de passe est requis")

        if len(new_password) < 8:
            raise ValidationError("Le nouveau mot de passe doit contenir au moins 8 caractères")
        
        # ✅ PHASE 6: Use UserRepository
        
        # Get current user with password
        user = await gerant_service.get_gerant_by_id(gerant_id, include_password=True)
        
        if not user:
            raise NotFoundError("Utilisateur non trouvé")
        
        # Verify old password
        if not verify_password(old_password, user.get('password', '')):
            raise UnauthorizedError("Ancien mot de passe incorrect")
        
        # Hash new password
        hashed_password = get_password_hash(new_password)
        
        # Update password
        await gerant_service.update_gerant_user_one(
            gerant_id,
            {
                "password": hashed_password,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        logger.info("Password changed for gérant %s", gerant_id)

        return {
            "success": True,
            "message": "Mot de passe modifié avec succès"
        }
    except AppException:
        raise


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get global statistics for gérant dashboard (all stores aggregated)
    
    Returns:
        Dict with total stores, managers, sellers, and monthly KPI aggregations
    """
    stats = await gerant_service.get_dashboard_stats(current_user['id'])
    return stats


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
        
        # RC6: PaymentService via DI (no explicit instantiation)
        # PaymentService will handle multiple active subscriptions check
        
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
        
        logger.info(f"✅ Sièges mis à jour: {result['previous_seats']} → {new_seats} pour {current_user['email']}")
        
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
        
        # ⚠️ SECURITY: No price calculations on server side
        # All pricing is handled by Stripe via tiered pricing
        # We only use Stripe API to get accurate preview amounts
        
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
        
        # ⚠️ SECURITY: No price calculations on server side
        # All pricing is handled by Stripe via tiered pricing
        # We only use Stripe API to get accurate preview amounts
        
        # For display purposes, use generic plan names since Stripe handles tiered pricing
        current_plan = "tiered"
        new_plan = "tiered"
        
        # Get accurate costs from Stripe API (if subscription exists)
        current_monthly_cost = 0.0
        new_monthly_cost = 0.0
        price_difference = 0.0
        
        # ⚠️ SECURITY: Get REAL proration from Stripe API only
        # No server-side price calculations
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
                        # This simulates what would happen WITHOUT actually changing anything
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
                        
                        logger.info(f"✅ Stripe preview retrieved for {current_seats}→{new_seats} seats")
                    else:
                        logger.info(f"ℹ️ No stripe_customer_id for gerant {gerant_id}")
                    
                except stripe.StripeError as e:
                    logger.warning(f"⚠️ Could not get Stripe proration preview: {str(e)}")
                except Exception as e:
                    logger.warning(f"⚠️ Unexpected error in Stripe preview: {str(e)}")
        
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


@router.get("/stores")
async def get_all_stores(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all active stores for the current gérant
    
    Returns:
        List of stores with their details
    """
    stores = await gerant_service.get_all_stores(current_user['id'])
    return stores


@router.post("/stores")
async def create_store(
    store_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Create a new store for the current gérant
    
    Args:
        store_data: {
            "name": "Store Name",
            "location": "City, Postal Code",
            "address": "Full address",
            "phone": "Phone number",
            "opening_hours": "Opening hours"
        }
    """
    try:
        result = await gerant_service.create_store(store_data, current_user['id'])
    except ValueError as e:
        raise ValidationError(str(e))
    return result


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Delete (deactivate) a store
    
    Note: This soft-deletes the store by setting active=False
    """
    try:
        result = await gerant_service.delete_store(store_id, current_user['id'])
        return result
    except ValueError as e:
        raise NotFoundError(str(e))


@router.put("/stores/{store_id}")
async def update_store(
    store_id: str,
    store_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Update store information"""
    try:
        result = await gerant_service.update_store(store_id, store_data, current_user['id'])
    except ValueError as e:
        raise NotFoundError(str(e))
    return result


@router.get("/managers")
async def get_all_managers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all managers (active and suspended, excluding deleted)
    
    Returns:
        List of managers with their details (password excluded)
    """
    try:
        managers = await gerant_service.get_all_managers(current_user['id'])
        return managers
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/sellers")
async def get_all_sellers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all sellers (active and suspended, excluding deleted)
    
    Returns:
        List of sellers with their details (password excluded)
    """
    sellers = await gerant_service.get_all_sellers(current_user['id'])
    return sellers


@router.get("/stores/{store_id}/stats")
async def get_store_stats(
    store_id: str,
    period_type: str = Query('week', regex='^(week|month|year)$'),
    period_offset: int = Query(0, ge=-52, le=52),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get detailed statistics for a specific store
    
    Args:
        store_id: Store ID
        period_type: 'week', 'month', or 'year'
        period_offset: Number of periods to offset (0=current, -1=previous, +1=next)
        
    Returns:
        Dict with store stats, period KPIs, evolution, team counts
    """
    try:
        stats = await gerant_service.get_store_stats(
            store_id=store_id,
            gerant_id=current_user['id'],
            period_type=period_type,
            period_offset=period_offset
        )
        return stats
    except ValueError as e:
        raise NotFoundError(str(e))



# ===== STORE DETAIL ROUTES (CRITICAL FOR FRONTEND) =====

@router.get("/stores/{store_id}/managers")
async def get_store_managers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all managers for a specific store"""
    return await gerant_service.get_store_managers(store_id, current_user['id'])




@router.get("/stores/{store_id}/sellers")
async def get_store_sellers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all sellers for a specific store"""
    return await gerant_service.get_store_sellers(store_id, current_user['id'])


@router.put("/staff/{user_id}")
async def update_staff_member(
    user_id: str,
    update_data: Dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update staff member information (manager or seller).
    
    Allowed fields: name, email, phone
    Security: Only gérant can update their own staff members
    
    If email is changed:
    - Sends confirmation email to new address (synchronous)
    - Sends alert email to old address (background task)
    """
    try:
        # ✅ PHASE 6: Use UserRepository
        
        # Find the user
        user = await gerant_service.get_user_by_id(user_id, include_password=True)
        
        if not user:
            raise NotFoundError("Utilisateur non trouvé")
        
        # Security: Verify the user belongs to the gérant
        user_gerant_id = user.get('gerant_id')
        if not user_gerant_id or user_gerant_id != current_user['id']:
            raise ForbiddenError("Vous n'avez pas l'autorisation de modifier cet utilisateur")
        
        # Verify role is manager or seller
        user_role = user.get('role')
        if user_role not in ['manager', 'seller']:
            raise ValidationError("Seuls les managers et vendeurs peuvent être modifiés via cet endpoint")
        
        # Store old email before update (for email notifications)
        old_email = user.get('email', '').lower().strip() if user.get('email') else None
        user_name = user.get('name', 'Utilisateur')
        gerant_name = current_user.get('name', 'Votre gérant')
        
        # Whitelist allowed fields
        ALLOWED_FIELDS = ['name', 'email', 'phone']
        updates = {}
        
        for field in ALLOWED_FIELDS:
            if field in update_data and update_data[field] is not None:
                updates[field] = update_data[field]
        
        if not updates:
            raise ValidationError("Aucun champ valide à mettre à jour")
        
        # Validate email format if provided
        email_changed = False
        new_email = None
        
        if 'email' in updates:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, updates['email']):
                raise ValidationError("Format d'email invalide")
            
            # Normalize email to lowercase for consistency and uniqueness check
            email_lower = updates['email'].lower().strip()
            new_email = email_lower
            
            # Check if email has actually changed
            if old_email and old_email != email_lower:
                email_changed = True
            
            updates['email'] = email_lower  # Store normalized email
            
            # ✅ PHASE 6: Use repository method for email check
            existing_user = await gerant_service.find_user_by_email(email_lower)
            if existing_user and existing_user.get('id') != user_id:
                raise ValidationError("Cet email est déjà utilisé par un autre utilisateur")
        
        # Add updated_at timestamp
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Update user
        await gerant_service.update_user_one(user_id, updates)
        
        # Fetch updated user
        updated_user = await gerant_service.get_user_by_id(user_id, include_password=False)
        
        # Send email notifications if email was changed
        if email_changed and new_email and old_email:
            try:
                # Send confirmation email to new address (synchronous - important)
                send_staff_email_update_confirmation(
                    recipient_email=new_email,
                    recipient_name=user_name,
                    new_email=new_email
                )
                logger.info(f"Email confirmation sent to new address {new_email} for user {user_id}")
                
                # Send alert email to old address (background task - non-blocking)
                background_tasks.add_task(
                    send_staff_email_update_alert,
                    recipient_email=old_email,
                    recipient_name=user_name,
                    new_email=new_email,
                    gerant_name=gerant_name
                )
                logger.info(f"Email alert scheduled for old address {old_email} for user {user_id}")
            except Exception as email_error:
                # Log error but don't fail the request
                logger.error(f"Error sending email notifications for user {user_id}: {str(email_error)}", exc_info=True)
        
        logger.info(f"Staff member {user_id} updated by gérant {current_user['id']}")
        
        return {
            "success": True,
            "message": "Informations mises à jour avec succès",
            "user": {
                "id": updated_user['id'],
                "name": updated_user.get('name'),
                "email": updated_user.get('email'),
                "phone": updated_user.get('phone'),
                "role": updated_user.get('role'),
                "store_id": updated_user.get('store_id'),
                "status": updated_user.get('status')
            }
        }
        
    except AppException:
        raise
    except (AppException,):
        raise


@router.get("/stores/{store_id}/kpi-overview")
async def get_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get consolidated store KPI overview for a specific date"""
    user_id = current_user['id']
    return await gerant_service.get_store_kpi_overview(store_id, user_id, date)


@router.get("/stores/{store_id}/kpi-history")
async def get_store_kpi_history(
    store_id: str,
    days: int = 30,
    start_date: str = None,
    end_date: str = None,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get historical KPI data for a specific store
    
    Args:
        store_id: Store identifier
        days: Number of days to retrieve (default: 30) - used if no dates provided
        start_date: Start date in YYYY-MM-DD format (optional)
        end_date: End date in YYYY-MM-DD format (optional)
    
    Returns:
        List of daily aggregated KPI data sorted by date
    
    Security: Accessible to gérants and managers
    """
    try:
        user_id = current_user['id']
        return await gerant_service.get_store_kpi_history(
            store_id, user_id, days, start_date, end_date
        )
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get available years with KPI data for this store
    
    Returns list of years (integers) in descending order (most recent first)
    Used for date filter dropdowns in the frontend
    
    Security: Accessible to gérants and managers
    """
    try:
        user_id = current_user['id']
        return await gerant_service.get_store_available_years(store_id, user_id)
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/stores/{store_id}/kpi-dates")
async def get_store_kpi_dates(
    store_id: str,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Get dates with KPI data for this store
    
    Returns list of dates (YYYY-MM-DD strings) where KPI data exists
    Used for calendar highlighting in the frontend
    """
    try:
        # Get all distinct dates with KPI data for this store
        pipeline = [
            {"$match": {"store_id": store_id}},
            {"$group": {"_id": "$date"}},
            {"$sort": {"_id": -1}},
            {"$limit": 365}  # Last year of dates
        ]
        
        # ✅ MIGRÉ: Limite à 365 jours (agrégation, pas besoin de pagination)
        results = await gerant_service.aggregate_kpi(pipeline, max_results=365)
        dates = [r['_id'] for r in results if r['_id']]
        
        return {"dates": dates}


# ===== MANAGER MANAGEMENT ROUTES =====

@router.post("/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str,
    transfer_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Transfer a manager to another store
    
    Args:
        manager_id: Manager user ID
        transfer_data: {
            "new_store_id": "store_uuid"
        }
    """
    try:
        return await gerant_service.transfer_manager_to_store(
            manager_id, transfer_data, current_user['id']
        )
    except ValueError as e:
        raise ValidationError(str(e))


# ===== SELLER MANAGEMENT ROUTES =====

@router.post("/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    transfer_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Transfer a seller to another store with a new manager
    
    Args:
        seller_id: Seller user ID
        transfer_data: {
            "new_store_id": "store_uuid",
            "new_manager_id": "manager_uuid"
        }
    
    Security:
        - Verifies seller belongs to current gérant
        - Verifies new store belongs to current gérant
        - Verifies new store is active
        - Verifies new manager exists in new store
    
    Auto-reactivation:
        - If seller was suspended due to inactive store, automatically reactivates
    """
    try:
        return await gerant_service.transfer_seller_to_store(
            seller_id, transfer_data, current_user['id']
        )
    except ValueError as e:
        # Determine appropriate status code based on error message
        error_msg = str(e)
        if "Invalid transfer data" in error_msg:
            raise ValidationError(error_msg)
        elif "inactif" in error_msg:
            raise ValidationError(error_msg)
        else:
            raise NotFoundError(error_msg)


# ===== INVITATION ROUTES =====

@router.post("/invitations")
async def send_invitation(
    invitation_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Send an invitation to a new manager or seller.
    
    Args:
        invitation_data: {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "manager" | "seller",
            "store_id": "store_uuid"
        }
    """
    try:
        result = await gerant_service.send_invitation(
            invitation_data, current_user['id']
        )
        return result
    except ValueError as e:
        raise ValidationError(str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all invitations sent by this gérant"""
    try:
        return await gerant_service.get_invitations(current_user['id'])


@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Cancel a pending invitation"""
    try:
        return await gerant_service.cancel_invitation(invitation_id, current_user['id'])
    except ValueError as e:
        raise NotFoundError(str(e))


@router.post("/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Resend an invitation email"""
    try:
        return await gerant_service.resend_invitation(invitation_id, current_user['id'])
    except ValueError as e:
        raise ValidationError(str(e))


# ===== MANAGER SUSPEND/REACTIVATE/DELETE ROUTES =====

@router.patch("/managers/{manager_id}/suspend")
async def suspend_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Suspend a manager"""
    try:
        return await gerant_service.suspend_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.patch("/managers/{manager_id}/reactivate")
async def reactivate_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Reactivate a suspended manager"""
    try:
        return await gerant_service.reactivate_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.delete("/managers/{manager_id}")
async def delete_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Soft delete a manager (set status to 'deleted')"""
    try:
        return await gerant_service.delete_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


# ===== SELLER SUSPEND/REACTIVATE/DELETE ROUTES =====

@router.patch("/sellers/{seller_id}/suspend")
async def suspend_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Suspend a seller"""
    try:
        return await gerant_service.suspend_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.patch("/sellers/{seller_id}/reactivate")
async def reactivate_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Reactivate a suspended seller"""
    try:
        return await gerant_service.reactivate_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.delete("/sellers/{seller_id}")
async def delete_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Soft delete a seller (set status to 'deleted')"""
    try:
        return await gerant_service.delete_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))



# ===== STRIPE CHECKOUT =====

from pydantic import BaseModel
from typing import Optional
import stripe
import logging

logger = logging.getLogger(__name__)

class GerantCheckoutRequest(BaseModel):
    """Request body for creating a checkout session"""
    quantity: Optional[int] = None  # Nombre de vendeurs (si None, utiliser le compte actif)
    billing_period: str = "monthly"  # 'monthly' ou 'yearly'
    origin_url: str  # URL d'origine pour les redirections


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
    
    ⚠️ VALIDATION FISCALE B2B:
    - Le profil de facturation DOIT être complet avant tout paiement
    - Blocage si champs obligatoires manquants
    - Blocage si VAT number UE invalide
    
    ✅ ACCESSIBILITÉ:
    - Cette route est accessible même si trial_expired (c'est pour souscrire)
    - Pas de vérification require_active_space() car c'est justement pour créer un abonnement
    """
    logger.info(f"🔵 [CHECKOUT] Début création session pour gérant {current_user.get('id')}, période: {checkout_data.billing_period}")
    try:
        # ✅ LOGGING PRÉCOCE: Capturer toute erreur dès le début
        logger.info(f"🔵 [CHECKOUT] Vérification STRIPE_API_KEY...")
        if not settings.STRIPE_API_KEY:
            logger.error("❌ [CHECKOUT] STRIPE_API_KEY manquante")
            raise BusinessLogicError("Configuration Stripe manquante")
        logger.info(f"✅ [CHECKOUT] STRIPE_API_KEY présente")
        
        # ✅ PHASE 6: Use BillingProfileRepository
        # 🔒 VALIDATION FISCALE B2B: Vérifier que le profil de facturation est complet
        logger.info(f"🔵 [CHECKOUT] Recherche profil de facturation pour gérant {current_user['id']}...")
        billing_profile = await gerant_service.get_billing_profile_by_gerant(current_user['id'])
        logger.info(f"🔵 [CHECKOUT] Profil de facturation trouvé: {billing_profile is not None}")
        
        if not billing_profile or not billing_profile.get('billing_profile_completed'):
            logger.warning(f"⚠️ [CHECKOUT] Profil de facturation incomplet pour gérant {current_user['id']}")
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
        
        logger.info(f"✅ Profil de facturation validé pour gérant {current_user['id']} avant checkout")
        
        stripe.api_key = settings.STRIPE_API_KEY
        
        # ✅ PHASE 6: Use UserRepository (déjà initialisé plus haut)
        # Compter les vendeurs ACTIFS uniquement
        active_sellers_count = await gerant_service.count_active_sellers_for_gerant(current_user['id'])
        logger.info(f"✅ [CHECKOUT] Vendeurs actifs: {active_sellers_count}")
        
        # Utiliser la quantité fournie ou celle calculée
        quantity = checkout_data.quantity if checkout_data.quantity else active_sellers_count
        logger.info(f"🔵 [CHECKOUT] Quantité finale: {quantity}")
        quantity = max(quantity, 1)  # Minimum 1 vendeur
        
        # 🔒 Validation des limites : bloquer si > 15 vendeurs
        if quantity > 15:
            raise ValidationError("Au-delà de 15 vendeurs, veuillez nous contacter pour un devis personnalisé.")
        
        # Vérifier si le gérant a déjà un customer ID Stripe
        gerant = await gerant_service.get_gerant_by_id(current_user['id'], include_password=False)
        if not gerant:
            logger.error(f"❌ Gérant {current_user['id']} non trouvé dans la base de données")
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
                    f"⚠️ MULTIPLE ACTIVE SUBSCRIPTIONS detected for user {current_user['id']}: "
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
        # Stripe gère automatiquement la tarification par paliers selon la quantité
        if checkout_data.billing_period == 'monthly':
            price_id = settings.STRIPE_PRICE_ID_MONTHLY
        else:
            price_id = settings.STRIPE_PRICE_ID_YEARLY
        
        # ✅ VALIDATION: Vérifier que le price_id est défini
        if not price_id:
            logger.error(f"❌ STRIPE_PRICE_ID_{'MONTHLY' if checkout_data.billing_period == 'monthly' else 'YEARLY'} non configuré")
            raise BusinessLogicError(f"Configuration Stripe incomplète: Price ID manquant pour la période {checkout_data.billing_period}")
        
        billing_interval = 'month' if checkout_data.billing_period == 'monthly' else 'year'
        
        # ✅ VALIDATION: Vérifier que origin_url est fourni
        if not checkout_data.origin_url or not checkout_data.origin_url.strip():
            logger.error("❌ origin_url manquant dans checkout_data")
            raise ValidationError("URL d'origine requise pour créer la session de checkout")
        
        # Generate correlation_id (unique per checkout attempt)
        import uuid
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
            logger.error(f"❌ Erreur Stripe InvalidRequestError: {str(e)}")
            raise ValidationError(f"Erreur lors de la création de la session Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"❌ Erreur Stripe: {str(e)}")
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


# ===== BULK IMPORT STORES (Fusion Enterprise → Gérant) =====

from typing import List

class BulkStoreImportRequest(BaseModel):
    """Request body pour l'import massif de magasins"""
    stores: List[Dict]  # Liste de {name, location, address, phone, external_id}
    mode: str = "create_or_update"  # "create_only" | "update_only" | "create_or_update"

class BulkImportResponse(BaseModel):
    """Response de l'import massif"""
    success: bool
    total_processed: int
    created: int
    updated: int
    failed: int
    errors: List[Dict] = []


@router.post("/stores/import-bulk", response_model=BulkImportResponse)
async def bulk_import_stores(
    request: BulkStoreImportRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Import massif de magasins pour un Gérant.
    
    Cette fonctionnalité était auparavant réservée à l'espace Enterprise.
    Elle permet d'importer plusieurs magasins en une seule opération.
    
    Sécurité:
    - Réservé aux Gérants avec abonnement actif
    - Option future: limiter aux comptes avec flag 'can_bulk_import'
    
    Modes disponibles:
    - create_only: Ne crée que les nouveaux magasins
    - update_only: Ne met à jour que les magasins existants
    - create_or_update: Crée ou met à jour selon l'existence
    
    Exemple de payload:
    ```json
    {
        "stores": [
            {"name": "Magasin Paris", "location": "Paris", "address": "123 rue..."},
            {"name": "Magasin Lyon", "location": "Lyon"}
        ],
        "mode": "create_or_update"
    }
    ```
    """
    try:
        # Vérifier que le gérant a un workspace
        workspace_id = current_user.get('workspace_id')
        if not workspace_id:
            raise ValidationError("Aucun espace de travail associé. Créez d'abord un magasin manuellement.")
        
        # Validation du mode
        if request.mode not in ["create_only", "update_only", "create_or_update"]:
            raise ValidationError("Mode invalide. Utilisez: create_only, update_only, ou create_or_update")
        
        # Validation des données
        if not request.stores:
            raise ValidationError("La liste des magasins est vide")
        
        if len(request.stores) > 500:
            raise ValidationError("Maximum 500 magasins par import. Divisez votre fichier.")
        
        # Exécuter l'import
        results = await gerant_service.bulk_import_stores(
            gerant_id=current_user['id'],
            workspace_id=workspace_id,
            stores=request.stores,
            mode=request.mode
        )
        
        logger.info(f"✅ Import massif par {current_user['email']}: {results['created']} créés, {results['updated']} mis à jour, {results['failed']} échecs")
        
        return BulkImportResponse(
            success=results['failed'] == 0,
            total_processed=results['total_processed'],
            created=results['created'],
            updated=results['updated'],
            failed=results['failed'],
            errors=results['errors'][:20]  # Limiter les erreurs retournées
        )


# === SUPPORT CONTACT ===

class SupportMessageRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"  # general, bug, feature, billing

class SupportMessageResponse(BaseModel):
    success: bool
    message: str

@router.post("/support/contact", response_model=SupportMessageResponse)
async def send_support_message(
    request: SupportMessageRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Send a support message from the gérant to the support team.
    The message is sent via Brevo to hello@retailperformerai.com
    """
    import httpx
    
    try:
        # Validate input
        if not request.subject.strip():
            raise ValidationError("Le sujet est requis")
        if not request.message.strip():
            raise ValidationError("Le message est requis")
        if len(request.message) > 5000:
            raise ValidationError("Le message est trop long (max 5000 caractères)")
        
        # Get user info
        user_email = current_user.get('email', 'inconnu')
        user_name = current_user.get('name', 'Gérant')
        user_id = current_user.get('id', 'N/A')
        
        workspace_id = current_user.get('workspace_id')
        workspace = await gerant_service.get_workspace_by_id(workspace_id) if workspace_id else None
        workspace_name = workspace.get('name', 'N/A') if workspace else 'N/A'
        
        subscription = await gerant_service.get_subscription_by_user(user_id)
        sub_info = f"{subscription.get('plan', 'N/A')} - {subscription.get('status', 'N/A')} ({subscription.get('seats', 0)} sièges)" if subscription else "Aucun"
        
        # Category labels
        category_labels = {
            "general": "Question générale",
            "bug": "🐛 Bug / Problème technique",
            "feature": "💡 Suggestion / Nouvelle fonctionnalité",
            "billing": "💳 Facturation / Abonnement"
        }
        category_label = category_labels.get(request.category, "Question générale")
        
        # Build email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">📬 Nouveau message support</h1>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
                    <h2 style="color: #1f2937; border-bottom: 2px solid #f97316; padding-bottom: 10px;">
                        {category_label}
                    </h2>
                    
                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 120px;">👤 Expéditeur:</td>
                            <td style="padding: 8px 0; font-weight: bold;">{user_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">📧 Email:</td>
                            <td style="padding: 8px 0;"><a href="mailto:{user_email}">{user_email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">🏢 Enseigne:</td>
                            <td style="padding: 8px 0;">{workspace_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">📋 Abonnement:</td>
                            <td style="padding: 8px 0;">{sub_info}</td>
                        </tr>
                    </table>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316;">
                        <h3 style="color: #374151; margin-top: 0;">📝 Sujet: {request.subject}</h3>
                        <div style="white-space: pre-wrap; color: #4b5563;">{request.message}</div>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 10px 10px; font-size: 12px;">
                    <p style="margin: 0;">ID Utilisateur: {user_id}</p>
                    <p style="margin: 5px 0 0 0;">Envoyé depuis Retail Performer AI - Dashboard Gérant</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Get Brevo API key
        brevo_api_key = settings.BREVO_API_KEY
        if not brevo_api_key:
            logger.error("BREVO_API_KEY not configured")
            raise ValidationError("Service email non configuré")
        
        # Send email via Brevo
        payload = {
            "sender": {
                "name": f"Support - {user_name}",
                "email": "noreply@retailperformerai.com"
            },
            "to": [
                {"email": "hello@retailperformerai.com", "name": "Support Retail Performer"}
            ],
            "replyTo": {
                "email": user_email,
                "name": user_name
            },
            "subject": f"[{category_label}] {request.subject}",
            "htmlContent": html_content
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ Support message sent from {user_email}: {request.subject}")
                return SupportMessageResponse(
                    success=True,
                    message="Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais."
                )
            else:
                logger.error(f"❌ Brevo API error ({response.status_code}): {response.text}")
                raise ValidationError("Erreur lors de l'envoi du message")
                
    except AppException:
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
        
        # ⚠️ SECURITY: No price calculations on server side
        # All pricing is handled by Stripe via tiered pricing
        # Get accurate costs from Stripe API if subscription exists
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
            
            logger.info(f"✅ Trial user {current_user['email']} switched to {new_interval} (no Stripe call)")
            
        elif stripe_subscription_id and stripe_subscription_item_id:
            # Active subscriber - call Stripe API
            STRIPE_API_KEY = settings.STRIPE_API_KEY
            if not STRIPE_API_KEY:
                raise ValidationError("Configuration Stripe manquante")
            
            stripe.api_key = STRIPE_API_KEY
            
            try:
                # Get new price ID based on interval (using new simplified structure)
                new_price_id = settings.STRIPE_PRICE_ID_YEARLY if new_interval == 'year' else settings.STRIPE_PRICE_ID_MONTHLY
                
                # CRITICAL: Modify subscription with new price
                # This changes the billing interval while keeping the quantity
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
                
                logger.info(f"✅ Stripe subscription {stripe_subscription_id} switched to {new_interval}")
                
                # ⚠️ SECURITY: Get proration from Stripe API only (no server-side calculation)
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
                logger.error(f"❌ Stripe error: {str(e)}")
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
        
        message = f"🎉 Passage à l'abonnement {interval_label} réussi !"
        if new_interval == 'year':
            message += " Vous bénéficiez d'une réduction avec l'abonnement annuel."
        
        logger.info(f"✅ {current_user['email']} switched from {current_interval} to {new_interval}")
        
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
        
        # ✅ MIGRÉ: Limite à 10 pour validation (pas besoin de pagination complète)
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
                        f"⚠️ MULTIPLE ACTIVE SUBSCRIPTIONS for {current_user['email']}: {len(active_subscriptions)}. "
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
                    f"⚠️ MULTIPLE ACTIVE SUBSCRIPTIONS for {current_user['email']}: {len(active_subscriptions)}. "
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
        # IDEMPOTENCE: Use stripe_subscription_id as key
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
            
            logger.info(f"✅ Trial subscription canceled for {current_user['email']}")
            
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
                
                # ✅ PHASE 6: Use repositories
                # Update database - IDEMPOTENCE: Use stripe_subscription_id as key
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
                
                logger.info(f"✅ Subscription {stripe_subscription_id} canceled immediately for {current_user['email']}")
                
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
                
                logger.info(f"✅ Subscription {stripe_subscription_id} scheduled for cancellation at period end for {current_user['email']}")
                
                period_end_str = period_end[:10] if period_end else "fin de période"
                
                return {
                    "success": True,
                    "message": f"Abonnement programmé pour annulation. Vous conservez l'accès jusqu'au {period_end_str}.",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "cancel_at_period_end": True,
                    "period_end": period_end
                }
                
        except stripe.InvalidRequestError as e:
            logger.error(f"❌ Stripe error canceling subscription: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"❌ Stripe error: {str(e)}")
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
            # Support mode: allow explicit targeting or auto-selection
            if request.support_mode or request.stripe_subscription_id:
                if request.stripe_subscription_id:
                    # Explicitly target the specified subscription
                    subscription = next(
                        (s for s in scheduled_subscriptions if s.get('stripe_subscription_id') == request.stripe_subscription_id),
                        None
                    )
                    if not subscription:
                        raise NotFoundError(f"Abonnement {request.stripe_subscription_id} non trouvé parmi les abonnements programmés pour annulation")
                else:
                    # Auto-select most recent (support mode)
                    subscription = max(
                        scheduled_subscriptions,
                        key=lambda s: (
                            s.get('current_period_end', '') or s.get('created_at', ''),
                            s.get('status') == 'active'  # Prefer active over trialing
                        )
                    )
                    logger.warning(
                        f"⚠️ MULTIPLE SCHEDULED SUBSCRIPTIONS for {current_user['email']}: {len(scheduled_subscriptions)}. "
                        f"Support mode: auto-selected {subscription.get('stripe_subscription_id')}"
                    )
            else:
                # DEFAULT: Return 409 with list (production-safe)
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
                    f"⚠️ MULTIPLE SCHEDULED SUBSCRIPTIONS for {current_user['email']}: {len(scheduled_subscriptions)}. "
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
            
            logger.info(f"✅ Trial subscription reactivated for {current_user['email']} (no Stripe call)")
            
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
            
            logger.info(f"✅ Stripe subscription {stripe_subscription_id} reactivated for {current_user['email']}")
            
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
            
            logger.info(f"✅ Subscription reactivated successfully for {current_user['email']}")
            
            return ReactivateSubscriptionResponse(
                success=True,
                message="Abonnement réactivé avec succès. L'annulation programmée a été annulée.",
                subscription=updated_subscription,
                reactivated_at=datetime.now(timezone.utc).isoformat()
            )
            
        except stripe.InvalidRequestError as e:
            logger.error(f"❌ Stripe error reactivating subscription: {str(e)}")
            raise ValidationError(f"Erreur Stripe: {str(e)}")
        except stripe.StripeError as e:
            logger.error(f"❌ Stripe error: {str(e)}")
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
            "warning": f"⚠️ {active_count} abonnement(s) actif(s) détecté(s)" if active_count > 1 else None
        }
        


@router.get("/subscription/audit")
async def audit_subscription(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    🔍 Endpoint d'audit pour diagnostic rapide des problèmes d'abonnement.
    
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
            # Check if all subscriptions have required metadata for safe cancellation
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
        # ✅ PHASE 6: Use BillingProfileRepository
        billing_profile = await gerant_service.get_billing_profile_by_gerant(current_user['id'])
        
        if not billing_profile:
            return {"exists": False, "profile": None}
        
        return {"exists": True, "profile": billing_profile}


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
            # Le profil sera créé et Stripe pourra être mis à jour plus tard
        
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
        
        # ✅ PHASE 6: Use BillingProfileRepository
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
