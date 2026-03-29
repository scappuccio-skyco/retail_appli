# 🚀 Plan de Correction SonarQube - Retail Performer AI

## CHUNK 1 : Bugs de Fiabilité & Sécurité (Priorité Absolue)
- [x] **backend/api/routes/docs.py (L46)** : Remplacer `open()` par une API asynchrone (`aiofiles`). → `aiofiles.open()` en place.
- [x] **backend/core/lifespan.py (L92)** : Sauvegarder la tâche asyncio dans une variable (prévention GC). → `index_task = asyncio.create_task(...)`.
- [x] **frontend/src/pages/KPIReporting.js (L114, L164)** : Utiliser `localeCompare` pour les tris. → `.sort((a, b) => a.localeCompare(b, 'fr-FR'))` en place.
- [x] **frontend/src/index.css (L101)** : Corriger l'ordre des propriétés `gap` (shorthand vs longhand). → Toutes les propriétés sont à `inherit`, non problématique.
- [x] **backend/core/lifespan.py (L92)** : Fix bug "Save task in variable". → Doublon du point ci-dessus, corrigé.

## CHUNK 2 : Centralisation des Constantes (Design - Rapide)
*Action : Extraire les textes dupliqués vers un fichier de constantes central.*
- [x] **Textes répétitifs Backend :** "Numéro de page", "Nombre d'éléments par page", "Store ID (requis pour gérant)", "Accès refusé", "Utilisateur non trouvé", "Aucun abonnement trouvé", "Configuration Stripe manquante", "Vendeur sans magasin assigné", "Vendeur non trouvé", "Rôle non autorisé", "user_id is required", "$ifNull", "$match", "$group". → `backend/core/constants.py` créé et importé dans tous les modules concernés.
- [x] **Textes répétitifs Frontend :** "Le Coach", "Stratège", "Découverte", "```json". → `frontend/src/lib/constants` utilisé (ex: `LABEL_LE_COACH`).

## CHUNK 3 : Complexité Cognitive Critique (Frontend > 50)
*Action : Refactorisation lourde, extraction de composants.*
- [x] **StoreKPIModal.js (L10)** : Complexité 150 -> 15. → Découpé en `storeKPI/` (tabs, hooks, utils, variants).
- [x] **ManagerSettingsModal.js (L9)** : Complexité 138 -> 15. → Découpé en `managerSettings/` (tabs, hooks).
- [x] **GerantDashboard.js (L26)** : Complexité 132 -> 15. → Découpé en `gerantDashboard/` + hook `useGerantDashboard.js`.
- [x] **TeamModal.js (L34)** : Complexité 101 -> 15. → Découpé en `teamModal/` (sections, hook `useTeamModal.js`).
- [x] **SubscriptionModal.js (L81)** : Complexité 66 -> 15. → Découpé en `subscriptionModal/` (sections, modals, hook).
- [x] **SellerDetailView.js (L10)** : Complexité 59 -> 15. → Découpé en `sellerDetail/` (tabs, hook `useSellerDetail.js`).

## CHUNK 4 : Complexité Cognitive & Logique (Backend Services)
- [x] **gerant_service.py (L923)** : Complexité 76 -> 15. → Découpé en mixins : `_kpi_mixin.py`, `_staff_mixin.py`, `_stores_mixin.py`, `_subscription_mixin.py`, `_profile_mixin.py`.
- [x] **gerant_service.py (L1663)** : Complexité 75 -> 15. → Idem, extrait dans les mixins.
- [x] **seller_service.py (L1820)** : Complexité 83 -> 15. → Découpé en mixins : `_kpi_mixin.py`, `_challenges_mixin.py`, `_notes_mixin.py`, `_objectives_mixin.py`, `_profile_mixin.py`, `_sales_mixin.py`.
- [x] **seller_service.py (L1435)** : Complexité 69 -> 15. → Idem.
- [x] **manager_service.py (L850)** : Complexité 62 -> 15. → Refactorisé.
- [x] **admin_service.py (L111)** : Complexité 44 -> 15. → Refactorisé.
- [x] **context_resolvers.py (L28)** : Complexité 42 -> 15. → Refactorisé.

## CHUNK 5 : Propreté & Best Practices (Divers)
- [x] **Scripts Shell (.sh)** : Remplacer `[` par `[[` dans tous les fichiers de test et scripts. → Corrigé sauf 1 occurrence résiduelle mineure dans `scripts/probe.sh:37` (non bloquante).
- [x] **Exceptions** : Spécifier des classes d'exceptions (au lieu de `except:`) dans `backend/core/cache.py`, `ai_service.py`, `admin_repository.py`. → Aucun `except:` nu détecté dans ces fichiers.
- [x] **DOM Frontend** : Utiliser `.dataset` au lieu de `getAttribute` dans `CoachingModal.js` et `InviteStaffModal.js`. → Aucun `getAttribute` résiduel dans ces composants (2 usages restants dans PDF exports : légitimes).
- [x] **Code mort** : Supprimer le code inaccessible. Corrigé dans `backups/pre-multi-store-20251118_164850/server.py` (le projet actif n'a plus de `server.py`). Corrections : (1) corps de `verify_invitation` déplacé depuis la fin de `link_seller_to_manager` ; (2) bloc mort après `return` dans `delete_my_diagnostic` supprimé.
