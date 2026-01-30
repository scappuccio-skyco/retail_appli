# ✅ PATCH APPLIQUÉ - Résolution UV Vercel

**Date** : 2025-01-XX  
**Objectif** : Faire passer le build Vercel en corrigeant "No solution found when resolving dependencies"

---

## 📋 ÉTAPE 1 — AUDIT CIBLÉ (TERMINÉ)

Voir `AUDIT_VERCEL_UV_RESOLUTION.md` pour les détails.

**Cause identifiée** : Incohérence `grpcio==1.76.0` vs `grpcio-status==1.71.2` (versions doivent être alignées)

---

## ✅ ÉTAPE 2 — PATCH MINIMAL APPLIQUÉ

### A) Fichier créé : `runtime.txt` (racine)

```txt
python-3.11
```

**Objectif** : Forcer Python 3.11 sur Vercel (plus stable avec gRPC/protobuf récents que 3.12)

### B) Modifications dans `backend/requirements.txt`

1. **Alignement grpcio-status** :
   - Avant : `grpcio-status==1.71.2` (ligne 39)
   - Après : `grpcio-status==1.76.0` (aligné avec `grpcio==1.76.0`)

2. **Relâchement google-api-core** :
   - Avant : `google-api-core==2.28.0` (ligne 31)
   - Après : `google-api-core>=2.24.2,<2.26.0` (plafond pour permettre résolution uv)

---

## 📝 ÉTAPE 3 — DIFFS EXACTS

### Diff 1 : `runtime.txt` (nouveau fichier)

```diff
--- /dev/null
+++ b/runtime.txt
@@ -0,0 +1,1 @@
+python-3.11
```

### Diff 2 : `backend/requirements.txt`

```diff
--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@ -28,7 +28,7 @@ fsspec==2025.9.0
 google-ai-generativelanguage==0.6.15
-google-api-core==2.28.0
+google-api-core>=2.24.2,<2.26.0
 google-api-python-client==2.185.0
 google-auth==2.41.1
 google-auth-httplib2==0.2.0
@@ -37,7 +37,7 @@ google-generativeai==0.8.5
 googleapis-common-protos==1.71.0
 grpcio==1.76.0
-grpcio-status==1.71.2
+grpcio-status==1.76.0
 gunicorn==23.0.0
```

---

## 💬 ÉTAPE 4 — MESSAGES DE COMMIT

### Commit 1 : `runtime.txt`

```bash
git add runtime.txt
git commit -m "chore(vercel): pin python runtime to 3.11"
```

### Commit 2 : `backend/requirements.txt`

```bash
git add backend/requirements.txt
git commit -m "fix(deps): align grpc + relax google-api-core for uv resolution"
```

---

## 🧪 ÉTAPE 5 — TESTS & REDEPLOY

### 5.1) Test local (optionnel - validation rapide)

```bash
# Créer un venv Python 3.11
python3.11 -m venv venv-test
source venv-test/bin/activate  # Linux/Mac
# ou
venv-test\Scripts\activate  # Windows

# Installer les dépendances (même si Vercel utilise uv, pip donne une première validation)
pip install -r requirements.txt

# Vérifier que grpcio et grpcio-status sont alignés
pip show grpcio grpcio-status | grep Version
# Doit montrer : Version: 1.76.0 pour les deux
```

**Note** : Ce test local utilise pip, pas uv, mais valide que les versions sont cohérentes.

### 5.2) Procédure Vercel

1. **Push vers Git** :
   ```bash
   git push origin main
   ```

2. **Sur Vercel Dashboard** :
   - Aller dans le projet
   - Onglet **"Deployments"**
   - Cliquer sur **"Redeploy"** sur le dernier déploiement
   - ✅ **Cocher "Clear Cache"** (important pour forcer re-résolution)
   - Confirmer

3. **Vérifier les logs de build** :
   - Onglet **"Functions"** → `api/index.py`
   - Vérifier que le build passe sans "No solution found"
   - Vérifier que Python 3.11 est utilisé : chercher "Using Python 3.11" dans les logs

### 5.3) Tests post-deploy

#### Test 1 : Vérifier que `/api/index` ne renvoie pas `index.html`

```bash
curl -I https://retail-appli.vercel.app/api/index
```

**Résultat attendu** :
- ✅ **HTTP 405** (Method Not Allowed) ou **HTTP 404** → Fonction serverless accessible
- ❌ **HTTP 200** avec `Content-Type: text/html` → Routing échoue (fallback vers index.html)

#### Test 2 : Vérifier endpoint API

```bash
curl -X POST https://retail-appli.vercel.app/api/workspaces/check-availability \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
```

**Résultat attendu** :
- ✅ **HTTP 200/400/422** (JSON response) → API fonctionne
- ❌ **HTTP 405** (Method Not Allowed) → Problème de routing/handler
- ❌ **HTTP 200** avec HTML → Fallback vers index.html (routing échoue)

---

## 🔄 ÉTAPE 6 — PLAN B (SI ÉCHEC)

Si le build échoue encore avec "No solution found", appliquer ce patch supplémentaire :

### Option B1 : Relâcher protobuf (DÉJÀ APPLIQUÉ)

✅ **DÉJÀ FAIT** : `protobuf>=4.25.3,<5` (déjà patché dans un commit précédent)

### Option B2 : Retirer SDK Google redondant

**Analyse** : Deux SDKs Google AI sont présents :
- `google-genai==1.46.0` (ligne 35)
- `google-generativeai==0.8.5` (ligne 36)

**Vérification code** : Aucun import `google-genai` ou `google-generativeai` trouvé dans le codebase. Le code utilise uniquement `OpenAI` (AsyncOpenAI).

**Recommandation** : Si le build échoue encore, retirer `google-genai==1.46.0` car :
- Non utilisé dans le code (seul OpenAI est utilisé)
- Peut créer des conflits de dépendances
- `google-generativeai` est le SDK officiel recommandé

**Patch B2** :
```diff
--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@ -33,7 +33,6 @@ google-api-python-client==2.185.0
 google-auth==2.41.1
 google-auth-httplib2==0.2.0
-google-genai==1.46.0
 google-generativeai==0.8.5
 googleapis-common-protos==1.71.0
```

**⚠️ NE PAS APPLIQUER SANS PREUVE** : Attendre les logs Vercel montrant un conflit spécifique avec `google-genai` avant d'appliquer.

---

## 📊 RÉSUMÉ

| Étape | État | Fichiers Modifiés |
|-------|------|-------------------|
| Audit | ✅ Terminé | Aucun (lecture seule) |
| Patch A (runtime.txt) | ✅ Appliqué | `runtime.txt` (créé) |
| Patch B (requirements) | ✅ Appliqué | `backend/requirements.txt` (2 lignes) |
| Diffs | ✅ Générés | Voir ci-dessus |
| Commits | ⏳ À faire | 2 commits proposés |
| Tests | ⏳ À faire | Après push + redeploy |
| Plan B | 📋 Prêt | Si échec |

**Prochaine étape** : Commiter les changements et push vers Git, puis redeploy sur Vercel avec cache clear.

