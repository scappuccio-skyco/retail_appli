"""
Gérant-specific Routes
Dashboard stats, subscription status, and workspace management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict

from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service, get_db
import logging

logger = logging.getLogger(__name__)

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
    For active subscribers: Would normally call Stripe to prorate.
    
    Returns:
        success: bool
        message: str
        new_seats: int
        new_monthly_cost: float
        is_trial: bool
        proration_amount: float (0 for trial)
    """
    from datetime import datetime, timezone
    
    try:
        gerant_id = current_user['id']
        new_seats = request.seats
        
        # Validate seats count
        if new_seats < 1:
            raise HTTPException(status_code=400, detail="Le nombre de sièges doit être au moins 1")
        if new_seats > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 sièges. Contactez-nous pour un plan Enterprise.")
        
        # Get current subscription
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=404, detail="Aucun abonnement trouvé")
        
        current_seats = subscription.get('seats', 1)
        is_trial = subscription.get('status') == 'trialing'
        
        # Calculate new price based on tier
        if new_seats <= 5:
            price_per_seat = 29
            plan = 'starter'
        elif new_seats <= 15:
            price_per_seat = 25
            plan = 'professional'
        else:
            price_per_seat = 22
            plan = 'enterprise'
        
        new_monthly_cost = new_seats * price_per_seat
        
        # For trial: just update the database
        # For active: would call Stripe API (simplified for now)
        proration_amount = 0
        if not is_trial and new_seats > current_seats:
            # Simplified proration (would use Stripe in production)
            days_remaining = 15  # Approximate mid-month
            daily_rate = price_per_seat / 30
            proration_amount = round((new_seats - current_seats) * daily_rate * days_remaining, 2)
        
        # Update subscription in database
        await db.subscriptions.update_one(
            {"user_id": gerant_id},
            {"$set": {
                "seats": new_seats,
                "plan": plan,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"✅ Sièges mis à jour: {current_seats} → {new_seats} pour {current_user['email']}")
        
        return {
            "success": True,
            "message": f"Abonnement mis à jour : {new_seats} siège{'s' if new_seats > 1 else ''}",
            "new_seats": new_seats,
            "new_monthly_cost": new_monthly_cost,
            "is_trial": is_trial,
            "proration_amount": proration_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur mise à jour sièges: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")


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

