"""
Gérant-specific Routes
Dashboard stats, subscription status, and workspace management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, Optional
import os
import stripe

from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service, get_db
import logging

logger = logging.getLogger(__name__)

# ==========================================
# STRIPE PRICE CONFIGURATION
# ==========================================
# Ces Price IDs correspondent aux produits Stripe configurés
# Ils peuvent être surchargés par les variables d'environnement
STRIPE_PRICES = {
    # Prix par siège/mois selon le palier
    "starter": {
        "monthly": os.environ.get("STRIPE_PRICE_STARTER_MONTHLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX"),
        "yearly": os.environ.get("STRIPE_PRICE_STARTER_YEARLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX_yearly"),
        "price_monthly": 29,
        "price_yearly": 278,  # 29 * 12 * 0.8 = 278.40 arrondi
    },
    "professional": {
        "monthly": os.environ.get("STRIPE_PRICE_PRO_MONTHLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX"),
        "yearly": os.environ.get("STRIPE_PRICE_PRO_YEARLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX_yearly"),
        "price_monthly": 25,
        "price_yearly": 240,  # 25 * 12 * 0.8 = 240
    },
    "enterprise": {
        "monthly": os.environ.get("STRIPE_PRICE_ENTERPRISE_MONTHLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX"),
        "yearly": os.environ.get("STRIPE_PRICE_ENTERPRISE_YEARLY", "price_1SS2XxIVM4C8dIGvpBRcYSNX_yearly"),
        "price_monthly": 22,
        "price_yearly": 211,  # 22 * 12 * 0.8 = 211.20 arrondi
    }
}

def get_plan_from_seats(seats: int) -> str:
    """Determine plan tier based on seat count"""
    if seats <= 5:
        return "starter"
    elif seats <= 15:
        return "professional"
    else:
        return "enterprise"

router = APIRouter(prefix="/gerant", tags=["Gérant"])


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
    try:
        stats = await gerant_service.get_dashboard_stats(current_user['id'])
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        status = await gerant_service.get_subscription_status(current_user['id'])
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateSeatsRequest(BaseModel):
    """Request body for updating subscription seats"""
    seats: int


@router.post("/subscription/update-seats")
async def update_subscription_seats(
    request: UpdateSeatsRequest,
    current_user: dict = Depends(get_current_gerant),
    db = Depends(get_db)
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
    from services.payment_service import PaymentService
    
    try:
        gerant_id = current_user['id']
        new_seats = request.seats
        
        # Validate seats count
        if new_seats < 1:
            raise HTTPException(status_code=400, detail="Le nombre de sièges doit être au moins 1")
        if new_seats > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 sièges. Contactez-nous pour un plan Enterprise.")
        
        # Get current subscription to check if trial
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Aucun abonnement trouvé")
        
        is_trial = subscription.get('status') == 'trialing'
        
        # Use PaymentService for atomic Stripe + DB update
        payment_service = PaymentService(db)
        result = await payment_service.update_subscription_seats(
            gerant_id=gerant_id,
            new_seats=new_seats,
            is_trial=is_trial
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
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur mise à jour sièges: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")


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
    db = Depends(get_db)
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
        
        # Get current subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Aucun abonnement trouvé")
        
        # Current values
        current_seats = subscription.get('seats', 1)
        current_interval = subscription.get('billing_interval', 'month')
        is_trial = subscription.get('status') == 'trialing'
        
        # New values (default to current if not specified)
        new_seats = request.new_seats if request.new_seats is not None else current_seats
        new_interval = request.new_interval if request.new_interval else current_interval
        
        # Validate
        if new_seats < 1:
            raise HTTPException(status_code=400, detail="Minimum 1 siège")
        if new_seats > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 sièges")
        if new_interval not in ['month', 'year']:
            raise HTTPException(status_code=400, detail="Intervalle invalide (month ou year)")
        
        # Block downgrade from annual to monthly
        if current_interval == 'year' and new_interval == 'month':
            raise HTTPException(
                status_code=400, 
                detail="Impossible de passer de l'annuel au mensuel. Pour changer, annulez votre abonnement actuel."
            )
        
        interval_changing = current_interval != new_interval
        
        # Get plan info
        current_plan = get_plan_from_seats(current_seats)
        new_plan = get_plan_from_seats(new_seats)
        
        current_prices = STRIPE_PRICES[current_plan]
        new_prices = STRIPE_PRICES[new_plan]
        
        # Calculate costs
        current_price_monthly = current_prices['price_monthly']
        new_price_monthly = new_prices['price_monthly']
        
        # Monthly costs
        current_monthly_cost = current_seats * current_price_monthly
        new_monthly_cost = new_seats * new_price_monthly
        
        # Yearly costs (with 20% discount)
        current_yearly_cost = current_monthly_cost * 12 * 0.8
        new_yearly_cost = new_monthly_cost * 12 * 0.8
        
        # Calculate what they'll actually pay based on interval
        if new_interval == 'year':
            effective_new_cost = new_yearly_cost
            effective_current_cost = current_yearly_cost if current_interval == 'year' else current_monthly_cost * 12
        else:
            effective_new_cost = new_monthly_cost
            effective_current_cost = current_monthly_cost
        
        # Proration calculation
        proration_estimate = 0.0
        proration_description = ""
        
        if is_trial:
            proration_description = "Aucun frais pendant la période d'essai"
        elif interval_changing and new_interval == 'year':
            # Upgrading to annual: credit remaining month + charge full year
            # Simplified: charge (annual - remaining_month_credit)
            if subscription.get('current_period_end'):
                try:
                    period_end_str = subscription['current_period_end']
                    if isinstance(period_end_str, str):
                        if '+' not in period_end_str and 'Z' not in period_end_str:
                            period_end = datetime.fromisoformat(period_end_str).replace(tzinfo=timezone.utc)
                        else:
                            period_end = datetime.fromisoformat(period_end_str.replace('Z', '+00:00'))
                    else:
                        period_end = period_end_str
                        if period_end.tzinfo is None:
                            period_end = period_end.replace(tzinfo=timezone.utc)
                    
                    now = datetime.now(timezone.utc)
                    days_remaining = max(0, (period_end - now).days)
                    
                    # Credit for remaining days
                    daily_rate_current = current_monthly_cost / 30
                    credit = daily_rate_current * days_remaining
                    
                    # Charge for new annual
                    proration_estimate = round(new_yearly_cost - credit, 2)
                    proration_description = f"Crédit de {credit:.2f}€ déduit du coût annuel de {new_yearly_cost:.2f}€"
                except Exception as e:
                    logger.warning(f"Error calculating proration: {e}")
                    proration_estimate = new_yearly_cost
                    proration_description = f"Coût annuel: {new_yearly_cost:.2f}€"
            else:
                proration_estimate = new_yearly_cost
                proration_description = f"Coût annuel: {new_yearly_cost:.2f}€"
        elif new_seats > current_seats:
            # Adding seats
            if subscription.get('current_period_end'):
                try:
                    period_end_str = subscription['current_period_end']
                    if isinstance(period_end_str, str):
                        if '+' not in period_end_str and 'Z' not in period_end_str:
                            period_end = datetime.fromisoformat(period_end_str).replace(tzinfo=timezone.utc)
                        else:
                            period_end = datetime.fromisoformat(period_end_str.replace('Z', '+00:00'))
                    else:
                        period_end = period_end_str
                        if period_end.tzinfo is None:
                            period_end = period_end.replace(tzinfo=timezone.utc)
                    
                    now = datetime.now(timezone.utc)
                    days_remaining = max(0, (period_end - now).days)
                    daily_rate = new_price_monthly / 30
                    proration_estimate = round((new_seats - current_seats) * daily_rate * days_remaining, 2)
                    proration_description = f"Prorata pour {new_seats - current_seats} siège(s) sur {days_remaining} jours"
                except Exception:
                    pass
        
        # Annual savings
        annual_savings_percent = 20.0  # Fixed 20% discount
        
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
            price_difference_monthly=new_monthly_cost - current_monthly_cost,
            price_difference_yearly=new_yearly_cost - current_yearly_cost,
            proration_estimate=proration_estimate,
            proration_description=proration_description,
            is_upgrade=(new_seats > current_seats) or (new_interval == 'year' and current_interval == 'month'),
            is_trial=is_trial,
            annual_savings_percent=annual_savings_percent
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in preview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seats/preview", response_model=PreviewSeatsResponse)
async def preview_seat_change(
    request: PreviewSeatsRequest,
    current_user: dict = Depends(get_current_gerant),
    db = Depends(get_db)
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
            raise HTTPException(status_code=400, detail="Le nombre de sièges doit être au moins 1")
        if new_seats > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 sièges")
        
        # Get current subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Aucun abonnement trouvé")
        
        current_seats = subscription.get('seats', 1)
        is_trial = subscription.get('status') == 'trialing'
        stripe_subscription_id = subscription.get('stripe_subscription_id')
        stripe_subscription_item_id = subscription.get('stripe_subscription_item_id')
        
        # Calculate current plan/cost
        def get_plan_info(seats):
            if seats <= 5:
                return 'starter', 29
            elif seats <= 15:
                return 'professional', 25
            else:
                return 'enterprise', 22
        
        current_plan, current_price = get_plan_info(current_seats)
        new_plan, new_price = get_plan_info(new_seats)
        
        current_monthly_cost = current_seats * current_price
        new_monthly_cost = new_seats * new_price
        price_difference = new_monthly_cost - current_monthly_cost
        
        # Get REAL proration from Stripe (not estimated)
        proration_estimate = 0.0
        stripe_preview_success = False
        
        if not is_trial and new_seats > current_seats and stripe_subscription_id and stripe_subscription_item_id:
            STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
            if STRIPE_API_KEY:
                try:
                    stripe.api_key = STRIPE_API_KEY
                    
                    # Get customer_id from user
                    gerant = await db.users.find_one({"id": gerant_id}, {"_id": 0, "stripe_customer_id": 1})
                    stripe_customer_id = gerant.get('stripe_customer_id') if gerant else None
                    
                    if stripe_customer_id:
                        # Call Stripe's Invoice preview API for accurate proration (SDK v13+)
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
                        
                        # The total is in cents, convert to euros
                        # This is the EXACT amount Stripe will charge (includes prorations)
                        proration_estimate = round(preview_invoice.total / 100, 2)
                        stripe_preview_success = True
                        
                        logger.info(f"✅ Stripe proration preview: {proration_estimate}€ for {current_seats}→{new_seats} seats")
                    else:
                        logger.info(f"ℹ️ No stripe_customer_id for gerant {gerant_id}, using fallback calculation")
                    
                except stripe.StripeError as e:
                    logger.warning(f"⚠️ Could not get Stripe proration preview: {str(e)}")
                except Exception as e:
                    logger.warning(f"⚠️ Unexpected error in Stripe preview: {str(e)}")
        
        # Fallback: Calculate based on actual days remaining in cycle
        # Used when: trial, no Stripe IDs, or Stripe API call failed
        if not stripe_preview_success and not is_trial and new_seats > current_seats:
            if subscription.get('current_period_end'):
                try:
                    period_end_str = subscription['current_period_end']
                    if isinstance(period_end_str, str):
                        # Handle both with and without timezone
                        if '+' not in period_end_str and 'Z' not in period_end_str:
                            period_end = datetime.fromisoformat(period_end_str).replace(tzinfo=timezone.utc)
                        else:
                            period_end = datetime.fromisoformat(period_end_str.replace('Z', '+00:00'))
                    else:
                        period_end = period_end_str
                        if period_end.tzinfo is None:
                            period_end = period_end.replace(tzinfo=timezone.utc)
                    
                    now = datetime.now(timezone.utc)
                    days_remaining = max(0, (period_end - now).days)
                    daily_rate = new_price / 30
                    proration_estimate = round((new_seats - current_seats) * daily_rate * days_remaining, 2)
                    
                    logger.info(f"ℹ️ Fallback proration: {proration_estimate}€ ({days_remaining} days remaining)")
                except Exception as parse_err:
                    logger.warning(f"Could not calculate fallback proration: {parse_err}")
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur preview sièges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        stores = await gerant_service.get_all_stores(current_user['id'])
        return stores
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        sellers = await gerant_service.get_all_sellers(current_user['id'])
        return sellers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== STORE DETAIL ROUTES (CRITICAL FOR FRONTEND) =====

@router.get("/stores/{store_id}/managers")
async def get_store_managers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all managers for a specific store"""
    try:
        return await gerant_service.get_store_managers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))




@router.get("/stores/{store_id}/sellers")
async def get_store_sellers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all sellers for a specific store"""
    try:
        return await gerant_service.get_store_sellers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stores/{store_id}/kpi-overview")
async def get_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get consolidated store KPI overview for a specific date"""
    try:
        return await gerant_service.get_store_kpi_overview(store_id, current_user['id'], date)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stores/{store_id}/kpi-history")
async def get_store_kpi_history(
    store_id: str,
    days: int = 30,
    start_date: str = None,
    end_date: str = None,
    current_user: Dict = Depends(get_current_gerant),
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
    
    Security: Verify that the store belongs to the current gérant
    """
    try:
        return await gerant_service.get_store_kpi_history(
            store_id, current_user['id'], days, start_date, end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get available years with KPI data for this store
    
    Returns list of years (integers) in descending order (most recent first)
    Used for date filter dropdowns in the frontend
    
    Security: Verify that the store belongs to the current gérant
    """
    try:
        return await gerant_service.get_store_available_years(store_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            raise HTTPException(status_code=400, detail=error_msg)
        elif "inactif" in error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=404, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all invitations sent by this gérant"""
    try:
        return await gerant_service.get_invitations(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== STRIPE CHECKOUT =====

from pydantic import BaseModel
from typing import Optional
import stripe
import os
import logging

logger = logging.getLogger(__name__)

class GerantCheckoutRequest(BaseModel):
    """Request body for creating a checkout session"""
    quantity: Optional[int] = None  # Nombre de vendeurs (si None, utiliser le compte actif)
    billing_period: str = "monthly"  # 'monthly' ou 'yearly'
    origin_url: str  # URL d'origine pour les redirections


from api.dependencies import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase


@router.post("/stripe/checkout")
async def create_gerant_checkout_session(
    checkout_data: GerantCheckoutRequest,
    current_user: dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Créer une session de checkout Stripe pour un gérant.
    Tarification basée sur le nombre de vendeurs actifs :
    - 1-5 vendeurs actifs : 29€/vendeur
    - 6-15 vendeurs actifs : 25€/vendeur  
    - >15 vendeurs : sur devis (erreur)
    """
    try:
        STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Configuration Stripe manquante")
        
        stripe.api_key = STRIPE_API_KEY
        
        # Compter les vendeurs ACTIFS uniquement
        active_sellers_count = await db.users.count_documents({
            "gerant_id": current_user['id'],
            "role": "seller", 
            "status": "active"
        })
        
        # Utiliser la quantité fournie ou celle calculée
        quantity = checkout_data.quantity if checkout_data.quantity else active_sellers_count
        quantity = max(quantity, 1)  # Minimum 1 vendeur
        
        # Validation des limites
        if quantity > 15:
            raise HTTPException(
                status_code=400, 
                detail="Plus de 15 vendeurs nécessite un devis personnalisé. Contactez notre équipe commerciale."
            )
        
        # Logique de tarification
        if 1 <= quantity <= 5:
            price_per_seller = 29.00
        elif 6 <= quantity <= 15:
            price_per_seller = 25.00
        else:
            raise HTTPException(status_code=400, detail="Quantité invalide")
        
        # Vérifier si le gérant a déjà un customer ID Stripe
        gerant = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        stripe_customer_id = gerant.get('stripe_customer_id')
        
        # Créer ou récupérer le client Stripe
        if stripe_customer_id:
            try:
                customer = stripe.Customer.retrieve(stripe_customer_id)
                if customer.get('deleted'):
                    stripe_customer_id = None
                logger.info(f"Réutilisation du client Stripe: {stripe_customer_id}")
            except stripe.error.InvalidRequestError:
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
            
            await db.users.update_one(
                {"id": current_user['id']},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
            logger.info(f"Nouveau client Stripe créé: {stripe_customer_id}")
        
        # URLs de succès et d'annulation
        success_url = f"{checkout_data.origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_data.origin_url}/dashboard"
        
        # Créer la session de checkout
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f'Retail Performer AI - {quantity} vendeur(s)',
                        'description': f'Abonnement pour {quantity} vendeur(s) actif(s) - {price_per_seller}€/vendeur/mois'
                    },
                    'unit_amount': int(price_per_seller * 100),
                    'recurring': {
                        'interval': 'month' if checkout_data.billing_period == 'monthly' else 'year'
                    }
                },
                'quantity': quantity,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'gerant_id': current_user['id'],
                'seller_quantity': str(quantity),
                'price_per_seller': str(price_per_seller)
            }
        )
        
        logger.info(f"Session checkout créée {session.id} pour {current_user['name']} avec {quantity} vendeur(s)")
        
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "quantity": quantity,
            "price_per_seller": price_per_seller,
            "total_monthly": price_per_seller * quantity,
            "active_sellers_count": active_sellers_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur création session checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la session: {str(e)}")



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
            raise HTTPException(
                status_code=400, 
                detail="Aucun espace de travail associé. Créez d'abord un magasin manuellement."
            )
        
        # Validation du mode
        if request.mode not in ["create_only", "update_only", "create_or_update"]:
            raise HTTPException(
                status_code=400,
                detail="Mode invalide. Utilisez: create_only, update_only, ou create_or_update"
            )
        
        # Validation des données
        if not request.stores:
            raise HTTPException(
                status_code=400,
                detail="La liste des magasins est vide"
            )
        
        if len(request.stores) > 500:
            raise HTTPException(
                status_code=400,
                detail="Maximum 500 magasins par import. Divisez votre fichier."
            )
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur import massif: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'import: {str(e)}")



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
    db = Depends(get_db)
):
    """
    Send a support message from the gérant to the support team.
    The message is sent via Brevo to hello@retailperformerai.com
    """
    import httpx
    
    try:
        # Validate input
        if not request.subject.strip():
            raise HTTPException(status_code=400, detail="Le sujet est requis")
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Le message est requis")
        if len(request.message) > 5000:
            raise HTTPException(status_code=400, detail="Le message est trop long (max 5000 caractères)")
        
        # Get user info
        user_email = current_user.get('email', 'inconnu')
        user_name = current_user.get('name', 'Gérant')
        user_id = current_user.get('id', 'N/A')
        
        # Get workspace info
        workspace = await db.workspaces.find_one(
            {"id": current_user.get('workspace_id')},
            {"_id": 0, "name": 1}
        )
        workspace_name = workspace.get('name', 'N/A') if workspace else 'N/A'
        
        # Get subscription info
        subscription = await db.subscriptions.find_one(
            {"user_id": user_id},
            {"_id": 0, "plan": 1, "status": 1, "seats": 1}
        )
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
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        if not brevo_api_key:
            logger.error("BREVO_API_KEY not configured")
            raise HTTPException(status_code=500, detail="Service email non configuré")
        
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
                raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du message")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending support message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
    db = Depends(get_db)
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
            raise HTTPException(status_code=400, detail="Intervalle invalide. Utilisez 'month' ou 'year'.")
        
        # Get current subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Aucun abonnement actif trouvé")
        
        current_interval = subscription.get('billing_interval', 'month')
        current_seats = subscription.get('seats', 1)
        is_trial = subscription.get('status') == 'trialing'
        
        # Check if already on requested interval
        if current_interval == new_interval:
            raise HTTPException(
                status_code=400, 
                detail=f"Vous êtes déjà sur un abonnement {'annuel' if new_interval == 'year' else 'mensuel'}."
            )
        
        # Block downgrade from annual to monthly
        if current_interval == 'year' and new_interval == 'month':
            raise HTTPException(
                status_code=400,
                detail="Impossible de passer de l'annuel au mensuel. Pour changer, veuillez annuler votre abonnement actuel puis en souscrire un nouveau."
            )
        
        # Get Stripe IDs
        stripe_subscription_id = subscription.get('stripe_subscription_id')
        stripe_subscription_item_id = subscription.get('stripe_subscription_item_id')
        
        # Calculate costs
        plan = get_plan_from_seats(current_seats)
        prices = STRIPE_PRICES[plan]
        
        monthly_cost = current_seats * prices['price_monthly']
        yearly_cost = monthly_cost * 12 * 0.8  # 20% discount
        
        proration_amount = 0.0
        next_billing_date = ""
        
        # For trial users, just update the database
        if is_trial:
            # Update subscription in DB
            await db.subscriptions.update_one(
                {"user_id": gerant_id},
                {"$set": {
                    "billing_interval": new_interval,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            next_billing_date = subscription.get('trial_end', '')
            
            logger.info(f"✅ Trial user {current_user['email']} switched to {new_interval} (no Stripe call)")
            
        elif stripe_subscription_id and stripe_subscription_item_id:
            # Active subscriber - call Stripe API
            STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
            if not STRIPE_API_KEY:
                raise HTTPException(status_code=500, detail="Configuration Stripe manquante")
            
            stripe.api_key = STRIPE_API_KEY
            
            try:
                # Get new price ID based on interval
                new_price_id = prices['yearly'] if new_interval == 'year' else prices['monthly']
                
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
                
                # Get proration from upcoming invoice
                try:
                    upcoming = stripe.Invoice.upcoming(subscription=stripe_subscription_id)
                    proration_amount = upcoming.get('amount_due', 0) / 100
                except Exception as e:
                    logger.warning(f"Could not get proration: {e}")
                
                # Get next billing date
                if updated_subscription.current_period_end:
                    next_billing_date = datetime.fromtimestamp(
                        updated_subscription.current_period_end, 
                        tz=timezone.utc
                    ).isoformat()
                
            except stripe.StripeError as e:
                logger.error(f"❌ Stripe error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Erreur Stripe: {str(e)}")
            
            # Update local database
            update_data = {
                "billing_interval": new_interval,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if next_billing_date:
                update_data["current_period_end"] = next_billing_date
            
            await db.subscriptions.update_one(
                {"user_id": gerant_id},
                {"$set": update_data}
            )
            
            # Also update workspace
            workspace_id = current_user.get('workspace_id')
            if workspace_id:
                await db.workspaces.update_one(
                    {"id": workspace_id},
                    {"$set": {"billing_interval": new_interval}}
                )
        
        else:
            raise HTTPException(
                status_code=400,
                detail="Impossible de modifier l'abonnement. Données Stripe manquantes."
            )
        
        interval_label = "annuel" if new_interval == 'year' else "mensuel"
        savings = round((monthly_cost * 12) - yearly_cost, 2) if new_interval == 'year' else 0
        
        message = f"🎉 Passage à l'abonnement {interval_label} réussi !"
        if savings > 0:
            message += f" Vous économisez {savings}€/an."
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error switching interval: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
