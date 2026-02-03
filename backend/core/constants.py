"""
Constantes centralisées (messages d'erreur, libellés API, opérateurs MongoDB).
CHUNK 2 SonarQube : éviter la duplication de littéraux dans backend/api/routes/ et core.
"""

# ----- Descriptions des paramètres Query (OpenAPI) -----
QUERY_PAGE_NUM_DESC = "Numéro de page"
QUERY_PAGE_SIZE_DESC = "Nombre d'éléments par page"
QUERY_STORE_ID_REQUIS_GERANT = "Store ID (requis pour gérant)"
QUERY_STORE_ID_POUR_GERANT_VISUALISANT = "Store ID (pour gérant visualisant un magasin)"
QUERY_STORE_ID_POUR_GERANT = "Store ID (pour gérant)"

# ----- Messages d'erreur (API / sécurité) -----
ERR_ACCES_REFUSE = "Accès refusé"
ERR_ACCES_REFUSE_MAGASIN = "Accès refusé à ce magasin"
ERR_ACCES_REFUSE_MAGASIN_NON_APPARTIENT = "Accès refusé : ce magasin ne vous appartient pas"
ERR_ACCES_REFUSE_MAGASIN_NON_ASSIGNE = "Accès refusé : ce magasin ne vous est pas assigné"
ERR_ACCES_REFUSE_MAGASIN_AUTRE_GERANT = (
    "Accès refusé: ce magasin appartient à un autre gérant (store_id: {store_id}, your_id: {user_id}, store_gerant_id: {store_gerant_id})"
)
ERR_UTILISATEUR_NON_TROUVE = "Utilisateur non trouvé"
ERR_AUCUN_ABONNEMENT_TROUVE = "Aucun abonnement trouvé"
ERR_CONFIG_STRIPE_MANQUANTE = "Configuration Stripe manquante"
ERR_VENDEUR_SANS_MAGASIN = "Vendeur sans magasin assigné"
ERR_VENDEUR_NON_TROUVE = "Vendeur non trouvé"
ERR_VENDEUR_NON_TROUVE_OU_APPARTIENT_PAS = "Vendeur non trouvé ou n'appartient pas à ce magasin"
ERR_ROLE_NON_AUTORISE = "Rôle non autorisé"
ERR_STORE_ID_REQUIS = "store_id requis"

# Alias pour core.security (messages de contrôle d'accès)
MSG_ROLE_UNAUTHORIZED = ERR_ROLE_NON_AUTORISE
MSG_SELLER_NOT_FOUND = ERR_VENDEUR_NON_TROUVE
MSG_SELLER_NOT_IN_STORE = "Ce vendeur n'appartient pas à votre magasin"
MSG_SELLER_NOT_IN_YOUR_STORES = "Ce vendeur n'appartient pas à l'un de vos magasins"

# ----- Libellés profils DISC (API / diagnostics) -----
PROFIL_LE_COACH = "Le Coach"
PROFIL_LE_STRATEGE = "Le Stratège"
PROFIL_DEFAULT = PROFIL_LE_COACH

# ----- Opérateurs MongoDB (agrégations) -----
MONGO_IFNULL = "$ifNull"
MONGO_MATCH = "$match"
MONGO_GROUP = "$group"
MONGO_SUM = "$sum"
