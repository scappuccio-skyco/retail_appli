# Diagnostic 404 sur `/api/manager/kpi-config`

## Problème
L'endpoint `/api/manager/kpi-config` retourne un 404 (Not Found) même après les corrections.

## Causes possibles

### 1. **Router non enregistré**
- Vérifier que le router manager est bien chargé dans `backend/api/routes/__init__.py`
- Vérifier que le router est bien inclus dans `backend/main.py`

### 2. **Exception dans les dépendances**
Si une exception est levée dans `get_current_user` ou `get_store_context`, FastAPI peut retourner un 404 au lieu de l'exception réelle.

### 3. **Problème d'authentification**
Si le token JWT est invalide ou expiré, `get_current_user` lève une exception qui peut être interprétée comme un 404.

## Corrections appliquées

1. ✅ Ajout de logs détaillés dans `get_kpi_config` et `update_kpi_config`
2. ✅ Amélioration de la gestion d'erreurs dans `get_store_context`
3. ✅ Ajout d'un endpoint de test `/api/manager/test` pour vérifier que le router fonctionne
4. ✅ `get_store_context` ne lève plus d'exception si le magasin n'existe pas (retourne `resolved_store_id: None`)

## Actions à prendre

1. **Vérifier les logs serveur** pour voir si l'endpoint est appelé
2. **Tester l'endpoint de test** : `GET /api/manager/test` (devrait retourner `{"status": "ok"}`)
3. **Vérifier l'authentification** : s'assurer que le token JWT est valide
4. **Vérifier le store_id** : s'assurer que le magasin existe et appartient au gérant

## Test manuel

```bash
# Test 1: Vérifier que le router est enregistré
curl -X GET https://api.retailperformerai.com/api/manager/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 2: Tester l'endpoint kpi-config
curl -X GET "https://api.retailperformerai.com/api/manager/kpi-config?store_id=65612592-c180-4b81-a9a2-877f4ee51d8b" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Prochaines étapes

Si le problème persiste après redémarrage du serveur :
1. Vérifier les logs serveur pour voir les erreurs exactes
2. Vérifier que le router manager est bien chargé au démarrage
3. Vérifier que l'URL de l'API est correcte dans le frontend
