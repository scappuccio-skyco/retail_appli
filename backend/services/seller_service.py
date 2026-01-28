"""
Seller Service
Business logic for seller-specific operations (tasks, objectives, challenges)
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from uuid import uuid4

from repositories.user_repository import UserRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.manager_request_repository import ManagerRequestRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.achievement_notification_repository import AchievementNotificationRepository

logger = logging.getLogger(__name__)


class SellerService:
    """Service for seller-specific operations"""
    
    def __init__(self, db):
        self.db = db
        # ✅ PHASE 7: Inject repositories instead of direct DB access
        self.user_repo = UserRepository(db)
        self.diagnostic_repo = DiagnosticRepository(db)
        self.manager_request_repo = ManagerRequestRepository(db)
        self.objective_repo = ObjectiveRepository(db)
        self.challenge_repo = ChallengeRepository(db)
        self.kpi_repo = KPIRepository(db)
        self.manager_kpi_repo = ManagerKPIRepository(db)
        self.achievement_notification_repo = AchievementNotificationRepository(db)
    
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
        notification = await self.achievement_notification_repo.find_by_user_and_item(
            user_id, item_type, item_id
        )
        return notification is not None
    
    async def mark_achievement_as_seen(self, user_id: str, item_type: str, item_id: str):
        """
        Mark an achievement notification as seen by a user
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
        """
        now = datetime.now(timezone.utc).isoformat()
        notification_data = {
            "seen_at": now,
            "updated_at": now,
            "created_at": now
        }
        await self.achievement_notification_repo.upsert_notification(
            user_id, item_type, item_id, notification_data
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
        diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)
        
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
        requests_list = await self.manager_request_repo.find_by_seller(
            seller_id, status="pending", limit=100
        )
        
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
    
    async def get_seller_objectives_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get active team objectives for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but objectives will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "period_end": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get active objectives from the store (created by manager OR gérant)
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", 1)]
        )
        # Filter by period_end and visible
        objectives = [obj for obj in objectives if obj.get("period_end", "") >= today and obj.get("visible", False)]
        
        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            visible_to = objective.get('visible_to_sellers')
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)
        
        # Ensure status field exists and is up-to-date (recalculate if needed)
        for objective in filtered_objectives:
            current_val = objective.get('current_value', 0)
            target_val = objective.get('target_value', 0)
            period_end = objective.get('period_end')
            
            # Always recalculate status to ensure it's correct (especially after progress updates)
            if period_end:
                new_status = self.compute_status(current_val, target_val, period_end)
                old_status = objective.get('status')
                objective['status'] = new_status
                
                # Status updated
            else:
                objective['status'] = 'active'  # Fallback if no end_date
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_objectives, seller_id, "objective")
        
        # Filter out achieved objectives (they should go to history)
        # Achieved objectives are moved to history, regardless of notification status
        # The notification can still be shown when viewing history or dashboard
        # IMPORTANT: Once an objective is "achieved", it should NEVER appear in active list again
        final_objectives = []
        
        for objective in filtered_objectives:
            status = objective.get('status')
            
            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved objectives go to history (even if has_unseen_achievement is true)
            # The notification modal should be triggered BEFORE the objective moves to history
            if status in ['active', 'failed']:
                final_objectives.append(objective)
            elif status == 'achieved':
                # Exclude from active list - will appear in history
                # Even if has_unseen_achievement is true, don't show it in active list
                pass
            # All other statuses are excluded
        
        return final_objectives
    
    async def get_seller_objectives_all(self, seller_id: str, manager_id: Optional[str] = None) -> Dict:
        """
        Get all team objectives (active and inactive) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
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
        all_objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", -1)]
        )
        # Filter by visible
        all_objectives = [obj for obj in all_objectives if obj.get("visible", False)]
        
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
    
    async def get_seller_objectives_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed objectives (past period_end date OR achieved with notification seen) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible
        # Include objectives that are:
        # 1. Past period_end date (period_end < today)
        # 2. OR status is 'achieved' or 'failed' (regardless of period_end)
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"period_end": {"$lt": today}},  # Period ended
                {"status": {"$in": ["achieved", "failed"]}}  # Or achieved/failed (even if period not ended)
            ]
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get past objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("period_start", -1)]
        )
        # Filter by period_end, status, and visible
        objectives = [obj for obj in objectives if (
            obj.get("period_end", "") < today or obj.get("status") in ["achieved", "failed"]
        ) and obj.get("visible", False)]
        
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
        
        # Calculate progress for each objective (this will recalculate status)
        for objective in filtered_objectives:
            await self.calculate_objective_progress(objective, manager_id)
        
        # Filter: include ALL objectives that should be in history
        # 1. Period ended (period_end < today) - regardless of status
        # 2. OR status is 'achieved'/'failed' - regardless of notification status
        # This ensures achieved objectives appear in history even if notification wasn't seen
        final_objectives = []
        for objective in filtered_objectives:
            # Recalculate status to ensure it's up-to-date based on current_value and target_value
            # Ensure values are floats for proper comparison (handles string/int/float types)
            current_val = float(objective.get('current_value', 0)) if objective.get('current_value') is not None else 0.0
            target_val = float(objective.get('target_value', 0)) if objective.get('target_value') is not None else 0.0
            period_end_str = objective.get('period_end', '')
            
            if period_end_str:
                # Always recalculate status to ensure it's correct
                new_status = self.compute_status(current_val, target_val, period_end_str)
                objective['status'] = new_status
            
            status = objective.get('status')
            period_end = objective.get('period_end', '')
            
            # Include in history if:
            # 1. Period has ended (regardless of status)
            # 2. OR status is achieved/failed (regardless of period_end or notification status)
            if period_end < today:
                # Period ended, include in history
                final_objectives.append(objective)
            elif status in ['achieved', 'failed']:
                # Achieved/failed, include in history (even if notification not seen)
                final_objectives.append(objective)
            
            # Add 'achieved' property for frontend compatibility
            # achieved = True if status is 'achieved', False otherwise
            objective['achieved'] = (status == 'achieved')
        
        return final_objectives
    
    # ===== CHALLENGES =====
    
    async def get_seller_challenges(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get all challenges (collective + individual) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
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
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)]
        )
        # Filter by visible and type
        challenges = [c for c in challenges if c.get("visible", False) and (
            c.get("type") == "collective" or (c.get("type") == "individual" and c.get("seller_id") == seller_id)
        )]
        
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
    
    async def get_seller_challenges_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get only active challenges (collective + personal) for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but challenges will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        # Note: We don't filter by status here because we need to calculate it first
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get active challenges from the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=10,
            sort=[("start_date", 1)]
        )
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") >= today and c.get("visible", False)]
        
        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            visible_to = challenge.get('visible_to_sellers')
            
            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                # If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")
        
        # Filter out achieved/completed challenges (they should go to history)
        final_challenges = []
        for challenge in filtered_challenges:
            status = challenge.get('status')
            
            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved/completed challenges go to history
            if status in ['active', 'failed']:
                final_challenges.append(challenge)
            elif status in ['achieved', 'completed']:
                # Exclude from active list - will appear in history
                pass
            # All other statuses are excluded
        
        return final_challenges
    
    async def get_seller_challenges_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed challenges (past end_date) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
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
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("start_date", -1)]
        )
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") < today and c.get("visible", False)]
        
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
        
        # Add 'achieved' property for frontend compatibility
        for challenge in filtered_challenges:
            status = challenge.get('status')
            # achieved = True if status is 'achieved' or 'completed', False otherwise
            challenge['achieved'] = (status in ['achieved', 'completed'])
        
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
        
        # Ensure both values are floats for proper comparison (handles string/int/float types)
        current_value = float(current_value) if current_value is not None else 0.0
        target_value = float(target_value) if target_value is not None else 0.0
        
        # Check if objective is achieved (only if target is meaningful and current >= target)
        is_achieved = False
        if target_value > 0.01:  # Only consider achieved if target is meaningful
            # Use a small epsilon for floating point comparison to handle precision issues
            # This ensures that values like 30000.0 >= 30000.0 are correctly identified as achieved
            is_achieved = current_value >= (target_value - 0.001)
        
        # Check if period is over (today is after end_date)
        is_expired = today > end_date_obj
        
        # Determine status
        if is_achieved:
            return "achieved"
        elif is_expired:
            return "failed"
        else:
            return "active"
    
    async def calculate_objective_progress(self, objective: dict, manager_id: Optional[str] = None):
        """Calculate progress for an objective (team-wide)
        
        Args:
            objective: Objective dictionary
            manager_id: Optional manager ID (used only if store_id is not available for backward compatibility)
        """
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = objective.get('target_value', 0)
            end_date = objective.get('period_end') or objective.get('end_date')
            current_value = float(objective.get('current_value') or 0)
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            # Only update status in DB, keep current_value as-is (manually entered)
            await self.objective_repo.update_objective(
                objective['id'],
                {"status": objective['status']},
                store_id=objective.get('store_id'),
                manager_id=objective.get('manager_id')
            )
            return

        start_date = objective['period_start']
        end_date = objective['period_end']
        store_id = objective.get('store_id')
        
        # Build query for sellers - prioritize store_id (multi-store support)
        seller_query = {"role": "seller"}
        if store_id:
            # CRITICAL: Use store_id for filtering (works for objectives created by managers OR gérants)
            seller_query["store_id"] = store_id
        elif manager_id:
            # Fallback to manager_id for backward compatibility (only if store_id is not available)
            seller_query["manager_id"] = manager_id
        else:
            # No store_id and no manager_id - cannot calculate progress
            return
        
        # Get all sellers for this store/manager (PHASE 8: iterator via repository, no .collection)
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
        # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency
        from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
        
        kpi_repo = KPIRepository(self.db)
        manager_kpi_repo = ManagerKPIRepository(self.db)
        
        # Build KPI query with store_id filter if available
        kpi_query = {
            "seller_id": {"$in": seller_ids}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        # Use aggregation to calculate totals (optimized - no .to_list(10000))
        date_range = {"$gte": start_date, "$lte": end_date}
        seller_totals = await kpi_repo.aggregate_totals(kpi_query, date_range)
        
        total_ca = seller_totals["total_ca"]
        total_ventes = seller_totals["total_ventes"]
        total_articles = seller_totals["total_articles"]
        
        # Fallback to manager KPIs if seller data is missing (only if manager_id is available)
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id
            
            manager_totals = await manager_kpi_repo.aggregate_totals(manager_kpi_query, date_range)
            
            if total_ca == 0:
                total_ca = manager_totals["total_ca"]
            if total_ventes == 0:
                total_ventes = manager_totals["total_ventes"]
            if total_articles == 0:
                total_articles = manager_totals["total_articles"]
        
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
        elif objective.get('objective_type') == 'product_focus':
            # For product_focus objectives, use current_value if manually entered, otherwise use target_value as fallback
            # The current_value should be updated manually by seller/manager via progress update endpoint
            current_value = float(objective.get('current_value', 0))
            # If current_value is 0 but we have progress data, it means it hasn't been updated yet
            # In this case, we should use the stored current_value (which might be from manual entry)
        elif objective.get('objective_type') == 'custom':
            # For custom objectives, use current_value if manually entered
            current_value = float(objective.get('current_value', 0))
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
        
        # Ensure current_value and target_value are floats for proper comparison
        current_value = float(current_value) if current_value else 0.0
        target_value = float(target_value) if target_value else 0.0
        
        # Use centralized status computation
        objective['status'] = self.compute_status(current_value, target_value, end_date)
        
        # Save progress to database (including computed status)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        await self.objective_repo.update_objective(
            objective['id'],
            {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente,
                "status": objective['status'],
                "current_value": current_value
            },
            store_id=objective.get('store_id'),
            manager_id=objective.get('manager_id')
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
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
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
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # If more data is needed, use streaming/cursor approach
        MAX_KPI_BATCH_SIZE = 10000
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_kpi_entries = await self.kpi_repo.find_many(kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_kpi_entries) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"KPI entries query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - objectives)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_manager_kpis = await self.manager_kpi_repo.find_many(manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
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

            # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual objectives.
            # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
            data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
            if data_entry_responsible in ['manager', 'seller']:
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
                await self.objective_repo.bulk_write(bulk_ops)
        
        return objectives
    
    async def calculate_challenge_progress(self, challenge: dict, seller_id: str = None):
        """Calculate progress for a challenge"""
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = challenge.get('target_value', 0)
            end_date = challenge.get('end_date') or challenge.get('period_end')
            current_value = float(challenge.get('current_value') or 0)
            # Recalculate status based on current_value (manually entered)
            new_status = self.compute_status(current_value, target_value, end_date)
            challenge['status'] = new_status
            # Only update status in DB, keep current_value as-is (manually entered)
            update_data = {"status": new_status}
            if new_status in ['achieved', 'completed']:
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            await self.challenge_repo.update_challenge(
                challenge['id'],
                update_data,
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
            )
            return
        
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
            
            # PHASE 8: iterator via repository, no .collection / no limit=1000
            seller_ids = []
            async for uid in self.user_repo.find_ids_by_query(seller_query):
                seller_ids.append(uid)
            
            # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency
            # ✅ PHASE 7: Use injected repositories
            kpi_repo = self.kpi_repo
            manager_kpi_repo = self.manager_kpi_repo
            
            # Get KPI entries for all sellers in date range
            kpi_query = {
                "seller_id": {"$in": seller_ids}
            }
            if store_id:
                kpi_query["store_id"] = store_id
            
            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await kpi_repo.aggregate_totals(kpi_query, date_range)
            
            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]
        else:
            # Individual challenge
            from repositories.kpi_repository import KPIRepository
            
            kpi_repo = KPIRepository(self.db)
            target_seller_id = seller_id or challenge.get('seller_id')
            
            kpi_query = {"seller_id": target_seller_id}
            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await kpi_repo.aggregate_totals(kpi_query, date_range)
            
            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]
        
        # Fallback to manager KPIs if seller data is missing
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            from repositories.kpi_repository import ManagerKPIRepository
            
            manager_kpi_repo = ManagerKPIRepository(self.db)
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id
            
            date_range = {"$gte": start_date, "$lte": end_date}
            manager_totals = await manager_kpi_repo.aggregate_totals(manager_kpi_query, date_range)
            
            if total_ca == 0:
                total_ca = manager_totals["total_ca"]
            if total_ventes == 0:
                total_ventes = manager_totals["total_ventes"]
            if total_articles == 0:
                total_articles = manager_totals["total_articles"]
        
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
                await self.challenge_repo.update_challenge(
                    challenge['id'],
                    {
                        "status": new_status,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente
                    },
                    store_id=challenge.get('store_id'),
                    manager_id=challenge.get('manager_id')
                )
                challenge['status'] = new_status
        else:
            # Challenge in progress: save only progress values
            await self.challenge_repo.update_challenge(
                challenge['id'],
                {
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                },
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
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
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
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
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        MAX_KPI_BATCH_SIZE = 10000
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_kpi_entries = await self.kpi_repo.find_many(kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_kpi_entries) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"KPI entries query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - challenges)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_manager_kpis = await self.manager_kpi_repo.find_many(manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Calculate progress for each challenge using preloaded data
        updates = []
        today = datetime.now(timezone.utc).date().isoformat()
        
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            
            # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual challenges.
            # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
            data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
            if data_entry_responsible in ['manager', 'seller']:
                target_value = challenge.get('target_value', 0)
                current_value = float(challenge.get('current_value') or 0)
                new_status = self.compute_status(current_value, target_value, end_date)
                challenge['status'] = new_status
                # Keep stored progress_* and current_value as-is; do not append bulk update.
                continue
            
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
                await self.challenge_repo.bulk_write(bulk_ops)
        
        return challenges
