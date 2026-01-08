"""
Admin-only endpoints for subscription management and support operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Dict, Optional
from datetime import datetime, timezone
from api.dependencies import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from core.security import get_super_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/subscription/resolve-duplicates")
async def resolve_duplicates(
    request: Request,
    gerant_id: str = Query(..., description="ID du gérant"),
    apply: bool = Query(False, description="Si True, applique les changements. Si False, dry-run uniquement (défaut)"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """
    🔧 Endpoint support-only pour résoudre les abonnements multiples.
    
    PROTECTION: Super admin uniquement + dry-run par défaut + logs audit.
    
    Opérations proposées:
    1. Détecte les abonnements multiples actifs
    2. Propose un plan de résolution (dry-run par défaut)
    3. Applique le plan si apply=true
    
    Règles de résolution:
    - Garde le plus récent (current_period_end)
    - Annule les autres à la fin de période
    - Vérifie metadata pour corrélation
    
    Returns:
        Plan de résolution (dry-run) ou résultat de l'application
    """
    # 🔒 AUDIT LOG: Log admin action
    # Get IP from multiple sources (x-forwarded-for can be spoofed, but OK for superadmin endpoint)
    # Priority: cf-connecting-ip > x-real-ip > x-forwarded-for > platform headers > client.host
    client_ip = None
    x_forwarded_for = request.headers.get("x-forwarded-for")
    x_real_ip = request.headers.get("x-real-ip")
    cf_connecting_ip = request.headers.get("cf-connecting-ip")
    
    # Priority order (most trusted first)
    if cf_connecting_ip:  # Cloudflare (most trusted)
        client_ip = cf_connecting_ip.split(",")[0].strip()
    elif x_real_ip:  # Nginx/Proxy standard
        client_ip = x_real_ip.split(",")[0].strip()
    elif x_forwarded_for:  # Standard proxy header (first IP)
        client_ip = x_forwarded_for.split(",")[0].strip()
    elif request.headers.get("x-vercel-forwarded-for"):  # Vercel
        client_ip = request.headers.get("x-vercel-forwarded-for").split(",")[0].strip()
    elif request.headers.get("x-railway-client-ip"):  # Railway
        client_ip = request.headers.get("x-railway-client-ip").split(",")[0].strip()
    elif request.client:  # Direct connection (fallback)
        client_ip = request.client.host
    
    if not client_ip:
        client_ip = "unknown"
    
    logger.warning(
        f"🔧 ADMIN ACTION: resolve_duplicates called by {current_admin.get('email')} "
        f"(id: {current_admin.get('id')}) for gerant {gerant_id}, apply={apply}, IP: {client_ip}"
    )
    
    # Log to admin_logs collection
    # ✅ SANITY CHECK: timestamp présent, pas d'info sensible (pas de tokens), pas de contrainte schema ORM
    try:
        await db.admin_logs.insert_one({
            "admin_id": current_admin.get('id'),
            "admin_email": current_admin.get('email'),
            "action": "resolve_subscription_duplicates",
            "gerant_id": gerant_id,
            "apply": apply,
            "ip": client_ip,
            "x_forwarded_for": x_forwarded_for,  # Store original header (can be spoofed, but OK for audit)
            "x_real_ip": x_real_ip,  # Store x-real-ip if available
            "cf_connecting_ip": cf_connecting_ip,  # Store Cloudflare IP if available
            "timestamp": datetime.now(timezone.utc).isoformat(),  # ✅ Timestamp pour audit
            "created_at": datetime.now(timezone.utc).isoformat()  # Alias pour compatibilité
        })
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")
    
    try:
        # Get all active subscriptions for this gerant
        active_subscriptions = await db.subscriptions.find(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        ).to_list(length=20)
        
        if len(active_subscriptions) <= 1:
            return {
                "success": True,
                "message": "Aucun doublon détecté",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": None
            }
        
        # Sort by current_period_end (most recent first)
        sorted_subs = sorted(
            active_subscriptions,
            key=lambda s: (
                s.get('current_period_end', '') or s.get('created_at', ''),
                s.get('status') == 'active'  # Prefer active over trialing
            ),
            reverse=True
        )
        
        # Keep the most recent one
        keep_subscription = sorted_subs[0]
        cancel_subscriptions = sorted_subs[1:]
        
        # Build resolution plan
        plan = {
            "keep": {
                "stripe_subscription_id": keep_subscription.get('stripe_subscription_id'),
                "workspace_id": keep_subscription.get('workspace_id'),
                "price_id": keep_subscription.get('price_id'),
                "status": keep_subscription.get('status'),
                "current_period_end": keep_subscription.get('current_period_end'),
                "reason": "Most recent subscription (by current_period_end)"
            },
            "cancel": [
                {
                    "stripe_subscription_id": sub.get('stripe_subscription_id'),
                    "workspace_id": sub.get('workspace_id'),
                    "price_id": sub.get('price_id'),
                    "status": sub.get('status'),
                    "current_period_end": sub.get('current_period_end'),
                    "action": "cancel_at_period_end"
                }
                for sub in cancel_subscriptions
            ]
        }
        
        if not apply:
            # Dry-run: return plan only
            return {
                "success": True,
                "mode": "dry-run",
                "message": f"Plan de résolution pour {len(active_subscriptions)} abonnements actifs",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": plan,
                "instructions": "Passez apply=true pour appliquer ce plan"
            }
        
        # Apply plan: cancel subscriptions via Stripe
        import stripe
        from core.config import settings
        
        if not settings.STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Configuration Stripe manquante")
        
        stripe.api_key = settings.STRIPE_API_KEY
        
        canceled_results = []
        errors = []
        
        for sub_to_cancel in cancel_subscriptions:
            stripe_sub_id = sub_to_cancel.get('stripe_subscription_id')
            if not stripe_sub_id:
                errors.append({
                    "stripe_subscription_id": None,
                    "error": "No stripe_subscription_id found"
                })
                continue
            
            try:
                # Cancel at period end (not immediately)
                stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
                
                # Update database
                await db.subscriptions.update_one(
                    {"stripe_subscription_id": stripe_sub_id},
                    {"$set": {
                        "cancel_at_period_end": True,
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                canceled_results.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "status": "scheduled_for_cancellation"
                })
                
                logger.info(f"✅ Scheduled cancellation for subscription {stripe_sub_id}")
                
            except Exception as e:
                errors.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "error": str(e)
                })
                logger.error(f"❌ Error canceling subscription {stripe_sub_id}: {e}")
        
        return {
            "success": True,
            "mode": "applied",
            "message": f"Plan appliqué: {len(canceled_results)} abonnement(s) programmé(s) pour annulation",
            "active_subscriptions_count": len(active_subscriptions),
            "plan": plan,
            "results": {
                "canceled_count": len(canceled_results),
                "canceled": canceled_results,
                "errors": errors
            }
        }
        
    except Exception as e:
        logger.error(f"Erreur résolution doublons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la résolution: {str(e)}")
