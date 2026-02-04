"""
Schémas et constantes de réponse partagés entre routes (briefs, evaluations, etc.).
Réduit la duplication pour Sonar.
"""
from typing import Any, Dict

# Réponse vide pour listes de briefs (évite duplication dans briefs.py)
EMPTY_BRIEFS_RESPONSE: Dict[str, Any] = {"briefs": [], "total": 0}
