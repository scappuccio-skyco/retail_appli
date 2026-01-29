"""
Script d'indexation MongoDB - Production Ready (Audit 2.6).
Utilise core.indexes comme source unique de vérité.

Usage:
    python -m backend.scripts.ensure_indexes
    python backend/scripts/ensure_indexes.py

À exécuter lors de chaque déploiement.
"""
import asyncio
import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from motor.motor_asyncio import AsyncIOMotorClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    from core.indexes import apply_indexes

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "retail_coach")

    print("=" * 80)
    print("CRÉATION DES INDEXES MONGODB (core.indexes)")
    print("=" * 80)
    print(f"Connexion: {mongo_url}")
    print(f"Base: {db_name}\n")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        await db.command("ping")
        print("Connexion MongoDB établie\n")
    except Exception as e:
        print(f"Erreur connexion MongoDB: {e}")
        return

    created, skipped, errors = await apply_indexes(db, logger=logger)

    print("\n" + "=" * 80)
    print("RÉSUMÉ")
    print("=" * 80)
    print(f"Créés: {created}  |  Déjà existants: {skipped}  |  Erreurs: {len(errors)}")
    for coll, keys, e in errors:
        print(f"  - {coll} {keys}: {e}")
    print("=" * 80)
    print("Indexation terminée.")
    print("Index créés en background; disponibles sous peu.\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
