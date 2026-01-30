# 🔍 AUDIT COMPLET - Routing /api sur Vercel

**Date** : 2025-01-XX  
**Contexte** : Déploiement backend FastAPI sur Vercel - Erreurs 405 (Method Not Allowed)

---

## 1️⃣ CARTE DU ROUTING /api SUR VERCEL

### Architecture Actuelle (Vercel)

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL DEPLOYMENT                        │
│                    retail-appli.vercel.app                  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
┌───────────────┐        ┌──────────────────┐
│  Frontend     │        │  Backend API     │
│  (React SPA)  │        │  (Serverless)    │
│               │        │                  │
│ Build:        │        │  File:           │
│ frontend/     │        │  api/index.py    │
│               │        │                  │
│ Output:       │        │  Handler:        │
│ frontend/build│        │  Mangum(app)     │
└───────────────┘        └──────────────────┘
        │                         │
        │                         │
        └─────────────┬───────────┘
                      │
                      ↓
        ┌─────────────────────────┐
        │   vercel.json           │
        │   (Root Config)         │
        │                         │
        │ Rewrites:               │
        │ 1. /api/(.*) →          │
        │    /api/index           │
        │ 2. /(.*) →              │
        │    /index.html          │
        └─────────────────────────┘
```

### Type de Routing : **Serverless Functions** (pas Next.js)

- ❌ **Pas Next.js** : Pas de App Router ni Pages Router
- ✅ **Serverless Functions** : Vercel détecte automatiquement `api/*.py`
- ✅ **Proxy Pattern** : `rewrites` dans `vercel.json` route `/api/*` vers `/api/index`

---

## 2️⃣ CONFIGURATION VERCEL ACTUELLE

### Fichier : `vercel.json` (racine)

```json
{
  "buildCommand": "cd frontend && yarn install && yarn build",
  "outputDirectory": "frontend/build",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Fichier : `frontend/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**⚠️ PROBLÈME IDENTIFIÉ** : Deux fichiers `vercel.json` existent :
- `/vercel.json` (racine) - **ACTIF** (utilisé par Vercel)
- `/frontend/vercel.json` - **INUTILISÉ** (conflit potentiel)

### Fichier : `api/index.py` (handler serverless)

```python
import sys
import os

backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mangum import Mangum
from backend.main import app

handler = Mangum(app, lifespan="off")
```

### Fichier : `requirements.txt` (racine)

```
# Requirements for Vercel serverless function
# This file references backend requirements
-r backend/requirements.txt
```

**⚠️ PROBLÈME POTENTIEL** : Vercel peut ne pas supporter `-r backend/requirements.txt`.  
Besoin de vérifier si Vercel résout correctement les références relatives.

---

## 3️⃣ ENDPOINTS /api RÉELLEMENT PRÉSENTS

### Structure FastAPI

**Base URL** : `/api` (préfixe ajouté dans `backend/main.py:93`)

```python
app.include_router(router, prefix="/api")
```

### Liste des Routers (19 routers)

| Router | Préfixe Router | Route Finale | Endpoints Clés |
|--------|----------------|--------------|----------------|
| `auth` | `/auth` | `/api/auth/*` | POST `/register`, POST `/login`, POST `/forgot-password`, POST `/reset-password` |
| `workspaces` | `/workspaces` | `/api/workspaces/*` | POST `/check-availability` ⚠️ |
| `stores` | `/stores` | `/api/stores/*` | POST `/`, GET `/my-stores`, GET `/{store_id}/info` |
| `kpis` | `/kpi` | `/api/kpi/*` | GET `/seller/kpi-enabled`, POST `/seller/entry` |
| `ai` | `/ai` | `/api/ai/*` | POST `/diagnostic`, GET `/daily-challenge` |
| `admin` | `/superadmin` | `/api/superadmin/*` | GET `/workspaces`, GET `/stats`, GET `/logs` |
| `integrations` | `/integrations` | `/api/integrations/*` | (API d'intégration) |
| `gerant` | `/gerant` | `/api/gerant/*` | GET `/dashboard/stats`, GET `/stores`, POST `/stores` |
| `onboarding` | `/onboarding` | `/api/onboarding/*` | GET `/progress`, POST `/complete` |
| `enterprise` | `/enterprise` | `/api/enterprise/*` | (Routes entreprise) |
| `manager` | `/manager` | `/api/manager/*` | GET `/subscription-status`, GET `/sellers`, GET `/kpi-config` |
| `diagnostics` | `/manager-diagnostic` | `/api/manager-diagnostic/*` | (Diagnostics manager) |
| `sellers` | `/seller` | `/api/seller/*` | GET `/subscription-status`, GET `/tasks`, GET `/challenges` |
| `sellers.diagnostic_router` | `/diagnostic` | `/api/diagnostic/*` | (Diagnostics seller) |
| `stripe_webhooks` | `/webhooks` | `/api/webhooks/*` | POST `/stripe`, GET `/stripe/health` |
| `support` | `/support` | `/api/support/*` | POST `/contact` |
| `sales_evaluations` | (aucun) | `/api/*` | POST `/sales`, GET `/sales` |
| `debriefs` | (aucun) | `/api/*` | (Debriefs) |
| `evaluations` | `/evaluations` | `/api/evaluations/*` | (Evaluations) |
| `briefs` | `/briefs` | `/api/briefs/*` | (Morning briefs) |

### Endpoints en Erreur 405 (Identifiés)

1. **POST `/api/workspaces/check-availability`**
   - Fichier : `backend/api/routes/workspaces.py:17`
   - Méthode : `@router.post("/check-availability")`
   - Route finale : `/api/workspaces/check-availability`

2. **POST `/api/auth/register`**
   - Fichier : `backend/api/routes/auth.py:98`
   - Méthode : `@router.post("/register")`
   - Route finale : `/api/auth/register`

---

## 4️⃣ VARIABLES D'ENVIRONNEMENT

### Frontend (Variables Requises)

**Fichier** : `.env` ou Variables Vercel

```env
REACT_APP_BACKEND_URL=https://retail-appli.vercel.app
```

**Utilisation** :
- `frontend/src/App.js:31-32` : `const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; const API = ${BACKEND_URL}/api;`
- 150+ fichiers utilisent `process.env.REACT_APP_BACKEND_URL`

### Backend (Variables Requises pour Vercel)

**Fichier** : Variables Vercel (pas de `.env` sur serverless)

| Variable | Requis | Description | Source |
|----------|--------|-------------|--------|
| `MONGO_URL` | ✅ OUI | MongoDB connection string | `backend/core/config.py:22` |
| `DB_NAME` | ❌ Non | Default: `retail_coach` | `backend/core/config.py:23` |
| `JWT_SECRET` | ✅ OUI | JWT secret key | `backend/core/config.py:26` |
| `CORS_ORIGINS` | ❌ Non | Default: `*` | `backend/core/config.py:27` |
| `OPENAI_API_KEY` | ✅ OUI | OpenAI API key | `backend/core/config.py:31` |
| `STRIPE_API_KEY` | ✅ OUI | Stripe API key | `backend/core/config.py:32` |
| `STRIPE_WEBHOOK_SECRET` | ✅ OUI | Stripe webhook secret | `backend/core/config.py:33` |
| `BREVO_API_KEY` | ✅ OUI | Brevo (Sendinblue) API key | `backend/core/config.py:34` |
| `FRONTEND_URL` | ✅ OUI | Frontend URL | `backend/core/config.py:49` |
| `ADMIN_CREATION_SECRET` | ✅ OUI | Secret for admin creation | `backend/core/config.py:53` |
| `DEFAULT_ADMIN_EMAIL` | ✅ OUI | Default admin email | `backend/core/config.py:54` |
| `DEFAULT_ADMIN_PASSWORD` | ✅ OUI | Default admin password | `backend/core/config.py:55` |
| `STRIPE_PRICE_*` | ❌ Non | Stripe Price IDs (optionnels) | `backend/core/config.py:37-42` |
| `SENDER_EMAIL` | ❌ Non | Default: `hello@retailperformerai.com` | `backend/core/config.py:45` |
| `SENDER_NAME` | ❌ Non | Default: `Retail Performer AI` | `backend/core/config.py:46` |
| `ENVIRONMENT` | ❌ Non | Default: `development` | `backend/core/config.py:59` |
| `DEBUG` | ❌ Non | Default: `False` | `backend/core/config.py:60` |

**Total Variables Requises** : **11 variables obligatoires**

---

## 5️⃣ PROBLÈMES IDENTIFIÉS

### 🔴 Problème #1 : Erreur 405 (Method Not Allowed)

**Symptômes** :
- `POST /api/workspaces/check-availability` → 405
- `POST /api/auth/register` → 405

**Causes Possibles** :
1. ❌ Handler Mangum non correctement exporté
2. ❌ Routing Vercel ne route pas vers la fonction serverless
3. ❌ Double préfixe `/api` (dans FastAPI + dans rewrite)
4. ❌ Requirements.txt non résolu correctement
5. ❌ Import paths incorrects (backend/main.py non trouvé)

### 🟡 Problème #2 : Configuration Requirements.txt

**Fichier** : `requirements.txt` (racine)
```txt
-r backend/requirements.txt
```

**Risque** : Vercel peut ne pas résoudre les références relatives `-r`.

### 🟡 Problème #3 : Fichier vercel.json Dupliqué

- `/vercel.json` (racine) - **ACTIF**
- `/frontend/vercel.json` - **INUTILISÉ** (conflit potentiel)

### 🟡 Problème #4 : Path Resolution dans api/index.py

**Code actuel** :
```python
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))
```

**Risque** : En serverless, le chemin peut être différent.

---

## 6️⃣ POINTS À VÉRIFIER (Audit Ciblé Nécessaire)

### ❓ Questions à Répondre

1. **Vercel détecte-t-il correctement la fonction Python ?**
   - Vérifier les logs de build Vercel
   - Vérifier si `api/index.py` est traité comme fonction serverless

2. **Les requirements sont-ils installés correctement ?**
   - Vérifier si `mangum` est installé
   - Vérifier si `-r backend/requirements.txt` fonctionne

3. **Le handler est-il correctement exporté ?**
   - Format attendu par Vercel pour Python serverless
   - Vérifier si `handler = Mangum(app)` est correct

4. **Le routing `/api/(.*)` fonctionne-t-il ?**
   - Vérifier si la requête atteint `api/index.py`
   - Vérifier les logs de la fonction serverless

5. **Les variables d'environnement sont-elles définies ?**
   - Vérifier dans le dashboard Vercel
   - Vérifier si `MONGO_URL`, `JWT_SECRET`, etc. sont présents

---

## 7️⃣ INFORMATIONS MANQUANTES (Audit Ciblé Requis)

Pour proposer un patch minimal, il faut :

1. ✅ **Logs de build Vercel** - Vérifier erreurs de build
2. ✅ **Logs runtime Vercel** - Vérifier erreurs d'exécution
3. ✅ **Variables d'env configurées** - Liste exacte dans Vercel
4. ✅ **Test curl direct** - Tester `/api/index` directement
5. ✅ **Structure déployée** - Vérifier structure des fichiers sur Vercel

---

## 📋 RÉSUMÉ DE L'AUDIT

| Aspect | État | Notes |
|--------|------|-------|
| **Routing Vercel** | ✅ Configuré | `vercel.json` route `/api/*` vers `/api/index` |
| **Handler Serverless** | ⚠️ Suspect | Format Mangum à vérifier |
| **Requirements.txt** | ⚠️ Suspect | `-r backend/requirements.txt` peut échouer |
| **Variables d'env** | ❓ Inconnu | À vérifier dans dashboard Vercel |
| **Endpoints FastAPI** | ✅ Documentés | 19 routers, routes finales `/api/*` |
| **Frontend Config** | ✅ Configuré | Utilise `REACT_APP_BACKEND_URL` |

**Prochaine étape** : Demander audit ciblé des logs Vercel et test curl avant patch.

