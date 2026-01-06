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
        """Get active team objectives for display in seller dashboard"""
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get active objectives from the seller's manager
        objectives = await self.db.manager_objectives.find(
            {
                "manager_id": manager_id,
                "period_end": {"$gte": today},
                "visible": True
            },
            {"_id": 0}
        ).sort("period_start", 1).to_list(10)
        
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
                visible_to = objective.get('visible_to_sellers', [])
                if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                    filtered_objectives.append(objective)
        
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
        
        return filtered_objectives
    
    async def get_seller_objectives_all(self, seller_id: str, manager_id: str) -> Dict:
        """Get all team objectives (active and inactive) for seller"""
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get ALL objectives from the seller's manager
        all_objectives = await self.db.manager_objectives.find(
            {
                "manager_id": manager_id,
                "visible": True
            },
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
                visible_to = objective.get('visible_to_sellers', [])
                if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
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
        """Get completed objectives (past period_end date) for seller"""
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get past objectives from the seller's manager
        objectives = await self.db.manager_objectives.find(
            {
                "manager_id": manager_id,
                "period_end": {"$lt": today},
                "visible": True
            },
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
                visible_to = objective.get('visible_to_sellers', [])
                if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                    filtered_objectives.append(objective)
        
        # Calculate progress for each objective
        for objective in filtered_objectives:
            await self.calculate_objective_progress(objective, manager_id)
        
        return filtered_objectives
    
    # ===== CHALLENGES =====
    
    async def get_seller_challenges(self, seller_id: str, manager_id: str) -> List[Dict]:
        """Get all challenges (collective + individual) for seller"""
        # Get collective challenges + individual challenges assigned to this seller
        challenges = await self.db.challenges.find(
            {
                "manager_id": manager_id,
                "$or": [
                    {"type": "collective"},
                    {"type": "individual", "seller_id": seller_id}
                ]
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Calculate progress for each challenge
        for challenge in challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        return challenges
    
    async def get_seller_challenges_active(self, seller_id: str, manager_id: str) -> List[Dict]:
        """Get only active challenges (collective + personal) for display in seller dashboard"""
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get active challenges from the seller's manager
        challenges = await self.db.challenges.find(
            {
                "manager_id": manager_id,
                "status": "active",
                "end_date": {"$gte": today},
                "visible": True
            },
            {"_id": 0}
        ).sort("start_date", 1).to_list(10)
        
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
                visible_to = challenge.get('visible_to_sellers', [])
                if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        return filtered_challenges
    
    async def get_seller_challenges_history(self, seller_id: str, manager_id: str) -> List[Dict]:
        """Get completed challenges (past end_date) for seller"""
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get past challenges from the seller's manager
        challenges = await self.db.challenges.find(
            {
                "manager_id": manager_id,
                "end_date": {"$lt": today},
                "visible": True
            },
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
                visible_to = challenge.get('visible_to_sellers', [])
                if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
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
        await self.db.manager_objectives.update_one(
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
