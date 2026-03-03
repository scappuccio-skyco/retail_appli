# Retail Performer AI — Plan de testing (proposé)

> Repo: `scappuccio-skyco/retail_appli`

## 0) Architecture (constat)
- **Backend**: Python (dossier `backend/`, `backend/requirements.txt`)
- **Frontend**: React (CRA + CRACO) dans `frontend/` (scripts `craco test`, `craco build`)
- **E2E**: Playwright configuré (`playwright.config.ts`, tests dans `e2e/`)
- Plusieurs scripts de tests/maintenance Python à la racine (`*_test.py`, `test_*.py`) déjà présents.

## 1) Objectifs de qualité
1. **Sécurité fonctionnelle des rôles**: gérant / manager / vendeur (RBAC)
2. **Flows critiques**:
   - Auth (login, reset password)
   - Magasins (création/modification)
   - Équipe (invitations, rattachement, droits)
   - Challenges (création, assignation, exécution, scoring)
   - Abonnement/facturation (si Stripe)
3. **Non-régressions** sur les endpoints clés (API) et sur les pages clés (UI)

## 2) Stratégie par couches

### A) Tests Backend (Python)
**Type**
- Unit tests (purs) : validations, logique métier (score, KPI, objectifs, visibilité)
- Integration tests : endpoints + DB + auth + permissions
- Smoke tests prod : health + endpoints de base (sans modifier de données)

**Outils**
- Recommandé: `pytest` + `pytest-asyncio` (si async) + `httpx`/`requests`
- Si déjà en place via scripts: normaliser progressivement dans `tests/`.

**À mettre en place**
- `tests/unit/` : logique KPI/objectif/permissions
- `tests/integration/` : endpoints (create store, invite, create challenge…)

**Gating minimal**
- Un job CI qui exécute les tests unitaires + un subset integration (mock DB ou DB test).

### B) Tests Frontend (React)
**Type**
- Unit/Component : composants formulaires, règles de validation, affichages conditionnels selon rôle
- Integration UI : navigation simple, rendering pages clés

**Outils**
- `craco test` (Jest + RTL)

**À couvrir en priorité**
- Login form (validation, messages d’erreur)
- Guards / redirections selon rôle
- Composants “Magasin / Équipe / Challenge” (affichage selon droits)

### C) E2E (Playwright)
Tu as déjà Playwright configuré:
- `testDir: ./e2e`
- reporter HTML

**Recommandation**: concentrer les E2E sur les parcours “happy path” + RBAC.

#### Scénarios E2E prioritaires (prod-like / staging)
1) **Auth**
- login gérant OK
- login manager OK
- login vendeur OK
- login KO: message d’erreur visible (important, sinon debug difficile)
- reset password flow (à exécuter en environnement de staging si possible)

2) **RBAC**
- Vendeur ne voit pas: facturation/abonnement/API (si non autorisé)
- Manager voit Config (si prévu) mais pas Facturation (si réservé gérant)
- Gérant voit tout

3) **Magasins**
- Gérant: ouvrir modal “Créer magasin”, validation champs requis, annuler
- (Staging) créer un magasin puis vérifier qu’il apparaît dans la liste

4) **Équipe / invitations**
- Gérant: inviter manager & vendeur
- Manager/Vendeur: accepter invitation (lien, flow)
- Vérifier l’accès au magasin associé

5) **Challenges**
- Gérant/Manager: créer challenge
- Vendeur: voir challenge, soumettre/valider, scoring

#### Données / comptes
- Centraliser dans un fichier `.env` non commité (ou secrets CI) :
  - `E2E_GERANT_EMAIL`, `E2E_MANAGER_EMAIL`, `E2E_SELLER_EMAIL`
  - `E2E_PASSWORD`
  - `E2E_BASE_URL`

## 3) Environnements & politique “prod safe”
- **Idéal**: un environnement **staging** avec DB dédiée pour E2E (créations/écritures autorisées)
- **Prod**: seulement tests **read-only / smoke** (login + navigation + pas de mutation)

## 4) Roadmap d’implémentation (rapide)
1) **Smoke suite** (30–60 min)
- Backend: `/health`
- UI: login + navigation gérant

2) **E2E RBAC** (1/2 journée)
- 3 logins + vérification menus/pages visibles

3) **E2E Équipe + challenge** (1 journée)

4) Backend tests structurés (progressif)
- Migrer les scripts `test_*.py` vers `pytest` dans `tests/`

## 5) Livrables
- `TESTING_PLAN.md` (ce doc)
- `e2e/` : scénarios Playwright prioritaires
- `tests/` : backend unit+integration (pytest)
- CI: job `backend tests` + job `frontend tests` + job `e2e (staging)`
