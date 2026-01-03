# 🔍 AUDIT COMPARATIF - PROJET A (Retail Performer AI)

**Date** : 2025-01-XX  
**Statut** : Problèmes identifiés (routing /api → index.html, build uv "No solution found")

---

## 📁 ÉTAPE 1 — INVENTAIRE FICHIERS CLÉS (PROJET A)

### 1.1) Structure des dossiers à la racine

```
retail_appli/
├── api/                    ✅ Présent (serverless function)
│   └── index.py
├── backend/                ✅ Présent (code Python FastAPI)
│   ├── requirements.txt
│   ├── main.py
│   └── ...
├── frontend/               ✅ Présent (React app)
│   ├── package.json
│   ├── vercel.json        ⚠️ Présent (conflit potentiel)
│   └── ...
├── vercel.json            ✅ Présent (config racine)
├── requirements.txt       ✅ Présent (référence backend/)
└── runtime.txt            ✅ Présent (créé récemment: python-3.11)
```

### 1.2) Fichiers de configuration Vercel

**`vercel.json` (racine)** :
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

**`frontend/vercel.json`** (⚠️ CONFLIT POTENTIEL) :
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

**`runtime.txt` (racine)** :
```
python-3.11
```

### 1.3) Requirements Python

**`requirements.txt` (racine)** :
```
# Requirements for Vercel serverless function
# This file references backend requirements
-r backend/requirements.txt
```

**`backend/requirements.txt`** (extraits clés) :
```
google-api-core>=2.24.2,<2.26.0
google-genai==1.46.0
google-generativeai==0.8.5
grpcio==1.76.0
grpcio-status==1.76.0
protobuf>=4.25.3,<5
mangum==0.17.0
```

### 1.4) Entrée serverless Python

**`api/index.py`** :
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

### 1.5) Frontend build config

**`frontend/package.json`** (extrait) :
- Build command : `craco build` (via scripts)
- Output : `build/` (par défaut CRA)

---

## 🛣️ ÉTAPE 2 — ROUTING /API (PROJET A)

### Configuration actuelle

**Vercel rewrites** :
- `/api/(.*)` → `/api/index` (fonction serverless Python)
- `/(.*)` → `/index.html` (SPA fallback)

**FastAPI configuration** (`backend/main.py`) :
```python
app.include_router(router, prefix="/api")
```

**Résultat** : Double préfixe `/api` :
- Route FastAPI : `/api/workspaces/check-availability`
- Requête Vercel : `/api/workspaces/check-availability` → rewrites vers `/api/index`
- FastAPI interne : router déjà préfixé avec `/api` → route finale `/api/api/workspaces/...` ❌

**⚠️ PROBLÈME IDENTIFIÉ** : Le rewrite `/api/(.*)` → `/api/index` est correct, mais FastAPI ajoute aussi `/api` comme préfixe. Le handler Mangum devrait recevoir le chemin `/workspaces/check-availability` mais FastAPI cherche `/api/workspaces/check-availability`.

### Vérification SPA fallback

**Problème observé** : `/api/*` renvoie `index.html` au début
- Cause probable : La fonction serverless Python n'est pas détectée/invoquée
- Le rewrite vers `/api/index` ne fonctionne pas
- Fallback vers `/(.*)` → `/index.html` s'active

---

## 🏗️ ÉTAPE 3 — BUILD & OUTPUT (PROJET A)

### Configuration actuelle

**Build Command** : `cd frontend && yarn install && yarn build`
- ✅ Monorepo pattern détecté
- ✅ Frontend dans sous-dossier

**Output Directory** : `frontend/build`
- ✅ Explicitement défini dans `vercel.json`

**Root Directory** : Non défini dans `vercel.json`
- ⚠️ Vercel utilise la racine du repo par défaut
- Si le repo est dans un sous-dossier, cela peut causer des problèmes

**Package Manager** : `yarn` (détecté dans buildCommand)

### Vercel Settings à vérifier (checklist)

1. **Root Directory** :
   - ❓ Vérifier si Root Directory est défini dans Vercel Dashboard
   - Si défini : doit être vide (racine) ou correspondre à la structure du repo

2. **Build & Development Settings** :
   - ✅ Build Command : `cd frontend && yarn install && yarn build`
   - ✅ Output Directory : `frontend/build`
   - ✅ Install Command : (auto-détecté, probablement `yarn install`)

3. **Functions** :
   - ❓ Vercel doit détecter automatiquement `api/index.py` comme fonction Python
   - Vérifier que le runtime est Python 3.11 (via `runtime.txt`)

---

## 🐍 ÉTAPE 4 — PYTHON RUNTIME & DÉPENDANCES (PROJET A)

### Runtime Python

**`runtime.txt`** : `python-3.11`
- ✅ Explicitement défini
- Versions précédentes : Python 3.12 (auto-détecté par Vercel)

### Dépendances critiques

**Packages Google/gRPC** :
- `google-api-core>=2.24.2,<2.26.0` (relâché récemment)
- `google-genai==1.46.0` ⚠️ (redondant avec google-generativeai?)
- `google-generativeai==0.8.5`
- `grpcio==1.76.0`
- `grpcio-status==1.76.0` ✅ (aligné avec grpcio)
- `protobuf>=4.25.3,<5` ✅ (contrainte relâchée)

**Problèmes identifiés** :
1. ⚠️ **Packages redondants** : `google-genai` + `google-generativeai` (peut causer conflits)
2. ✅ **Cohérence grpc** : `grpcio` et `grpcio-status` alignés (fixé récemment)
3. ✅ **Protobuf** : Contrainte relâchée (compatible Python 3.11)

### Pourquoi uv peut échouer

**Cause probable** :
- Conflits de dépendances entre `google-genai` et `google-generativeai`
- Versions très récentes de `grpcio` (1.76.0) peuvent nécessiter résolution spécifique
- Le plafond sur `google-api-core` peut créer des conflits avec d'autres packages Google

---

## 📊 PROBLÈMES IDENTIFIÉS (PROJET A)

| Problème | Sévérité | Impact |
|----------|----------|--------|
| `frontend/vercel.json` présent | 🟡 Moyen | Conflit potentiel avec config racine |
| Double préfixe `/api` (FastAPI) | 🔴 Critique | Routes mal routées |
| Packages Google redondants | 🟡 Moyen | Conflits de résolution uv |
| Pas de Root Directory explicite | 🟡 Moyen | Problèmes si repo dans sous-dossier |

---

## 📋 ÉLÉMENTS NÉCESSAIRES POUR COMPARAISON (PROJET B)

Pour comparer efficacement, j'ai besoin des éléments suivants du Projet B :

### Liste des 10 éléments exacts à demander

1. **`vercel.json` (racine)** - Config Vercel principale
   - Pourquoi : Comparer rewrites, buildCommand, outputDirectory, Root Directory

2. **`runtime.txt` (si présent)** - Version Python
   - Pourquoi : Vérifier si B utilise Python 3.11, 3.12, ou pas de pin

3. **`requirements.txt` (racine)** - Entry point des deps Python
   - Pourquoi : Comparer structure (référence backend/ ou direct?)

4. **`backend/requirements.txt` (si présent)** - Dépendances Python complètes
   - Pourquoi : Comparer versions Google/gRPC/protobuf, cohérence

5. **`api/index.py` (ou équivalent)** - Handler serverless
   - Pourquoi : Comparer structure, imports, handler Mangum

6. **`backend/main.py` (extrait: app.include_router)** - Configuration FastAPI
   - Pourquoi : Vérifier préfixage `/api` ou pas

7. **`frontend/package.json` (extrait: scripts)** - Build frontend
   - Pourquoi : Comparer commandes build

8. **Structure dossiers racine** - Liste des dossiers (api/, backend/, frontend/, etc.)
   - Pourquoi : Vérifier organisation monorepo

9. **`frontend/vercel.json` (si présent)** - Config frontend séparée
   - Pourquoi : Vérifier si B a aussi ce fichier (conflit?)

10. **Vercel Dashboard Settings (3 champs)** - Root Directory, Build Command, Output Directory
    - Pourquoi : Comparer settings explicites vs implicites

---

## 🔄 PROCHAINES ÉTAPES

1. ✅ Inventaire Projet A terminé
2. ⏳ **ATTENDRE** : Fournir les 10 éléments du Projet B
3. ⏳ Comparaison A vs B
4. ⏳ Identification des différences clés
5. ⏳ Plan d'action minimal pour corriger A

