"""
Manager - Store: configuration magasin, mode sync, KPI config.
Repositories injectés par __init__ (pas de db direct).
"""
from typing import Dict, Optional

from repositories.store_repository import StoreRepository
from repositories.kpi_config_repository import KPIConfigRepository


class ManagerStoreService:
    """Service pour la config magasin et sync (repos injectés)."""

    def __init__(
        self,
        store_repo: StoreRepository,
        kpi_config_repo: KPIConfigRepository,
    ):
        self.store_repo = store_repo
        self.kpi_config_repo = kpi_config_repo

    async def get_store_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
    ) -> Optional[Dict]:
        """Récupère un magasin par id (optionnellement vérifie gerant_id)."""
        return await self.store_repo.find_by_id(
            store_id=store_id,
            gerant_id=gerant_id,
            projection=projection or {"_id": 0},
        )

    async def get_store_by_id_simple(
        self, store_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Récupère un magasin par id sans vérif gérant (existence)."""
        return await self.store_repo.find_one(
            {"id": store_id}, projection or {"_id": 0}
        )

    async def get_sync_mode(self, store_id: str) -> Dict:
        """Configuration du mode de synchronisation du magasin."""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        if not store:
            return {
                "sync_mode": "manual",
                "external_sync_enabled": False,
                "is_enterprise": False,
                "can_edit_kpi": True,
                "can_edit_objectives": True,
            }
        sync_mode = store.get("sync_mode") or "manual"
        return {
            "sync_mode": sync_mode,
            "external_sync_enabled": sync_mode == "api_sync",
            "is_enterprise": sync_mode in ["api_sync", "scim_sync"],
            "can_edit_kpi": sync_mode == "manual",
            "can_edit_objectives": True,
        }

    async def get_kpi_config(self, store_id: str) -> Dict:
        """Configuration KPI du magasin."""
        config = await self.kpi_config_repo.find_one(
            {"store_id": store_id},
            {"_id": 0},
        )
        if not config:
            return {
                "store_id": store_id,
                "enabled_kpis": [
                    "ca_journalier",
                    "nb_ventes",
                    "nb_articles",
                    "panier_moyen",
                ],
                "required_kpis": ["ca_journalier", "nb_ventes"],
                "saisie_enabled": True,
            }
        return config

    async def upsert_kpi_config(
        self,
        store_id: Optional[str],
        manager_id: Optional[str],
        update_data: Dict,
    ) -> Dict:
        """Upsert de la config KPI."""
        return await self.kpi_config_repo.upsert_config(
            store_id=store_id,
            manager_id=manager_id,
            update_data=update_data,
        )
