# Plan de Correction SonarQube - Projet Sophie
# 🚀 Plan de Correction SonarQube - Projet Sophie (Complet)

## CHUNK 1 : Bugs de Fiabilité & Sécurité (Priorité Absolue)
- [ ] **backend/api/routes/docs.py (L46)** : Remplacer `open()` par une API asynchrone (`aiofiles`).
- [ ] **backend/core/lifespan.py (L92)** : Sauvegarder la tâche asyncio dans une variable (prévention GC).
- [ ] **frontend/src/pages/KPIReporting.js (L114, L164)** : Utiliser `localeCompare` pour les tris.
- [ ] **frontend/src/index.css (L101)** : Corriger l'ordre des propriétés `gap` (shorthand vs longhand).
- [ ] **backend/core/lifespan.py (L92)** : Fix bug "Save task in variable".

## CHUNK 2 : Centralisation des Constantes (Design - Rapide)
*Action : Extraire les textes dupliqués vers un fichier de constantes central.*
- [ ] **Textes répétitifs Backend :** "Numéro de page", "Nombre d'éléments par page", "Store ID (requis pour gérant)", "Accès refusé", "Utilisateur non trouvé", "Aucun abonnement trouvé", "Configuration Stripe manquante", "Vendeur sans magasin assigné", "Vendeur non trouvé", "Rôle non autorisé", "user_id is required", "$ifNull", "$match", "$group".
- [ ] **Textes répétitifs Frontend :** "Le Coach", "Stratège", "Découverte", "```json".

## CHUNK 3 : Complexité Cognitive Critique (Frontend > 50)
*Action : Refactorisation lourde, extraction de composants.*
- [ ] **StoreKPIModal.js (L10)** : Complexité 150 -> 15.
- [ ] **ManagerSettingsModal.js (L9)** : Complexité 138 -> 15.
- [ ] **GerantDashboard.js (L26)** : Complexité 132 -> 15.
- [ ] **TeamModal.js (L34)** : Complexité 101 -> 15.
- [ ] **SubscriptionModal.js (L81)** : Complexité 66 -> 15.
- [ ] **SellerDetailView.js (L10)** : Complexité 59 -> 15.

## CHUNK 4 : Complexité Cognitive & Logique (Backend Services)
- [ ] **gerant_service.py (L923)** : Complexité 76 -> 15.
- [ ] **gerant_service.py (L1663)** : Complexité 75 -> 15.
- [ ] **seller_service.py (L1820)** : Complexité 83 -> 15.
- [ ] **seller_service.py (L1435)** : Complexité 69 -> 15.
- [ ] **manager_service.py (L850)** : Complexité 62 -> 15.
- [ ] **admin_service.py (L111)** : Complexité 44 -> 15.
- [ ] **context_resolvers.py (L28)** : Complexité 42 -> 15.

## CHUNK 5 : Propreté & Best Practices (Divers)
- [ ] **Scripts Shell (.sh)** : Remplacer `[` par `[[` dans tous les fichiers de test et scripts.
- [ ] **Exceptions** : Spécifier des classes d'exceptions (au lieu de `except:`) dans `backend/core/cache.py`, `ai_service.py`, `admin_repository.py`.
- [ ] **DOM Frontend** : Utiliser `.dataset` au lieu de `getAttribute` dans `CoachingModal.js` et `InviteStaffModal.js`.
- [x] **Code mort** : Supprimer le code inaccessible. Corrigé dans `backups/pre-multi-store-20251118_164850/server.py` (le projet actif n'a plus de `server.py`). Corrections : (1) corps de `verify_invitation` déplacé depuis la fin de `link_seller_to_manager` ; (2) bloc mort après `return` dans `delete_my_diagnostic` supprimé.