"""
Seller Service
Business logic for seller-specific operations (tasks, objectives, challenges)
"""
from datetime import datetime, timezone
from typing import List, Dict, Optional
from uuid import uuid4

from core.database import database


class SellerService:
    """Service for seller-specific operations"""
    
    def __init__(self):
        self.db = database.get_db()
    
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
                current_val = objective.get('current_value', 0)
                target_val = objective.get('target_value', 1)
                today_date = datetime.now(timezone.utc).date()
                period_end_date = datetime.fromisoformat(objective['period_end']).date()
                
                if current_val >= target_val:
                    objective['status'] = 'achieved'
                elif today_date > period_end_date:
                    objective['status'] = 'failed'
                else:
                    objective['status'] = 'active'
        
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
    
    async def calculate_objective_progress(self, objective: dict, manager_id: str):
        """Calculate progress for an objective (team-wide)"""
        start_date = objective['period_start']
        end_date = objective['period_end']
        
        # Get all sellers for this manager
        sellers = await self.db.users.find(
            {"manager_id": manager_id, "role": "seller"}, 
            {"_id": 0, "id": 1}
        ).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        
        # Get KPI entries for all sellers in date range
        entries = await self.db.kpi_entries.find({
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(10000)
        
        # Calculate totals from seller entries
        total_ca = sum(e.get('ca_journalier', 0) for e in entries)
        total_ventes = sum(e.get('nb_ventes', 0) for e in entries)
        total_articles = sum(e.get('nb_articles', 0) for e in entries)
        
        # Fallback to manager KPIs if seller data is missing
        manager_entries = await self.db.manager_kpis.find({
            "manager_id": manager_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(10000)
        
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
        
        # Determine status based on objective_type
        today = datetime.now(timezone.utc).date().isoformat()
        
        # For kpi_standard objectives, compare the relevant KPI with target_value
        if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
            kpi_name = objective['kpi_name']
            target = objective.get('target_value', 0)
            
            # Map KPI names to their calculated values
            current_kpi_value = 0
            if kpi_name == 'ca':
                current_kpi_value = total_ca
            elif kpi_name == 'ventes':
                current_kpi_value = total_ventes
            elif kpi_name == 'articles':
                current_kpi_value = total_articles
            elif kpi_name == 'panier_moyen':
                current_kpi_value = panier_moyen
            elif kpi_name == 'indice_vente':
                current_kpi_value = indice_vente
            
            objective_met = current_kpi_value >= target
            
            if today > end_date:
                objective['status'] = 'achieved' if objective_met else 'failed'
            else:
                objective['status'] = 'achieved' if objective_met else 'active'
        else:
            # For other objective types (legacy logic)
            if today > end_date:
                objective_met = True
                if objective.get('ca_target') and total_ca < objective['ca_target']:
                    objective_met = False
                if objective.get('panier_moyen_target') and panier_moyen < objective['panier_moyen_target']:
                    objective_met = False
                if objective.get('indice_vente_target') and indice_vente < objective['indice_vente_target']:
                    objective_met = False
                
                objective['status'] = 'achieved' if objective_met else 'failed'
            else:
                objective_met = True
                if objective.get('ca_target') and total_ca < objective['ca_target']:
                    objective_met = False
                if objective.get('panier_moyen_target') and panier_moyen < objective['panier_moyen_target']:
                    objective_met = False
                if objective.get('indice_vente_target') and indice_vente < objective['indice_vente_target']:
                    objective_met = False
                
                objective['status'] = 'achieved' if objective_met else 'in_progress'
        
        # Save progress to database
        await self.db.manager_objectives.update_one(
            {"id": objective['id']},
            {"$set": {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente,
                "status": objective.get('status', 'in_progress')
            }}
        )
    
    async def calculate_challenge_progress(self, challenge: dict, seller_id: str = None):
        """Calculate progress for a challenge"""
        start_date = challenge['start_date']
        end_date = challenge['end_date']
        manager_id = challenge['manager_id']
        
        if challenge['type'] == 'collective':
            # Get all sellers for this manager
            sellers = await self.db.users.find(
                {"manager_id": manager_id, "role": "seller"}, 
                {"_id": 0, "id": 1}
            ).to_list(1000)
            seller_ids = [s['id'] for s in sellers]
            
            # Get KPI entries for all sellers in date range
            entries = await self.db.kpi_entries.find({
                "seller_id": {"$in": seller_ids},
                "date": {"$gte": start_date, "$lte": end_date}
            }, {"_id": 0}).to_list(10000)
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
        manager_entries = await self.db.manager_kpis.find({
            "manager_id": manager_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(10000)
        
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
