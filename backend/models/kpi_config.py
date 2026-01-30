"""
Default KPI configuration and Pydantic model for store KPI settings.
Single source of truth for default values used in manager and store routes.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# Dictionnaire par défaut (enabled, saisie_enabled, seller_track_*, manager_track_*).
# Utilisé quand aucun store_id ou aucune config en base.
DEFAULT_KPI_CONFIG: dict = {
    "enabled": True,
    "saisie_enabled": True,
    "seller_track_ca": True,
    "seller_track_ventes": True,
    "seller_track_articles": True,
    "seller_track_prospects": True,
    "manager_track_ca": False,
    "manager_track_ventes": False,
    "manager_track_articles": False,
    "manager_track_prospects": False,
}


def get_default_kpi_config(store_id: Optional[str] = None) -> dict:
    """
    Retourne une copie de la config KPI par défaut.
    Si store_id est fourni, l'ajoute au dictionnaire (pour les réponses API).
    """
    config = dict(DEFAULT_KPI_CONFIG)
    if store_id is not None:
        config["store_id"] = store_id
    return config


class KPIConfig(BaseModel):
    """
    Modèle Pydantic pour typer la configuration KPI d'un magasin (réponse API).
    Tous les champs optionnels pour accepter les réponses partielles ou avec store_id.
    """
    model_config = ConfigDict(extra="allow")

    store_id: Optional[str] = Field(None, description="ID du magasin")
    enabled: bool = Field(True, description="Saisie KPI activée pour les vendeurs")
    saisie_enabled: bool = Field(True, description="Alias de enabled")
    seller_track_ca: bool = True
    seller_track_ventes: bool = True
    seller_track_articles: bool = True
    seller_track_prospects: bool = True
    manager_track_ca: bool = False
    manager_track_ventes: bool = False
    manager_track_articles: bool = False
    manager_track_prospects: bool = False
