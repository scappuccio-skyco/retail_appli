# Validation Déploiement - Router Auth

## Logs à Vérifier au Démarrage

Après le déploiement, vérifiez les logs Railway pour confirmer que le router auth est bien chargé.

### 1. Logs d'Import du Router (dans `__init__.py`)

**Rechercher** :
```
[ROUTES] ✅ Loaded auth router (8 routes)
```

**Si erreur** :
```
[ROUTES] ❌ FATAL: Failed to load auth router: <erreur>
```
→ Le démarrage doit être bloqué avec un traceback complet

### 2. Logs de Vérification dans main.py

**Rechercher** :
```
[STARTUP] ✅ Auth router found with 8 routes
[STARTUP] ✅ Auth router registered with routes: [...]
[STARTUP] ✅ Auth routes registered: [...]
```

**Si erreur** :
```
[STARTUP] ❌ FATAL: Auth router not found in routers list!
```
ou
```
[STARTUP] ❌ FATAL: No auth routes found in app.routes!
```
→ Le démarrage doit être bloqué

### 3. Liste Complète des Routes Auth

Les logs doivent afficher quelque chose comme :
```
[STARTUP] ✅ Auth routes registered: [
  'POST /api/auth/login',
  'GET /api/auth/me',
  'POST /api/auth/register',
  'POST /api/auth/register/invitation',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/auth/reset-password/{token}',
  'GET /api/auth/invitations/verify/{token}'
]
```

## Tests Post-Déploiement

### 1. Vérifier l'OpenAPI

```bash
curl https://api.retailperformerai.com/openapi.json | jq '.paths | keys | .[] | select(contains("/auth"))'
```

**Résultat attendu** :
```
"/api/auth/login"
"/api/auth/me"
"/api/auth/register"
"/api/auth/register/invitation"
"/api/auth/forgot-password"
"/api/auth/reset-password"
"/api/auth/reset-password/{token}"
"/api/auth/invitations/verify/{token}"
```

### 2. Tester la Route Login

```bash
curl -X POST https://api.retailperformerai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

**Résultat attendu** :
- ✅ **200** ou **401** (pas 404 !)
- Si 401 : `{"detail":"Identifiants invalides"}` (normal, credentials invalides)
- Si 404 : Le router n'est toujours pas enregistré

### 3. Tester OPTIONS (CORS Preflight)

```bash
curl -X OPTIONS https://api.retailperformerai.com/api/auth/login \
  -H "Origin: https://retailperformerai.com" \
  -H "Access-Control-Request-Method: POST"
```

**Résultat attendu** :
- ✅ **200** avec headers CORS appropriés

### 4. Vérifier la Route /me (avec token valide)

```bash
curl -X GET https://api.retailperformerai.com/api/auth/me \
  -H "Authorization: Bearer <token_valide>"
```

**Résultat attendu** :
- ✅ **200** avec les données utilisateur
- ❌ **404** si le router n'est pas enregistré

## Checklist de Validation

- [ ] Les logs montrent `[ROUTES] ✅ Loaded auth router (8 routes)`
- [ ] Les logs montrent `[STARTUP] ✅ Auth router found with 8 routes`
- [ ] Les logs montrent `[STARTUP] ✅ Auth router registered`
- [ ] Les logs montrent `[STARTUP] ✅ Auth routes registered: [...]`
- [ ] L'OpenAPI contient toutes les routes `/api/auth/*`
- [ ] `POST /api/auth/login` retourne 200 ou 401 (pas 404)
- [ ] `GET /api/auth/me` fonctionne avec un token valide
- [ ] Aucune erreur dans les logs de démarrage

## Si le Problème Persiste

### Vérifier les Logs Complets

1. **Chercher les erreurs d'import** :
   ```
   [ROUTES] ❌ Failed to load
   ```

2. **Chercher les erreurs de démarrage** :
   ```
   [STARTUP] ❌ FATAL
   RuntimeError
   ```

3. **Vérifier les dépendances** :
   - `api.routes.auth` peut-il être importé ?
   - Les dépendances (`models.users`, `services.auth_service`, etc.) sont-elles disponibles ?

### Debug Local

Pour tester localement avant déploiement :

```bash
cd backend
python -c "from api.routes.auth import router; print(f'Router loaded: {len(router.routes)} routes')"
```

**Résultat attendu** :
```
Router loaded: 8 routes
```

Si erreur, corriger avant de déployer.

## Résumé des Modifications

1. ✅ Import direct du router auth (pas via `safe_import`)
2. ✅ Vérification explicite avant enregistrement
3. ✅ Vérification post-enregistrement dans `app.routes`
4. ✅ Démarrage bloqué si le router auth est absent
5. ✅ Logs détaillés à chaque étape

Ces modifications garantissent que le router auth sera toujours chargé et enregistré, ou que le démarrage échouera de manière visible.

