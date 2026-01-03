# 🔧 PLAN DE CORRECTION AUTONOME - Projet A

**Date** : 2025-01-XX  
**Approche** : Correction basée sur audit interne + meilleures pratiques Vercel (sans projet de référence)

---

## ✅ CORRECTIONS DÉJÀ APPLIQUÉES

1. ✅ **Alignement grpcio-status** : `1.71.2` → `1.76.0` (aligné avec grpcio)
2. ✅ **Relâchement google-api-core** : `==2.28.0` → `>=2.24.2,<2.26.0`
3. ✅ **Runtime Python** : Création `runtime.txt` avec `python-3.11`
4. ✅ **Protobuf** : Déjà patché `>=4.25.3,<5`

---

## 🎯 CORRECTIONS RESTANTES (basées sur audit interne)

### Correction #1 : Supprimer `frontend/vercel.json` (conflit)

**Problème** : Deux fichiers `vercel.json` (racine + frontend/) peuvent créer des conflits

**Action** :
```bash
# Supprimer frontend/vercel.json
rm frontend/vercel.json
```

**Justification** : La config racine (`vercel.json`) doit être l'unique source de vérité pour un monorepo.

---

### Correction #2 : Vérifier routing FastAPI (double préfixe `/api`)

**Problème identifié** :
- Vercel rewrite : `/api/(.*)` → `/api/index`
- FastAPI : `app.include_router(router, prefix="/api")`
- Résultat : Routes peuvent devenir `/api/api/...`

**Vérification nécessaire** :
1. Confirmer que les routes FastAPI fonctionnent avec le préfixe `/api`
2. Vérifier que Mangum reçoit correctement le path (sans double `/api`)
3. Si problème : Ajuster soit Vercel rewrite, soit FastAPI prefix

**Option A** : Garder préfixe FastAPI `/api` + Vercel rewrite correct
**Option B** : Retirer préfixe FastAPI (pas de `/api` dans `include_router`) + Vercel rewrite ajoute `/api`

**Recommandation** : Option A (garder configuration actuelle) + vérifier logs Vercel pour confirmer que ça fonctionne.

---

### Correction #3 : Packages Google redondants (si build échoue encore)

**Problème** : `google-genai==1.46.0` + `google-generativeai==0.8.5` présents

**Vérification code** : Aucun import `google-genai` ou `google-generativeai` trouvé (code utilise OpenAI)

**Action si nécessaire** :
```diff
-google-genai==1.46.0
```

**⚠️ À appliquer seulement si** : Build uv échoue encore après corrections #1 et #2

---

## 📋 PLAN D'ACTION (ordre d'exécution)

### Étape 1 : Tester corrections déjà appliquées
- ✅ Push + redeploy sur Vercel
- ✅ Vérifier build (uv resolution)
- ✅ Tester routing `/api/*`

### Étape 2 : Si build échoue encore
- ⏳ Appliquer Correction #1 (supprimer `frontend/vercel.json`)
- ⏳ Push + redeploy
- ⏳ Vérifier build

### Étape 3 : Si routing `/api/*` échoue encore
- ⏳ Analyser logs Vercel (Function logs)
- ⏳ Vérifier Correction #2 (double préfixe `/api`)
- ⏳ Ajuster si nécessaire

### Étape 4 : Si problèmes de dépendances persistent
- ⏳ Appliquer Correction #3 (retirer `google-genai`)
- ⏳ Push + redeploy

---

## 🧪 TESTS POST-CORRECTION

### Test 1 : Build Vercel
```bash
# Vérifier dans Vercel Dashboard → Deployments
# Build doit réussir sans "No solution found"
```

### Test 2 : Routing API
```bash
curl -I https://retail-appli.vercel.app/api/index
# Attendu : HTTP 405/404 (pas 200 HTML)

curl -X POST https://retail-appli.vercel.app/api/workspaces/check-availability \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
# Attendu : HTTP 200/400/422 JSON (pas 405, pas HTML)
```

---

## 📊 RÉSUMÉ

| Correction | État | Priorité | Impact |
|------------|------|----------|--------|
| Alignement grpcio-status | ✅ Fait | Critique | Résolution uv |
| Relâchement google-api-core | ✅ Fait | Critique | Résolution uv |
| Runtime Python 3.11 | ✅ Fait | Moyen | Compatibilité |
| Supprimer frontend/vercel.json | ⏳ À faire | Moyen | Conflit config |
| Vérifier double préfixe /api | ⏳ À vérifier | Critique | Routing API |
| Retirer google-genai | ⏳ Si nécessaire | Bas | Dépendances |

**Prochaine étape recommandée** : Tester d'abord les corrections déjà appliquées (#1-4), puis appliquer les corrections restantes si problèmes persistent.

