"""Subscriptions mixin for AdminService."""
import logging
import stripe
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta

from core.config import settings

logger = logging.getLogger(__name__)


class SubscriptionsMixin:

    async def resolve_subscription_duplicates(
        self,
        gerant_id: str,
        apply: bool,
        current_admin: Dict,
        request_headers: Dict
    ) -> Dict:
        """
        Resolve duplicate subscriptions for a gerant

        Args:
            gerant_id: Gérant ID
            apply: If True, apply changes. If False, dry-run only
            current_admin: Current admin user dict
            request_headers: Request headers dict (for IP extraction)
        """
        # Extract IP from headers
        client_ip = None
        x_forwarded_for = request_headers.get("x-forwarded-for")
        x_real_ip = request_headers.get("x-real-ip")
        cf_connecting_ip = request_headers.get("cf-connecting-ip")

        if cf_connecting_ip:
            client_ip = cf_connecting_ip.split(",")[0].strip()
        elif x_real_ip:
            client_ip = x_real_ip.split(",")[0].strip()
        elif x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        elif request_headers.get("x-vercel-forwarded-for"):
            client_ip = request_headers.get("x-vercel-forwarded-for").split(",")[0].strip()
        elif request_headers.get("x-railway-client-ip"):
            client_ip = request_headers.get("x-railway-client-ip").split(",")[0].strip()

        if not client_ip:
            client_ip = "unknown"

        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="resolve_subscription_duplicates",
            gerant_id=gerant_id,
            ip=client_ip,
            x_forwarded_for=x_forwarded_for,
            x_real_ip=x_real_ip,
            cf_connecting_ip=cf_connecting_ip,
            apply=apply
        )

        # Get all active subscriptions for this gerant (paginated, max 100)
        active_subscriptions = await self.subscription_repo.find_many_by_user_status(
            user_id=gerant_id,
            status_list=["active", "trialing"],
            limit=100
        )

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
        if not settings.STRIPE_API_KEY:
            raise ValueError("Configuration Stripe manquante")

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
                await self.subscription_repo.update_by_stripe_subscription(
                    stripe_sub_id,
                    {
                        "cancel_at_period_end": True,
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
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

    # ===== SUBSCRIPTION OVERVIEW & DETAILS =====

    async def get_subscriptions_overview(
        self,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get subscriptions overview with KPIs (MRR, Total Users, etc.)
        Uses MongoDB aggregations to avoid loading all data in RAM

        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100

        skip = (page - 1) * size

        # 1. Get paginated gerants
        gerants = await self.user_repo.admin_find_all_paginated(
            role="gerant",
            projection={"_id": 0, "id": 1, "name": 1, "email": 1, "stripe_customer_id": 1, "created_at": 1},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )

        total_gerants = await self.user_repo.admin_count_all(role="gerant")
        pages = (total_gerants + size - 1) // size

        if not gerants:
            return {
                "summary": {
                    "total_gerants": 0,
                    "active_subscriptions": 0,
                    "trialing_subscriptions": 0,
                    "total_mrr": 0
                },
                "subscriptions": [],
                "pagination": {
                    "page": page,
                    "size": size,
                    "total": 0,
                    "pages": 0
                }
            }

        gerant_ids = [g['id'] for g in gerants]

        # 2. Get subscriptions for current page gerants (using repository)
        subscriptions = await self.subscription_repo.find_many(
            {"user_id": {"$in": gerant_ids}},
            limit=1000  # Max subscriptions for current page
        )
        subscriptions_map = {sub['user_id']: sub for sub in subscriptions}

        # 3. Get active sellers counts using aggregation (via UserRepository)
        sellers_count_pipeline = [
            {"$match": {
                "gerant_id": {"$in": gerant_ids},
                "role": "seller",
                "status": "active"
            }},
            {"$group": {
                "_id": "$gerant_id",
                "count": {"$sum": 1}
            }}
        ]
        sellers_counts = await self.user_repo.aggregate(sellers_count_pipeline, max_results=1000)
        sellers_count_map = {item['_id']: item['count'] for item in sellers_counts}

        # 4. Get team members for AI credits calculation
        team_members = await self.user_repo.find_many(
            {"gerant_id": {"$in": gerant_ids}},
            projection={"_id": 0, "id": 1, "gerant_id": 1},
            limit=1000
        )
        team_members_by_gerant = {}
        for member in team_members:
            gerant_id = member.get('gerant_id')
            if gerant_id:
                if gerant_id not in team_members_by_gerant:
                    team_members_by_gerant[gerant_id] = []
                team_members_by_gerant[gerant_id].append(member['id'])

        # 5. Get last transactions using aggregation (via PaymentTransactionRepository)
        all_team_ids = []
        MAX_TEAM_MEMBERS = 1000
        for team_ids in team_members_by_gerant.values():
            all_team_ids.extend(team_ids[:MAX_TEAM_MEMBERS])

        transactions_map = {}
        if gerant_ids:
            transactions_pipeline = [
                {"$match": {"user_id": {"$in": gerant_ids}}},
                {"$sort": {"created_at": -1}},
                {"$group": {
                    "_id": "$user_id",
                    "last_transaction": {"$first": "$$ROOT"}
                }}
            ]
            transactions_result = await self.payment_transaction_repo.aggregate(
                transactions_pipeline,
                max_results=1000
            )
            for item in transactions_result:
                transaction = item.get('last_transaction', {})
                transaction.pop('_id', None)
                transactions_map[item['_id']] = transaction

        # 6. Get AI credits usage by team using aggregation (via AIUsageLogRepository)
        ai_credits_map = {}
        if all_team_ids:
            try:
                ai_credits_pipeline = [
                    {"$match": {"user_id": {"$in": all_team_ids}}},
                    {"$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "id",
                        "as": "user_info"
                    }},
                    {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
                    {"$group": {
                        "_id": "$user_info.gerant_id",
                        "total": {"$sum": "$credits_consumed"}
                    }}
                ]
                ai_credits_result = await self.ai_usage_log_repo.aggregate(ai_credits_pipeline, max_results=1000)
                ai_credits_map = {item['_id']: item.get('total', 0) for item in ai_credits_result if item.get('_id')}
            except Exception as e:
                logger.warning(f"Could not fetch AI credits: {e}")

        # 7. Build response using lookup maps
        subscriptions_data = []
        for gerant in gerants:
            gerant_id = gerant['id']

            subscription = subscriptions_map.get(gerant_id)
            active_sellers_count = sellers_count_map.get(gerant_id, 0)
            last_transaction = transactions_map.get(gerant_id)
            ai_credits_total = ai_credits_map.get(gerant_id, 0)

            subscriptions_data.append({
                "gerant": {
                    "id": gerant['id'],
                    "name": gerant['name'],
                    "email": gerant['email'],
                    "created_at": gerant.get('created_at')
                },
                "subscription": subscription,
                "active_sellers_count": active_sellers_count,
                "last_transaction": last_transaction,
                "ai_credits_used": ai_credits_total
            })

        # Calculate summary statistics
        active_subscriptions = sum(
            1 for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') in ['active', 'trialing']
        )
        trialing_subscriptions = sum(
            1 for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'trialing'
        )
        total_mrr = sum(
            s['subscription'].get('seats', 0) * s['subscription'].get('price_per_seat', 0)
            for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'active'
        )

        return {
            "summary": {
                "total_gerants": len(gerants),
                "active_subscriptions": active_subscriptions,
                "trialing_subscriptions": trialing_subscriptions,
                "total_mrr": round(total_mrr, 2)
            },
            "subscriptions": subscriptions_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total_gerants,
                "pages": pages
            }
        }

    async def get_subscription_details(self, gerant_id: str) -> Dict:
        """
        Get complete subscription details for a gerant
        Includes workspace, subscription, transactions, webhook events, sellers

        Args:
            gerant_id: Gérant ID
        """
        # Get gerant
        gerant = await self.user_repo.find_by_id(gerant_id, include_password=False)
        if not gerant or gerant.get('role') != 'gerant':
            raise ValueError("Gérant non trouvé")

        # Get subscription
        subscription = await self.subscription_repo.find_by_user(gerant_id)

        # Get workspace
        workspace = await self.workspace_repo.find_by_gerant(gerant_id)

        # Get transactions (paginated, max 100)
        transactions = await self.payment_transaction_repo.find_many(
            {"user_id": gerant_id},
            limit=100,
            sort=[("created_at", -1)]
        )

        # Get webhook events (paginated, max 100)
        webhook_events = []
        if subscription and subscription.get('stripe_subscription_id'):
            stripe_sub_id = subscription['stripe_subscription_id']
            stripe_customer_id = gerant.get('stripe_customer_id')

            # Build query for webhook events
            webhook_query = {
                "$or": [
                    {"data.object.id": stripe_sub_id},
                    {"data.object.subscription": stripe_sub_id}
                ]
            }
            if stripe_customer_id:
                webhook_query["$or"].append({"data.object.customer": stripe_customer_id})

            webhook_events = await self.stripe_event_repo.find_many(
                webhook_query,
                limit=100,
                sort=[("created_at", -1)]
            )

        # Count sellers by status (using repository count method)
        active_sellers_final = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        suspended_sellers_final = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "suspended"
        })

        return {
            "gerant": gerant,
            "subscription": subscription,
            "workspace": workspace,
            "sellers": {
                "active": active_sellers_final,
                "suspended": suspended_sellers_final,
                "total": active_sellers_final + suspended_sellers_final
            },
            "transactions": transactions,
            "webhook_events": webhook_events
        }

    # ===== TRIAL MANAGEMENT =====

    async def get_gerants_trials(
        self,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get paginated list of gerants with trial information

        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100

        skip = (page - 1) * size

        # Get paginated gerants
        gerants = await self.user_repo.admin_find_all_paginated(
            role="gerant",
            projection={"_id": 0, "password": 0},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )
        if not isinstance(gerants, list):
            gerants = []

        total_gerants = await self.user_repo.admin_count_all(role="gerant")
        pages = (total_gerants + size - 1) // size if size else 0

        result = []
        for gerant in gerants:
            gerant_id = gerant['id']

            # Count active sellers
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })

            # Get workspace (source of truth for trials)
            workspace = await self.workspace_repo.find_by_gerant(gerant_id)

            # Get subscription (fallback)
            subscription = await self.subscription_repo.find_by_user(gerant_id)

            has_subscription = False
            trial_end = None
            subscription_status = None

            # Priority to workspace for trial info
            if workspace:
                subscription_status = workspace.get('subscription_status', 'inactive')
                trial_end = workspace.get('trial_end')

                if subscription_status == 'trialing' and trial_end:
                    has_subscription = True
                elif subscription_status == 'active':
                    has_subscription = True
            elif subscription:
                subscription_status = subscription.get('status')
                has_subscription = subscription_status in ['active', 'trialing']
                trial_end = subscription.get('trial_end')

            # Calculate days left if in trial
            days_left = None
            if subscription_status == 'trialing' and trial_end:
                try:
                    if isinstance(trial_end, str):
                        trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                    else:
                        trial_end_dt = trial_end

                    now = datetime.now(timezone.utc)
                    if trial_end_dt.tzinfo is None:
                        trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)

                    # Calculate difference in calendar days
                    trial_end_date = trial_end_dt.date()
                    now_date = now.date()
                    days_delta = (trial_end_date - now_date).days
                    days_left = max(0, days_delta)

                    # If days_left is 0 but trial_end is in the future (same day), adjust to 1
                    if days_left == 0 and trial_end_dt >= now:
                        days_left = 1
                except Exception as e:
                    logger.warning(f"Error calculating days_left for gerant {gerant_id}: {e}")

            # Determine max sellers limit based on plan
            max_sellers = None
            if subscription_status == 'trialing':
                max_sellers = 15  # Trial limit
            elif subscription_status == 'active':
                if active_sellers_count >= 16:
                    max_sellers = None  # Unlimited for enterprise
                elif active_sellers_count >= 6:
                    max_sellers = 15  # Professional
                else:
                    max_sellers = 5  # Starter

            result.append({
                "id": gerant_id,
                "name": gerant.get('name', 'N/A'),
                "email": gerant.get('email', ''),
                "trial_end": trial_end,
                "active_sellers_count": active_sellers_count,
                "max_sellers": max_sellers,
                "days_left": days_left,
                "has_subscription": has_subscription,
                "subscription_status": subscription_status
            })

        # Sort by trial_end date (closest first); use string key to avoid TypeError when mixing types
        def _trial_sort_key(x):
            te = x.get('trial_end')
            if te is None:
                return (True, '')
            if hasattr(te, 'isoformat'):
                return (False, te.isoformat())
            return (False, str(te))
        result.sort(key=_trial_sort_key)

        return {
            "gerants": result,
            "pagination": {
                "page": page,
                "size": size,
                "total": total_gerants,
                "pages": pages
            }
        }

    async def update_gerant_trial(
        self,
        gerant_id: str,
        trial_end_str: str,
        current_admin: Dict
    ) -> Dict:
        """
        Update gerant trial end date

        Args:
            gerant_id: Gérant ID
            trial_end_str: New trial end date (ISO format or YYYY-MM-DD)
            current_admin: Current admin user dict
        """
        # Validate gerant exists
        gerant = await self.user_repo.find_by_id(gerant_id, include_password=False)
        if not gerant or gerant.get('role') != 'gerant':
            raise ValueError("Gérant non trouvé")

        # Parse and validate date
        try:
            if isinstance(trial_end_str, str):
                # If YYYY-MM-DD format, add time to end of day
                if len(trial_end_str) == 10 and trial_end_str.count('-') == 2:
                    trial_end_str = f"{trial_end_str}T23:59:59.999Z"

                trial_end_str_normalized = trial_end_str.replace('Z', '+00:00')
                trial_end_date = datetime.fromisoformat(trial_end_str_normalized)
            else:
                trial_end_date = trial_end_str

            # Ensure UTC timezone
            if trial_end_date.tzinfo is None:
                trial_end_date = trial_end_date.replace(tzinfo=timezone.utc)
            trial_end = trial_end_date.isoformat()
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Format de date invalide: {trial_end_str}")

        # Get workspace (source of truth)
        workspace = await self.workspace_repo.find_by_gerant(gerant_id)
        if not workspace:
            raise ValueError("Workspace non trouvé pour ce gérant")

        # Prolongation only: forbid shortening
        current_trial_end = workspace.get('trial_end')
        if current_trial_end:
            current_trial_dt = current_trial_end
            if isinstance(current_trial_end, str):
                current_trial_dt = datetime.fromisoformat(current_trial_end.replace('Z', '+00:00'))
            if current_trial_dt.tzinfo is None:
                current_trial_dt = current_trial_dt.replace(tzinfo=timezone.utc)

            if trial_end_date < current_trial_dt:
                raise ValueError("La nouvelle date doit prolonger l'essai")

        # Update workspace
        now = datetime.now(timezone.utc)
        update_data = {
            "trial_end": trial_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # If new date is in future, ensure subscription_status is 'trialing' (unless already 'active')
        if trial_end_date > now:
            current_status = workspace.get('subscription_status', 'inactive')
            if current_status != 'active':
                update_data["subscription_status"] = "trialing"

        await self.workspace_repo.update_one(
            {"gerant_id": gerant_id},
            {"$set": update_data}
        )
        workspace_id = workspace.get("id")
        if workspace_id:
            from core.cache import invalidate_workspace_cache
            await invalidate_workspace_cache(workspace_id)

        # Update subscription if exists (for compatibility)
        subscription = await self.subscription_repo.find_by_user(gerant_id)
        if subscription:
            subscription_update = {
                "trial_end": trial_end,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if trial_end_date > now:
                current_sub_status = subscription.get('status', 'inactive')
                if current_sub_status != 'active':
                    subscription_update["status"] = "trialing"

            await self.subscription_repo.update_by_user(gerant_id, subscription_update)

        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="update_gerant_trial",
            gerant_id=gerant_id,
            details={
                "gerant_email": gerant.get('email'),
                "trial_end": trial_end
            }
        )

        return {
            "success": True,
            "message": "Période d'essai mise à jour avec succès",
            "trial_end": trial_end
        }

    # ===== SUBSCRIPTION / WORKSPACE SYNC =====

    async def check_subscription_workspace_sync(self) -> Dict:
        """
        Détecte les désynchronisations entre subscription.status et workspace.subscription_status.
        Cas typique : webhook checkout.session.completed raté → workspace pas activé malgré paiement.
        """
        gerants = await self.user_repo.find_many(
            {"role": "gerant", "status": "active"},
            projection={"_id": 0, "id": 1, "name": 1, "email": 1},
            limit=2000
        )
        gerant_ids = [g["id"] for g in gerants]

        subscriptions = await self.subscription_repo.find_many(
            {"user_id": {"$in": gerant_ids}, "status": {"$in": ["active", "trialing"]}},
            limit=2000
        )
        sub_by_gerant = {s["user_id"]: s for s in subscriptions}

        workspaces = await self.workspace_repo.find_many(
            {"gerant_id": {"$in": gerant_ids}},
            limit=2000
        )
        ws_by_gerant = {w["gerant_id"]: w for w in workspaces}

        mismatches = []
        for g in gerants:
            gid = g["id"]
            sub = sub_by_gerant.get(gid)
            ws = ws_by_gerant.get(gid)
            if not sub:
                continue
            sub_status = sub.get("status")
            ws_status = ws.get("subscription_status") if ws else None
            if sub_status != ws_status:
                mismatches.append({
                    "gerant_id": gid,
                    "email": g["email"],
                    "name": g.get("name"),
                    "subscription_status": sub_status,
                    "workspace_subscription_status": ws_status,
                    "stripe_subscription_id": sub.get("stripe_subscription_id"),
                })

        return {
            "total_checked": len(gerants),
            "mismatches_count": len(mismatches),
            "mismatches": mismatches,
        }

    async def fix_subscription_workspace_sync(self, dry_run: bool = True) -> Dict:
        """
        Resynchronise workspace.subscription_status pour les gérants désynchronisés.
        dry_run=True : liste uniquement. dry_run=False : applique les corrections.
        """
        check_result = await self.check_subscription_workspace_sync()
        mismatches = check_result["mismatches"]
        fixed = []

        if not dry_run:
            for m in mismatches:
                ws = await self.workspace_repo.find_by_gerant(m["gerant_id"])
                if ws:
                    await self.workspace_repo.update_by_id(
                        ws["id"],
                        {
                            "subscription_status": m["subscription_status"],
                            "stripe_subscription_id": m["stripe_subscription_id"],
                        }
                    )
                    fixed.append(m["gerant_id"])
                    logger.info(
                        f"✅ Sync fix applied: gerant={m['email']} "
                        f"workspace_status {m['workspace_subscription_status']} → {m['subscription_status']}"
                    )

        return {
            "dry_run": dry_run,
            "mismatches_count": len(mismatches),
            "fixed_count": len(fixed) if not dry_run else 0,
            "mismatches": mismatches,
        }
