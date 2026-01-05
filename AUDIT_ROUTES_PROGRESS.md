# 🎯 Audit des Routes API - Progrès et Prochaines Étapes

**Date**: 2025-01-05  
**Base URL**: `https://api.retailperformerai.com`

---

## ✅ Accompli

### Étape A: Inventaire Runtime
- ✅ Script créé: `backend/scripts/print_routes.py`
  - Utilise le schéma OpenAPI de FastAPI pour extraire les routes
  - Génère JSON avec method, path, tags, security, etc.
  - ⚠️ Nécessite environnement Python avec dépendances installées

### Étape B: Inventaire Code
- ✅ Script créé: `scripts/extract_code_routes.js`
- ✅ **181 routes** extraites depuis `backend/api/routes/*.py`
- ✅ Fichier généré: `routes.code.json`
- ✅ Script de comparaison: `scripts/compare_routes.js`
- ✅ Rapport: `routes.diff.md`

**Résultat**: Toutes les routes clés attendues (Stores/Manager/Seller) sont présentes dans le code source.

---

## ⏳ En Attente (Nécessite Environnement Python)

Pour continuer l'audit, il faut :

1. **Configurer environnement Python**:
   ```bash
   cd backend
   # Activer venv/conda si nécessaire
   pip install -r requirements.txt
   ```

2. **Générer routes.runtime.json**:
   ```bash
   cd backend
   python scripts/print_routes.py > ../../routes.runtime.json
   ```

3. **Comparer runtime vs code**:
   ```bash
   node scripts/compare_routes.js > routes.diff.md
   ```

---

## 📋 Prochaines Étapes (Après génération de routes.runtime.json)

### Étape C: OpenAPI & Docs
- [ ] Télécharger `/openapi.json` depuis runtime
- [ ] Comparer avec routes.runtime.json
- [ ] Générer `docs_openapi_gap.md`
- [ ] Corriger documentation (API_README.md, guides, etc.)

### Étape D: Canoniser Prefixes
- [ ] Vérifier tous les `APIRouter(prefix="...")`
- [ ] Normaliser trailing slashes
- [ ] Implémenter alias dépréciés si nécessaire

### Étape E: Auth & Headers
- [ ] Vérifier Bearer vs X-API-Key par endpoint
- [ ] Mettre à jour documentation auth

### Étape F: Tests
- [ ] Créer tests pytest pour routes clés
- [ ] Script smoke test (`scripts/probe.sh`)

### Étape G: Exemples Docs
- [ ] Mettre à jour cURL/Postman/n8n
- [ ] Base URL: `https://api.retailperformerai.com`

### Étape H: Rapports Finaux
- [ ] Tableau récapitulatif FINAL
- [ ] Exécuter tests et afficher résumé

---

## 📁 Fichiers Créés

1. `backend/scripts/print_routes.py` - Dump routes runtime
2. `scripts/extract_code_routes.js` - Extract routes depuis code
3. `scripts/compare_routes.js` - Comparer code vs runtime
4. `routes.code.json` - 181 routes extraites (✅ généré)
5. `routes.diff.md` - Rapport comparaison (partiel)
6. `AUDIT_ROUTES_SUMMARY.md` - Résumé exécutif
7. `AUDIT_ROUTES_PROGRESS.md` - Ce fichier

---

## 🎯 Validation Routes Clés

Toutes les routes attendues sont présentes dans `routes.code.json`:

| Route | Status |
|-------|--------|
| `POST /api/stores/` | ✅ |
| `GET /api/stores/my-stores` | ✅ |
| `GET /api/stores/{store_id}/info` | ✅ |
| `GET /api/manager/subscription-status` | ✅ |
| `GET /api/manager/store-kpi-overview` | ✅ |
| `GET /api/manager/dates-with-data` | ✅ |
| `GET /api/manager/available-years` | ✅ |
| `GET /api/seller/subscription-status` | ✅ |
| `GET /api/seller/kpi-enabled` | ✅ |
| `GET /api/seller/tasks` | ✅ |
| `GET /api/seller/objectives/active` | ✅ |
| `GET /api/seller/objectives/all` | ✅ |

---

## 💡 Recommandations

1. **Priorité 1**: Exécuter `print_routes.py` pour obtenir le snapshot runtime
2. **Priorité 2**: Comparer runtime vs code pour détecter les écarts
3. **Priorité 3**: Vérifier OpenAPI schema et aligner documentation
4. **Priorité 4**: Ajouter tests pour routes clés (anti-régression)

---

**Status Global**: ✅ **Étapes A-B complètes**, ⏳ **Étapes C-H en attente de routes.runtime.json**

