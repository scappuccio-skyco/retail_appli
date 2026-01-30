# ✅ Audit des Routes API - Complet

**Date**: 2025-01-XX  
**Base URL**: `https://api.retailperformerai.com`

## 📋 Résumé de l'Audit

Cet audit a été effectué pour :
1. ✅ Inventorier toutes les routes exposées au runtime
2. ✅ Comparer avec le code source et la documentation
3. ✅ Identifier les écarts et incohérences
4. ✅ Proposer et appliquer des correctifs
5. ✅ Ajouter des tests et sondes anti-régression

## 📁 Fichiers Générés

### Scripts d'Audit
- `backend/scripts/print_routes.py` - Script pour dumper les routes au runtime
- `backend/scripts/compare_routes.py` - Comparer routes runtime vs code
- `backend/scripts/compare_openapi_docs.py` - Comparer OpenAPI runtime vs repo
- `backend/scripts/generate_audit_summary.py` - Générer résumé final

### Rapports Générés
- `routes.runtime.json` - Routes extraites au runtime (via `/_debug/routes` ou script)
- `routes.code.json` - Routes extraites du code source (existant)
- `routes.diff.md` - Comparaison routes runtime vs code
- `docs_openapi_gap.md` - Écarts entre OpenAPI runtime et documentation
- `AUDIT_ROUTES_SUMMARY.md` - Résumé final avec tableau de statut

### Tests
- `backend/tests/test_api_routes_smoke.py` - Tests pytest pour routes clés
- `scripts/probe.sh` - Script bash pour smoke tests
- `scripts/probe.ps1` - Script PowerShell pour smoke tests

### Documentation
- `API_EXAMPLES.md` - Exemples cURL, Postman, n8n mis à jour

## 🔧 Modifications Apportées

### 1. Endpoint de Debug
- ✅ Ajout de `GET /_debug/routes` dans `backend/main.py`
  - Liste toutes les routes au runtime
  - `include_in_schema=False` (non visible dans OpenAPI)
  - Source de vérité pour l'audit

### 2. Routes Clés Vérifiées

Toutes les routes clés attendues sont présentes :

| Route | Method | Status |
|-------|--------|--------|
| `/api/stores/` | POST | ✅ OK |
| `/api/stores/my-stores` | GET | ✅ OK |
| `/api/stores/{store_id}/info` | GET | ✅ OK |
| `/api/manager/subscription-status` | GET | ✅ OK |
| `/api/manager/store-kpi-overview` | GET | ✅ OK |
| `/api/manager/dates-with-data` | GET | ✅ OK |
| `/api/manager/available-years` | GET | ✅ OK |
| `/api/seller/subscription-status` | GET | ✅ OK |
| `/api/seller/kpi-enabled` | GET | ✅ OK |
| `/api/seller/tasks` | GET | ✅ OK |
| `/api/seller/objectives/active` | GET | ✅ OK |
| `/api/seller/objectives/all` | GET | ✅ OK |

### 3. Routes Dépréciées

Les routes `/api/integrations/*` sont **actives** mais doivent être documentées comme dépréciées :
- `/api/integrations/kpi/sync` - Utilisé pour API Key auth (conservé)
- `/api/integrations/api-keys` - Gestion clés API (conservé)
- `/api/integrations/v1/kpi/sync` - Alias legacy (conservé)

> **Note**: Ces routes sont utilisées pour l'authentification par API Key et doivent rester actives. Elles doivent être marquées `deprecated: true` dans OpenAPI.

### 4. Authentification

**Politique unifiée** :
- **Bearer Token (JWT)** : Par défaut pour tous les endpoints utilisateur
- **X-API-Key** : Pour endpoints enterprise/bulk spécifiques
  - `/api/integrations/kpi/sync`
  - `/api/enterprise/stores/bulk-import`
  - `/api/enterprise/users/bulk-import`

### 5. Trailing Slashes

Convention normalisée :
- `POST /api/stores/` - **Avec** trailing slash (création de ressource)
- `GET /api/stores/my-stores` - **Sans** trailing slash (ressources)
- `GET /api/stores/{store_id}/info` - **Sans** trailing slash (ressources)

## 🧪 Tests

### Tests Pytest
```bash
cd backend
pytest tests/test_api_routes_smoke.py -v
```

### Smoke Tests (Script)
```bash
# Bash
bash scripts/probe.sh

# PowerShell
powershell -ExecutionPolicy Bypass -File scripts/probe.ps1
```

## 📊 Utilisation des Scripts

### 1. Générer routes.runtime.json
```bash
# Option 1: Via endpoint (si API accessible)
curl https://api.retailperformerai.com/_debug/routes > routes.runtime.json

# Option 2: Via script (nécessite environnement Python)
cd backend
python scripts/print_routes.py > ../routes.runtime.json
```

### 2. Comparer Routes
```bash
cd backend
python scripts/compare_routes.py
# Génère routes.diff.md
```

### 3. Comparer OpenAPI
```bash
cd backend
python scripts/compare_openapi_docs.py
# Génère docs_openapi_gap.md
```

### 4. Générer Résumé Final
```bash
cd backend
python scripts/generate_audit_summary.py
# Génère AUDIT_ROUTES_SUMMARY.md
```

## 📝 Prochaines Étapes Recommandées

1. **Mettre à jour OpenAPI repo** :
   - Ajouter les routes runtime manquantes
   - Marquer `/api/integrations/*` comme `deprecated: true`
   - Mettre `servers.url = https://api.retailperformerai.com`

2. **Mettre à jour la documentation** :
   - Vérifier que tous les guides (README, API_INTEGRATION_GUIDE.md) utilisent la bonne base URL
   - Ajouter des exemples avec la base URL correcte

3. **CI/CD** :
   - Ajouter les tests pytest dans le pipeline CI
   - Exécuter `scripts/probe.sh` dans les déploiements

4. **Monitoring** :
   - Surveiller les routes dépréciées pour planifier leur suppression
   - Documenter la migration des routes `/api/integrations/*` vers les routes canoniques

## 🔍 Commandes Utiles

### Lister toutes les routes
```bash
curl https://api.retailperformerai.com/_debug/routes | jq '.routes[] | "\(.method) \(.path)"'
```

### Tester une route spécifique
```bash
curl -X GET "https://api.retailperformerai.com/api/stores/my-stores" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Vérifier OpenAPI
```bash
curl https://api.retailperformerai.com/openapi.json | jq '.paths | keys'
```

## ✅ Checklist de Validation

- [x] Routes runtime inventoriées
- [x] Routes code extraites
- [x] Comparaison runtime vs code effectuée
- [x] OpenAPI comparé avec documentation
- [x] Routes clés vérifiées
- [x] Tests smoke créés
- [x] Scripts de probe créés
- [x] Documentation mise à jour
- [x] Exemples cURL/Postman/n8n créés
- [ ] OpenAPI repo mis à jour (à faire)
- [ ] Documentation complète alignée (à faire)
- [ ] CI/CD configuré avec tests (à faire)

---

**Audit réalisé par**: API Route Auditor & Fixer  
**Version API**: 2.0.0  
**Base URL**: https://api.retailperformerai.com

