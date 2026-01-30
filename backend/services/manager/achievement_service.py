"""
Manager - Achievements: objectifs et défis (CRUD, actifs, progression).
Repositories + NotificationService injectés par __init__ (pas de db direct).
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository


class ManagerAchievementService:
    """Service objectifs et défis (repos + notification injectés)."""

    def __init__(
        self,
        objective_repo: ObjectiveRepository,
        challenge_repo: ChallengeRepository,
        notification_service,
    ):
        self.objective_repo = objective_repo
        self.challenge_repo = challenge_repo
        self.notification_service = notification_service

    # ----- Objectifs -----

    async def get_objective_by_id(self, objective_id: str) -> Optional[Dict]:
        """Objectif par id (tous magasins)."""
        return await self.objective_repo.find_one(
            {"id": objective_id}, {"_id": 0}
        )

    async def get_objective_by_id_and_store(
        self, objective_id: str, store_id: str
    ) -> Optional[Dict]:
        """Objectif par id et magasin."""
        return await self.objective_repo.find_one(
            {"id": objective_id, "store_id": store_id}, {"_id": 0}
        )

    async def get_objectives_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        """Objectifs du magasin."""
        return await self.objective_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=limit
        )

    async def create_objective(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        """Création d’un objectif."""
        return await self.objective_repo.create_objective(
            data, store_id=store_id, manager_id=manager_id
        )

    async def update_objective(
        self,
        objective_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Mise à jour d’un objectif."""
        return await self.objective_repo.update_objective(
            objective_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def delete_objective(
        self,
        objective_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Suppression d’un objectif."""
        return await self.objective_repo.delete_objective(
            objective_id, store_id=store_id, manager_id=manager_id
        )

    async def update_objective_with_progress_history(
        self,
        objective_id: str,
        update_data: Dict,
        progress_entry: Dict,
        store_id: str,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Mise à jour objectif + ajout dans progress_history."""
        update_doc = {
            "$set": update_data,
            "$push": {
                "progress_history": {"$each": [progress_entry], "$slice": -50},
            },
        }
        filters = {"id": objective_id, "store_id": store_id}
        return await self.objective_repo.update_one(filters, update_doc)

    async def get_active_objectives(
        self, manager_id: str, store_id: str
    ) -> List[Dict]:
        """Objectifs actifs (filtre statut + période + flags notification)."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        all_objectives = await self.objective_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        objectives = [
            obj
            for obj in all_objectives
            if (obj.get("status") == "active" and obj.get("period_end", "") >= today)
            or obj.get("status") == "achieved"
        ]
        await self.notification_service.add_achievement_notification_flag(
            objectives, manager_id, "objective"
        )
        return objectives

    # ----- Défis -----

    async def get_challenge_by_id(self, challenge_id: str) -> Optional[Dict]:
        """Défi par id (tous magasins)."""
        return await self.challenge_repo.find_one(
            {"id": challenge_id}, {"_id": 0}
        )

    async def get_challenge_by_id_and_store(
        self, challenge_id: str, store_id: str
    ) -> Optional[Dict]:
        """Défi par id et magasin."""
        return await self.challenge_repo.find_one(
            {"id": challenge_id, "store_id": store_id}, {"_id": 0}
        )

    async def get_challenges_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        """Défis du magasin."""
        return await self.challenge_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=limit
        )

    async def create_challenge(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        """Création d’un défi."""
        return await self.challenge_repo.create_challenge(
            data, store_id=store_id, manager_id=manager_id
        )

    async def update_challenge(
        self,
        challenge_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Mise à jour d’un défi."""
        return await self.challenge_repo.update_challenge(
            challenge_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def delete_challenge(
        self,
        challenge_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Suppression d’un défi."""
        return await self.challenge_repo.delete_challenge(
            challenge_id, store_id=store_id, manager_id=manager_id
        )

    async def update_challenge_with_progress_history(
        self,
        challenge_id: str,
        update_data: Dict,
        progress_entry: Dict,
        store_id: str,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Mise à jour défi + ajout dans progress_history."""
        update_doc = {
            "$set": update_data,
            "$push": {
                "progress_history": {"$each": [progress_entry], "$slice": -50},
            },
        }
        filters = {"id": challenge_id, "store_id": store_id}
        return await self.challenge_repo.update_one(filters, update_doc)

    async def get_active_challenges(
        self, manager_id: str, store_id: str
    ) -> List[Dict]:
        """Défis actifs (filtre statut + période + flags notification)."""
        all_challenges = await self.challenge_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        challenges = [
            c
            for c in all_challenges
            if c.get("status") in ["active", "completed"]
            and c.get("end_date", "") >= today
        ]
        await self.notification_service.add_achievement_notification_flag(
            challenges, manager_id, "challenge"
        )
        return challenges
