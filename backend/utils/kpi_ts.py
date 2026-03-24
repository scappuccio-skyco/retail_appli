"""
Helper : conversion date string → datetime pour le champ timeField Time Series.

Le champ `ts` est utilisé exclusivement par MongoDB pour l'organisation interne
des buckets de la collection Time Series kpi_entries.
Les requêtes applicatives continuent d'utiliser le champ `date` (string YYYY-MM-DD).
"""
from datetime import datetime, timezone


def date_str_to_ts(date_str: str) -> datetime:
    """
    Convertit une date YYYY-MM-DD en datetime UTC minuit.
    Utilisé comme timeField de la collection Time Series kpi_entries.

    Args:
        date_str: Date au format "YYYY-MM-DD"

    Returns:
        datetime UTC à minuit (timezone-aware)

    Raises:
        ValueError: Si le format de date est invalide
    """
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
