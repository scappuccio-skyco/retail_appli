"""
Seller Service
Business logic for seller-specific operations (tasks, objectives, challenges)
"""
from datetime import datetime, timezone
from typing import List, Dict, Optional
from uuid import uuid4


class SellerService:
    """Service for seller-specific operations"""
    
    def __init__(self, db):
        self.db = db
    
    # ===== ACHIEVEMENT NOTIFICATIONS =====
    
    async def check_achievement_notification(self, user_id: str, item_type: str, item_id: str) -> bool:
        """
        Check if user has already seen the achievement notification for an objective/challenge
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
            
        Returns:
            True if notification has been seen, False if unseen
        """
        notification = await self.db.achievement_notifications.find_one({
            "user_id": user_id,
            "item_type": item_type,
            "item_id": item_id
        })
        return notification is not None
    
    async def mark_achievement_as_seen(self, user_id: str, item_type: str, item_id: str):
        """
        Mark an achievement notification as seen by a user
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
        """
        await self.db.achievement_notifications.update_one(
            {
                "user_id": user_id,
                "item_type": item_type,
                "item_id": item_id
            },
            {
                "$set": {
                    "seen_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    async def add_achievement_notification_flag(self, items: List[Dict], user_id: str, item_type: str):
        """
        Add has_unseen_achievement flag to objectives or challenges
        
        Args:
            items: List of objectives or challenges
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
        """
        for item in items:
            # Check if item is achieved/completed and notification not seen
            status = item.get('status')
            is_achieved = status in ['achieved', 'completed']
            
            if is_achieved:
                item_id = item.get('id')
                has_seen = await self.check_achievement_notification(user_id, item_type, item_id)
                item['has_unseen_achievement'] = not has_seen
            else:
                item['has_unseen_achievement'] = False
    
    # ===== TASKS =====
    
    async def get_seller_tasks(self, seller_id: str) -> List[Dict]:
        """
        Get all pending tasks for a seller
        - Check if diagnostic is completed
        - Check for pending manager requests
        """
        tasks = []
        
        # Check diagnostic
        diagnostic = await self.db.diagnostics.find_one(
            {"seller_id": seller_id}, 
            {"_id": 0}
        )
        
        if not diagnostic:
            tasks.append({
                "id": "diagnostic",
                "type": "diagnostic",
                "title": "Complète ton diagnostic vendeur",
                "description": "Découvre ton profil unique en 10 minutes",
                "priority": "high",
                "icon": "📋"
            })
        
        # Check pending manager requests
        requests_list = await self.db.manager_requests.find(
            {
                "seller_id": seller_id,
                "status": "pending"
            }, 
            {"_id": 0}
        ).to_list(100)
        
        for req in requests_list:
            # Ensure created_at is properly formatted
            if isinstance(req.get('created_at'), str):
                req['created_at'] = datetime.fromisoformat(req['created_at'])
            
            tasks.append({
                "id": req['id'],
                "type": "manager_request",
                "title": req['title'],
                "description": req['message'],
                "priority": "medium",
                "icon": "💬",
                "data": req
            })
        
        return tasks
    
    # ===== OBJECTIVES =====
    
    async def get_seller_objectives_active(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get active team objectives for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is still used for progress calculation, but NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            print(f"⚠️ [SELLER OBJECTIVES] Seller {seller_id} has no store_id")
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "period_end": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        print(f"🔍 [SELLER OBJECTIVES] Query: {query}")
        print(f"🔍 [SELLER OBJECTIVES] Seller ID: {seller_id}, Store ID: {seller_store_id}")
        
        # Get active objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        objectives = await self.db.objectives.find(
            query,
            {"_id": 0}
        ).sort("period_start", 1).to_list(10)
        
        print(f"🔍 [SELLER OBJECTIVES] Found {len(objectives)} objectives before filtering")
        
        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            visible_to = objective.get('visible_to_sellers')
            
            print(f"🔍 [SELLER OBJECTIVES] Objective: {objective.get('title')}")
            print(f"   - Type: {obj_type}")
            print(f"   - visible_to_sellers: {visible_to}")
            print(f"   - seller_id in objective: {objective.get('seller_id')}")
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    print(f"   ✅ INCLUDED (individual, matches seller)")
                    filtered_objectives.append(objective)
                else:
                    print(f"   ❌ EXCLUDED (individual, doesn't match seller)")
            # Collective objectives: check visible_to_sellers list
            else:
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    print(f"   ✅ INCLUDED (collective, visible to all)")
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    print(f"   ✅ INCLUDED (collective, seller in list)")
                    filtered_objectives.append(objective)
                else:
                    print(f"   ❌ EXCLUDED (collective, seller not in list)")
        
        # Ensure status field exists (for old objectives created before migration)
        for objective in filtered_objectives:
            if 'status' not in objective or objective['status'] is None:
                # Use centralized status computation
                current_val = objective.get('current_value', 0)
                target_val = objective.get('target_value', 0)
                period_end = objective.get('period_end')
                if period_end:
                    objective['status'] = self.compute_status(current_val, target_val, period_end)
                else:
                    objective['status'] = 'active'  # Fallback if no end_date
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_objectives, seller_id, "objective")
        
        return filtered_objectives
    
    async def get_seller_objectives_all(self, seller_id: str, manager_id: str) -> Dict:
        """
        Get all team objectives (active and inactive) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return {"active": [], "inactive": []}
        
        # Build query: filter by store_id (not manager_id), and visible
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get ALL objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        all_objectives = await self.db.objectives.find(
            query,
            {"_id": 0}
        ).sort("period_start", -1).to_list(100)
        
        # Filter objectives based on visibility rules and separate active/inactive
        active_objectives = []
        inactive_objectives = []
        
        for objective in all_objectives:
            obj_type = objective.get('type', 'collective')
            should_include = False
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    should_include = True
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    should_include = True
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    should_include = True
            
            if should_include:
                # Calculate progress
                await self.calculate_objective_progress(objective, manager_id)
                
                # Separate active vs inactive
                if objective.get('period_end', '') > today:
                    active_objectives.append(objective)
                else:
                    inactive_objectives.append(objective)
        
        return {
            "active": active_objectives,
            "inactive": inactive_objectives
        }
    
    async def get_seller_objectives_history(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get completed objectives (past period_end date) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "period_end": {"$lt": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get past objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        objectives = await self.db.objectives.find(
            query,
            {"_id": 0}
        ).sort("period_start", -1).to_list(50)
        
        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)
        
        # Calculate progress for each objective
        for objective in filtered_objectives:
            await self.calculate_objective_progress(objective, manager_id)
        
        return filtered_objectives
    
    # ===== CHALLENGES =====
    
    async def get_seller_challenges(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get all challenges (collective + individual) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and type
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"type": "collective"},
                {"type": "individual", "seller_id": seller_id}
            ]
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get collective challenges + individual challenges assigned to this seller
        # From the store (created by manager OR gérant)
        challenges = await self.db.challenges.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Filter challenges based on visibility rules (for collective challenges)
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            
            # Individual challenges: already filtered by query
            if chall_type == 'individual':
                filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")
        
        return filtered_challenges
    
    async def get_seller_challenges_active(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get only active challenges (collective + personal) for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, status, and period
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "status": "active",
            "end_date": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        print(f"🔍 [SELLER CHALLENGES] Query: {query}")
        print(f"🔍 [SELLER CHALLENGES] Seller ID: {seller_id}, Store ID: {seller_store_id}")
        
        # Get active challenges from the store (created by manager OR gérant)
        challenges = await self.db.challenges.find(
            query,
            {"_id": 0}
        ).sort("start_date", 1).to_list(10)
        
        print(f"🔍 [SELLER CHALLENGES] Found {len(challenges)} challenges before filtering")
        
        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            visible_to = challenge.get('visible_to_sellers')
            
            print(f"🔍 [SELLER CHALLENGES] Challenge: {challenge.get('title')}")
            print(f"   - Type: {chall_type}")
            print(f"   - visible_to_sellers: {visible_to}")
            print(f"   - seller_id in challenge: {challenge.get('seller_id')}")
            
            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    print(f"   ✅ INCLUDED (individual, matches seller)")
                    filtered_challenges.append(challenge)
                else:
                    print(f"   ❌ EXCLUDED (individual, doesn't match seller)")
            # Collective challenges: check visible_to_sellers list
            else:
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    print(f"   ✅ INCLUDED (collective, visible to all)")
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    print(f"   ✅ INCLUDED (collective, seller in list)")
                    filtered_challenges.append(challenge)
                else:
                    print(f"   ❌ EXCLUDED (collective, seller not in list)")
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")
        
        return filtered_challenges
    
    async def get_seller_challenges_history(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get completed challenges (past end_date) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.db.users.find_one({"id": seller_id}, {"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$lt": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get past challenges from the store (created by manager OR gérant)
        challenges = await self.db.challenges.find(
            query,
            {"_id": 0}
        ).sort("start_date", -1).to_list(50)
        
        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            
            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        return filtered_challenges
    
    # ===== HELPER FUNCTIONS =====
    
    @staticmethod
    def compute_status(current_value: float, target_value: float, end_date: str) -> str:
        """
        Compute objective status based on current value, target value, and end date.
        
        Rules:
        - status="active" by default (at creation)
        - status="achieved" only if current_value >= target_value (and target_value > 0)
        - status="failed" only if now > end_date AND not achieved
        - Never force "achieved" based on objective_type alone
        
        Args:
            current_value: Current progress value
            target_value: Target value
            end_date: End date in format YYYY-MM-DD
            
        Returns:
            "active" | "achieved" | "failed"
        """
        today = datetime.now(timezone.utc).date()
        end_date_obj = datetime.fromisoformat(end_date).date()
        
        # Check if objective is achieved (only if target is meaningful and current >= target)
        is_achieved = False
        if target_value > 0.01:  # Only consider achieved if target is meaningful
            is_achieved = current_value >= target_value
        
        # Check if period is over (today is after end_date)
        is_expired = today > end_date_obj
        
        # Determine status
        if is_achieved:
            return "achieved"
        elif is_expired:
            return "failed"
        else:
            return "active"
    
    async def calculate_objective_progress(self, objective: dict, manager_id: str):
        """Calculate progress for an objective (team-wide)"""
        # If progress is entered manually by the manager, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        if str(objective.get('data_entry_responsible', '')).lower() == 'manager':
            target_value = objective.get('target_value', 0)
            end_date = objective.get('period_end') or objective.get('end_date')
            current_value = float(objective.get('current_value') or 0)
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            await self.db.objectives.update_one(
                {"id": objective['id']},
                {"$set": {"status": objective['status']}}
            )
            return

        start_date = objective['period_start']
        end_date = objective['period_end']
        store_id = objective.get('store_id')
        
        # Build query for sellers - use store_id if available (multi-store support)
        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            # Fallback to manager_id for backward compatibility
            seller_query["manager_id"] = manager_id
        
        # Get all sellers for this store/manager
        sellers = await self.db.users.find(
            seller_query,
            {"_id": 0, "id": 1}
        ).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        
        # Build KPI query with store_id filter if available
        kpi_query = {
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": start_date, "$lte": end_date}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        # Get KPI entries for all sellers in date range
        entries = await self.db.kpi_entries.find(kpi_query, {"_id": 0}).to_list(10000)
        
        # Calculate totals from seller entries
        total_ca = sum(e.get('ca_journalier', 0) for e in entries)
        total_ventes = sum(e.get('nb_ventes', 0) for e in entries)
        total_articles = sum(e.get('nb_articles', 0) for e in entries)
        
        # Fallback to manager KPIs if seller data is missing
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        manager_entries = await self.db.manager_kpis.find(manager_kpi_query, {"_id": 0}).to_list(10000)
        
        if manager_entries:
            if total_ca == 0:
                total_ca = sum(e.get('ca_journalier', 0) for e in manager_entries if e.get('ca_journalier'))
            if total_ventes == 0:
                total_ventes = sum(e.get('nb_ventes', 0) for e in manager_entries if e.get('nb_ventes'))
            if total_articles == 0:
                total_articles = sum(e.get('nb_articles', 0) for e in manager_entries if e.get('nb_articles'))
        
        # Calculate averages
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        indice_vente = total_ca / total_articles if total_articles > 0 else 0
        
        # Update progress
        objective['progress_ca'] = total_ca
        objective['progress_ventes'] = total_ventes
        objective['progress_articles'] = total_articles
        objective['progress_panier_moyen'] = panier_moyen
        objective['progress_indice_vente'] = indice_vente
        
        # Determine current_value and target_value for status computation
        target_value = objective.get('target_value', 0)
        current_value = 0
        
        # For kpi_standard objectives, use the relevant KPI value
        if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
            kpi_name = objective['kpi_name']
            if kpi_name == 'ca':
                current_value = total_ca
            elif kpi_name == 'ventes':
                current_value = total_ventes
            elif kpi_name == 'articles':
                current_value = total_articles
            elif kpi_name == 'panier_moyen':
                current_value = panier_moyen
            elif kpi_name == 'indice_vente':
                current_value = indice_vente
        else:
            # For other objective types, use current_value if set, otherwise calculate from CA
            current_value = objective.get('current_value', total_ca)
            # For legacy objectives, check if they have specific targets
            if objective.get('ca_target'):
                target_value = objective.get('ca_target', 0)
                current_value = total_ca
            elif objective.get('panier_moyen_target'):
                target_value = objective.get('panier_moyen_target', 0)
                current_value = panier_moyen
            elif objective.get('indice_vente_target'):
                target_value = objective.get('indice_vente_target', 0)
                current_value = indice_vente
        
        # Use centralized status computation
        objective['status'] = self.compute_status(current_value, target_value, end_date)
        
        # Save progress to database (including computed status)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        await self.db.objectives.update_one(
            {"id": objective['id']},
            {"$set": {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente,
                "status": objective['status'],  # Use computed status
                "current_value": current_value  # Update current_value
            }}
        )
    
    async def calculate_objectives_progress_batch(self, objectives: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple objectives in batch (optimized version)
        Preloads all KPI data once instead of N queries per objective
        
        Args:
            objectives: List of objective dicts
            manager_id: Manager ID
            store_id: Store ID (all objectives must be from same store)
        
        Returns:
            List of objectives with progress calculated (in-place modification)
        """
        if not objectives:
            return objectives
        
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id
        
        increment_db_op("db.users.find (sellers - objectives)")
        sellers = await self.db.users.find(
            seller_query,
            {"_id": 0, "id": 1}
        ).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        
        if not seller_ids:
            # No sellers, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives
        
        # Calculate global date range (min start, max end)
        min_start = min(obj.get('period_start', '') for obj in objectives if obj.get('period_start'))
        max_end = max(obj.get('period_end', '') for obj in objectives if obj.get('period_end'))
        
        if not min_start or not max_end:
            # Invalid date ranges, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives
        
        # Preload all KPI entries for the global date range (1 query)
        kpi_query = {
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        increment_db_op("db.kpi_entries.find (batch - objectives)")
        all_kpi_entries = await self.db.kpi_entries.find(kpi_query, {"_id": 0}).to_list(100000)
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - objectives)")
        all_manager_kpis = await self.db.manager_kpis.find(manager_kpi_query, {"_id": 0}).to_list(100000)
        
        # Group KPI entries by (seller_id, date) for fast lookup
        kpi_by_seller_date = {}
        for entry in all_kpi_entries:
            seller_id = entry.get('seller_id')
            date = entry.get('date')
            if seller_id and date:
                key = (seller_id, date)
                if key not in kpi_by_seller_date:
                    kpi_by_seller_date[key] = []
                kpi_by_seller_date[key].append(entry)
        
        # Group manager KPIs by (manager_id, date) for fast lookup
        manager_kpi_by_date = {}
        for entry in all_manager_kpis:
            date = entry.get('date')
            if date:
                if date not in manager_kpi_by_date:
                    manager_kpi_by_date[date] = []
                manager_kpi_by_date[date].append(entry)
        
        # Calculate progress for each objective using preloaded data
        updates = []
        for objective in objectives:
            start_date = objective.get('period_start')
            end_date = objective.get('period_end')

            # If progress is entered manually by the manager, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual objectives.
            if str(objective.get('data_entry_responsible', '')).lower() == 'manager':
                target_value = objective.get('target_value', 0)
                current_value = float(objective.get('current_value') or 0)
                objective['status'] = self.compute_status(current_value, target_value, end_date)
                # Keep stored progress_* and current_value as-is; do not append bulk update.
                continue
            
            if not start_date or not end_date:
                # Invalid date range, set progress to 0
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), end_date)
                continue
            
            # Filter KPI entries for this objective's date range (in-memory filter)
            objective_kpi_entries = [
                entry for entry in all_kpi_entries
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Filter manager KPIs for this objective's date range (in-memory filter)
            objective_manager_kpis = [
                entry for entry in all_manager_kpis
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Calculate totals from seller entries
            total_ca = sum(e.get('ca_journalier', 0) for e in objective_kpi_entries)
            total_ventes = sum(e.get('nb_ventes', 0) for e in objective_kpi_entries)
            total_articles = sum(e.get('nb_articles', 0) for e in objective_kpi_entries)
            
            # Fallback to manager KPIs if seller data is missing
            if objective_manager_kpis:
                if total_ca == 0:
                    total_ca = sum(e.get('ca_journalier', 0) for e in objective_manager_kpis if e.get('ca_journalier'))
                if total_ventes == 0:
                    total_ventes = sum(e.get('nb_ventes', 0) for e in objective_manager_kpis if e.get('nb_ventes'))
                if total_articles == 0:
                    total_articles = sum(e.get('nb_articles', 0) for e in objective_manager_kpis if e.get('nb_articles'))
            
            # Calculate averages
            panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
            indice_vente = total_ca / total_articles if total_articles > 0 else 0
            
            # Update progress
            objective['progress_ca'] = total_ca
            objective['progress_ventes'] = total_ventes
            objective['progress_articles'] = total_articles
            objective['progress_panier_moyen'] = panier_moyen
            objective['progress_indice_vente'] = indice_vente
            
            # Determine current_value and target_value for status computation
            target_value = objective.get('target_value', 0)
            current_value = 0
            
            # For kpi_standard objectives, use the relevant KPI value
            if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
                kpi_name = objective['kpi_name']
                if kpi_name == 'ca':
                    current_value = total_ca
                elif kpi_name == 'ventes':
                    current_value = total_ventes
                elif kpi_name == 'articles':
                    current_value = total_articles
                elif kpi_name == 'panier_moyen':
                    current_value = panier_moyen
                elif kpi_name == 'indice_vente':
                    current_value = indice_vente
            else:
                # For other objective types, use current_value if set, otherwise calculate from CA
                current_value = objective.get('current_value', total_ca)
                # For legacy objectives, check if they have specific targets
                if objective.get('ca_target'):
                    target_value = objective.get('ca_target', 0)
                    current_value = total_ca
                elif objective.get('panier_moyen_target'):
                    target_value = objective.get('panier_moyen_target', 0)
                    current_value = panier_moyen
                elif objective.get('indice_vente_target'):
                    target_value = objective.get('indice_vente_target', 0)
                    current_value = indice_vente
            
            # Use centralized status computation
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            objective['current_value'] = current_value
            
            # Prepare batch update
            updates.append({
                "id": objective['id'],
                "update": {
                    "$set": {
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente,
                        "status": objective['status'],
                        "current_value": current_value
                    }
                }
            })
        
        # Batch update all objectives (1 bulk operation)
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
            if bulk_ops:
                # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
                increment_db_op("db.objectives.bulk_write")
                await self.db.objectives.bulk_write(bulk_ops)
        
        return objectives
    
    async def calculate_challenge_progress(self, challenge: dict, seller_id: str = None):
        """Calculate progress for a challenge"""
        start_date = challenge.get('start_date') or challenge.get('period_start')
        end_date = challenge.get('end_date') or challenge.get('period_end')
        manager_id = challenge['manager_id']
        store_id = challenge.get('store_id')
        
        if challenge.get('type') == 'collective':
            # Get all sellers for this manager/store
            seller_query = {"role": "seller"}
            if store_id:
                seller_query["store_id"] = store_id
            else:
                seller_query["manager_id"] = manager_id
            
            sellers = await self.db.users.find(
                seller_query,
                {"_id": 0, "id": 1}
            ).to_list(1000)
            seller_ids = [s['id'] for s in sellers]
            
            # Get KPI entries for all sellers in date range
            kpi_query = {
                "seller_id": {"$in": seller_ids},
                "date": {"$gte": start_date, "$lte": end_date}
            }
            if store_id:
                kpi_query["store_id"] = store_id
            
            entries = await self.db.kpi_entries.find(kpi_query, {"_id": 0}).to_list(10000)
        else:
            # Individual challenge
            target_seller_id = seller_id or challenge.get('seller_id')
            entries = await self.db.kpi_entries.find({
                "seller_id": target_seller_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }, {"_id": 0}).to_list(10000)
        
        # Calculate totals from seller entries
        total_ca = sum(e.get('ca_journalier', 0) for e in entries)
        total_ventes = sum(e.get('nb_ventes', 0) for e in entries)
        total_articles = sum(e.get('nb_articles', 0) for e in entries)
        
        # Fallback to manager KPIs if seller data is missing
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        manager_entries = await self.db.manager_kpis.find(manager_kpi_query, {"_id": 0}).to_list(10000)
        
        if manager_entries:
            if total_ca == 0:
                total_ca = sum(e.get('ca_journalier', 0) for e in manager_entries if e.get('ca_journalier'))
            if total_ventes == 0:
                total_ventes = sum(e.get('nb_ventes', 0) for e in manager_entries if e.get('nb_ventes'))
            if total_articles == 0:
                total_articles = sum(e.get('nb_articles', 0) for e in manager_entries if e.get('nb_articles'))
        
        # Calculate averages
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        indice_vente = total_ca / total_articles if total_articles > 0 else 0
        
        # Update progress
        challenge['progress_ca'] = total_ca
        challenge['progress_ventes'] = total_ventes
        challenge['progress_articles'] = total_articles
        challenge['progress_panier_moyen'] = panier_moyen
        challenge['progress_indice_vente'] = indice_vente
        
        # Check if challenge is completed
        if datetime.now().strftime('%Y-%m-%d') > end_date:
            if challenge['status'] == 'active':
                # Check if all targets are met
                completed = True
                if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                    completed = False
                if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                    completed = False
                if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                    completed = False
                if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                    completed = False
                
                new_status = 'completed' if completed else 'failed'
                await self.db.challenges.update_one(
                    {"id": challenge['id']},
                    {"$set": {
                        "status": new_status,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente
                    }}
                )
                challenge['status'] = new_status
        else:
            # Challenge in progress: save only progress values
            await self.db.challenges.update_one(
                {"id": challenge['id']},
                {"$set": {
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                }}
            )
    
    async def calculate_challenges_progress_batch(self, challenges: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple challenges in batch (optimized version)
        Preloads all KPI data once instead of N queries per challenge
        
        Args:
            challenges: List of challenge dicts
            manager_id: Manager ID
            store_id: Store ID (all challenges must be from same store)
        
        Returns:
            List of challenges with progress calculated (in-place modification)
        """
        if not challenges:
            return challenges
        
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id
        
        increment_db_op("db.users.find (sellers - challenges)")
        sellers = await self.db.users.find(
            seller_query,
            {"_id": 0, "id": 1}
        ).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        
        # Calculate global date range (min start, max end)
        date_ranges = []
        individual_seller_ids = set()
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            if start_date and end_date:
                date_ranges.append((start_date, end_date))
            
            # Collect individual challenge seller_ids
            if challenge.get('type') != 'collective':
                individual_seller_id = challenge.get('seller_id')
                if individual_seller_id:
                    individual_seller_ids.add(individual_seller_id)
        
        if not date_ranges:
            # No valid date ranges, set all progress to 0
            for challenge in challenges:
                challenge['progress_ca'] = 0
                challenge['progress_ventes'] = 0
                challenge['progress_articles'] = 0
                challenge['progress_panier_moyen'] = 0
                challenge['progress_indice_vente'] = 0
            return challenges
        
        min_start = min(dr[0] for dr in date_ranges)
        max_end = max(dr[1] for dr in date_ranges)
        
        # Combine seller_ids (collective + individual)
        all_seller_ids = list(set(seller_ids + list(individual_seller_ids)))
        
        # Preload all KPI entries for the global date range (1 query)
        kpi_query = {
            "seller_id": {"$in": all_seller_ids},
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        increment_db_op("db.kpi_entries.find (batch - challenges)")
        all_kpi_entries = await self.db.kpi_entries.find(kpi_query, {"_id": 0}).to_list(100000)
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - challenges)")
        all_manager_kpis = await self.db.manager_kpis.find(manager_kpi_query, {"_id": 0}).to_list(100000)
        
        # Calculate progress for each challenge using preloaded data
        updates = []
        today = datetime.now(timezone.utc).date().isoformat()
        
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            
            if not start_date or not end_date:
                # Invalid date range, set progress to 0
                challenge['progress_ca'] = 0
                challenge['progress_ventes'] = 0
                challenge['progress_articles'] = 0
                challenge['progress_panier_moyen'] = 0
                challenge['progress_indice_vente'] = 0
                continue
            
            # Filter KPI entries for this challenge's date range and type
            if challenge.get('type') == 'collective':
                # Collective: filter by seller_ids and date range
                challenge_kpi_entries = [
                    entry for entry in all_kpi_entries
                    if entry.get('seller_id') in seller_ids
                    and start_date <= entry.get('date', '') <= end_date
                ]
            else:
                # Individual: filter by specific seller_id and date range
                target_seller_id = challenge.get('seller_id')
                challenge_kpi_entries = [
                    entry for entry in all_kpi_entries
                    if entry.get('seller_id') == target_seller_id
                    and start_date <= entry.get('date', '') <= end_date
                ]
            
            # Filter manager KPIs for this challenge's date range
            challenge_manager_kpis = [
                entry for entry in all_manager_kpis
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Calculate totals from seller entries
            total_ca = sum(e.get('ca_journalier', 0) for e in challenge_kpi_entries)
            total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_kpi_entries)
            total_articles = sum(e.get('nb_articles', 0) for e in challenge_kpi_entries)
            
            # Fallback to manager KPIs if seller data is missing
            if challenge_manager_kpis:
                if total_ca == 0:
                    total_ca = sum(e.get('ca_journalier', 0) for e in challenge_manager_kpis if e.get('ca_journalier'))
                if total_ventes == 0:
                    total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_manager_kpis if e.get('nb_ventes'))
                if total_articles == 0:
                    total_articles = sum(e.get('nb_articles', 0) for e in challenge_manager_kpis if e.get('nb_articles'))
            
            # Calculate averages
            panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
            indice_vente = total_ca / total_articles if total_articles > 0 else 0
            
            # Update progress
            challenge['progress_ca'] = total_ca
            challenge['progress_ventes'] = total_ventes
            challenge['progress_articles'] = total_articles
            challenge['progress_panier_moyen'] = panier_moyen
            challenge['progress_indice_vente'] = indice_vente
            
            # Check if challenge is completed
            update_data = {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente
            }
            
            if today > end_date:
                if challenge.get('status') == 'active':
                    # Check if all targets are met
                    completed = True
                    if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                        completed = False
                    if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                        completed = False
                    if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                        completed = False
                    if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                        completed = False
                    
                    new_status = 'completed' if completed else 'failed'
                    challenge['status'] = new_status
                    update_data['status'] = new_status
                    update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
            
            # Prepare batch update
            updates.append({
                "id": challenge['id'],
                "update": {"$set": update_data}
            })
        
        # Batch update all challenges (1 bulk operation)
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
            if bulk_ops:
                increment_db_op("db.challenges.bulk_write")
                await self.db.challenges.bulk_write(bulk_ops)
        
        return challenges
