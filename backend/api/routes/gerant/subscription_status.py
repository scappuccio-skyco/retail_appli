"""
Subscription status and audit routes: GET /subscription/status, GET /subscriptions, GET /subscription/audit
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import logging

from core.exceptions import AppException
from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service

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
