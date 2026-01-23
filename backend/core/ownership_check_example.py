"""
Exemple de code montrant la vérification de parenté (Ownership check) pour les données retail.

Ce module démontre comment implémenter correctement la vérification d'ownership
pour prévenir les attaques IDOR (Insecure Direct Object Reference).
"""

from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from core.security import get_current_user
from core.database import get_db


async def verify_seller_ownership_example(
    seller_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """
    ✅ BON EXEMPLE : Vérification de parenté complète pour accès à un vendeur.
    
    Cette fonction démontre la bonne pratique pour vérifier qu'un utilisateur
    a le droit d'accéder aux données d'un vendeur spécifique.
    
    Règles de vérification :
    1. Manager : Le vendeur doit appartenir au même store_id que le manager
    2. Gérant : Le vendeur doit appartenir à un magasin possédé par le gérant
    3. Seller : Le vendeur ne peut accéder qu'à ses propres données
    
    Args:
        seller_id: ID du vendeur à vérifier
        current_user: Utilisateur authentifié (depuis get_current_user)
        db: Connexion MongoDB
        
    Returns:
        Dict du vendeur si l'accès est autorisé
        
    Raises:
        HTTPException 403: Si l'utilisateur n'a pas accès à ce vendeur
        HTTPException 404: Si le vendeur n'existe pas
    """
    role = current_user.get('role')
    user_id = current_user.get('id')
    user_store_id = current_user.get('store_id')
    
    # ❌ MAUVAIS : Ne pas faire ça (vulnérable à IDOR)
    # seller = await db.users.find_one({"id": seller_id})
    # if seller.get('store_id') != user_store_id:
    #     raise HTTPException(403)
    
    # ✅ BON : Vérification dans la requête MongoDB (prévention IDOR)
    if role == 'seller':
        # Un vendeur ne peut accéder qu'à ses propres données
        if seller_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="Un vendeur ne peut accéder qu'à ses propres données"
            )
        # Récupérer le vendeur (son propre profil)
        seller = await db.users.find_one(
            {"id": seller_id, "role": "seller"},
            {"_id": 0, "password": 0}
        )
        
    elif role == 'manager':
        # Manager : Le vendeur doit appartenir au même store_id
        # ✅ CRITIQUE : Filtrer par store_id dans la requête MongoDB
        seller = await db.users.find_one(
            {
                "id": seller_id,
                "role": "seller",
                "store_id": user_store_id  # ⚠️ FILTRE CRITIQUE : prévient IDOR
            },
            {"_id": 0, "password": 0}
        )
        
        if not seller:
            # Vérifier si le vendeur existe ailleurs (sécurité : ne pas révéler l'existence)
            exists_elsewhere = await db.users.find_one(
                {"id": seller_id, "role": "seller"},
                {"_id": 0, "store_id": 1}
            )
            if exists_elsewhere:
                raise HTTPException(
                    status_code=403,
                    detail="Vendeur non trouvé ou n'appartient pas à votre magasin"
                )
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
            
    elif role in ['gerant', 'gérant']:
        # Gérant : Le vendeur doit appartenir à un magasin possédé par le gérant
        # ✅ CRITIQUE : Vérifier la parenté via la hiérarchie store → gérant
        
        # Étape 1 : Récupérer le vendeur avec son store_id
        seller = await db.users.find_one(
            {"id": seller_id, "role": "seller"},
            {"_id": 0, "password": 0, "store_id": 1}
        )
        
        if not seller:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
        
        seller_store_id = seller.get('store_id')
        if not seller_store_id:
            raise HTTPException(
                status_code=403,
                detail="Vendeur sans magasin assigné"
            )
        
        # Étape 2 : Vérifier que le magasin appartient au gérant
        # ✅ CRITIQUE : Vérification de parenté (store.gerant_id = current_user.id)
        store = await db.stores.find_one(
            {
                "id": seller_store_id,
                "gerant_id": user_id,  # ⚠️ FILTRE CRITIQUE : prévient IDOR
                "active": True
            },
            {"_id": 0, "id": 1, "name": 1}
        )
        
        if not store:
            # Store existe mais n'appartient pas au gérant
            raise HTTPException(
                status_code=403,
                detail="Ce vendeur n'appartient pas à l'un de vos magasins"
            )
        
        # Récupérer les données complètes du vendeur maintenant qu'on a vérifié l'ownership
        seller = await db.users.find_one(
            {"id": seller_id, "role": "seller"},
            {"_id": 0, "password": 0}
        )
        
    else:
        raise HTTPException(
            status_code=403,
            detail="Rôle non autorisé pour accéder aux données de vendeur"
        )
    
    return seller


async def verify_kpi_entry_ownership_example(
    kpi_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """
    ✅ BON EXEMPLE : Vérification de parenté pour accès à une entrée KPI.
    
    Démontre comment vérifier qu'une entrée KPI appartient bien à un vendeur
    accessible par l'utilisateur connecté.
    
    Args:
        kpi_id: ID de l'entrée KPI
        current_user: Utilisateur authentifié
        db: Connexion MongoDB
        
    Returns:
        Dict de l'entrée KPI si l'accès est autorisé
    """
    role = current_user.get('role')
    user_id = current_user.get('id')
    user_store_id = current_user.get('store_id')
    
    # ❌ MAUVAIS : Ne pas faire ça
    # kpi = await db.kpi_entries.find_one({"id": kpi_id})
    # seller = await db.users.find_one({"id": kpi['seller_id']})
    # if seller['store_id'] != user_store_id:
    #     raise HTTPException(403)
    
    # ✅ BON : Vérification en une seule requête avec jointure implicite
    
    if role == 'seller':
        # Seller : Ne peut accéder qu'à ses propres KPIs
        kpi = await db.kpi_entries.find_one(
            {
                "id": kpi_id,
                "seller_id": user_id  # ⚠️ FILTRE CRITIQUE
            },
            {"_id": 0}
        )
        
    elif role == 'manager':
        # Manager : Le KPI doit appartenir à un vendeur du même store
        # ✅ OPTIMISATION : Utiliser $lookup ou vérifier seller_id + store_id
        
        # Étape 1 : Récupérer le KPI avec seller_id
        kpi = await db.kpi_entries.find_one(
            {"id": kpi_id},
            {"_id": 0, "seller_id": 1, "store_id": 1}
        )
        
        if not kpi:
            raise HTTPException(status_code=404, detail="Entrée KPI non trouvée")
        
        # Étape 2 : Vérifier que le seller_id appartient au store du manager
        # ✅ CRITIQUE : Vérification de parenté (seller.store_id = manager.store_id)
        seller = await db.users.find_one(
            {
                "id": kpi.get('seller_id'),
                "role": "seller",
                "store_id": user_store_id  # ⚠️ FILTRE CRITIQUE
            },
            {"_id": 0, "id": 1}
        )
        
        if not seller:
            raise HTTPException(
                status_code=403,
                detail="Cette entrée KPI n'appartient pas à un vendeur de votre magasin"
            )
        
        # Récupérer les données complètes du KPI
        kpi = await db.kpi_entries.find_one(
            {"id": kpi_id},
            {"_id": 0}
        )
        
    elif role in ['gerant', 'gérant']:
        # Gérant : Le KPI doit appartenir à un vendeur d'un magasin possédé par le gérant
        # ✅ CRITIQUE : Vérification de parenté complète (kpi → seller → store → gérant)
        
        # Étape 1 : Récupérer le KPI avec seller_id
        kpi = await db.kpi_entries.find_one(
            {"id": kpi_id},
            {"_id": 0, "seller_id": 1, "store_id": 1}
        )
        
        if not kpi:
            raise HTTPException(status_code=404, detail="Entrée KPI non trouvée")
        
        seller_store_id = kpi.get('store_id')
        if not seller_store_id:
            # Si pas de store_id sur le KPI, vérifier via le seller
            seller = await db.users.find_one(
                {"id": kpi.get('seller_id'), "role": "seller"},
                {"_id": 0, "store_id": 1}
            )
            if seller:
                seller_store_id = seller.get('store_id')
        
        if not seller_store_id:
            raise HTTPException(
                status_code=403,
                detail="Impossible de déterminer le magasin de cette entrée KPI"
            )
        
        # Étape 2 : Vérifier que le magasin appartient au gérant
        # ✅ CRITIQUE : Vérification de parenté (store.gerant_id = current_user.id)
        store = await db.stores.find_one(
            {
                "id": seller_store_id,
                "gerant_id": user_id,  # ⚠️ FILTRE CRITIQUE
                "active": True
            },
            {"_id": 0, "id": 1}
        )
        
        if not store:
            raise HTTPException(
                status_code=403,
                detail="Cette entrée KPI n'appartient pas à l'un de vos magasins"
            )
        
        # Récupérer les données complètes du KPI
        kpi = await db.kpi_entries.find_one(
            {"id": kpi_id},
            {"_id": 0}
        )
        
    else:
        raise HTTPException(
            status_code=403,
            detail="Rôle non autorisé pour accéder aux entrées KPI"
        )
    
    return kpi


# ===== EXEMPLE D'UTILISATION DANS UNE ROUTE =====

"""
Exemple d'utilisation dans une route FastAPI :

from fastapi import APIRouter, Depends
from core.ownership_check_example import verify_seller_ownership_example

router = APIRouter()

@router.get("/seller/{seller_id}/stats")
async def get_seller_stats(
    seller_id: str,
    seller: dict = Depends(verify_seller_ownership_example),  # ✅ Vérification automatique
    db = Depends(get_db)
):
    # seller est garanti d'être accessible par current_user
    # Plus besoin de vérification manuelle
    stats = await calculate_stats(seller_id)
    return stats
"""
