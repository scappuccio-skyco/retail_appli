# 🔧 Dépannage des Clés API

## Problème : "Invalid or inactive API Key" (401)

Si vous recevez cette erreur lors de l'utilisation de l'API, voici les étapes de diagnostic :

### ✅ Vérifications à effectuer

#### 1. Format de la clé API

Les clés API pour les intégrations (gérants) doivent commencer par `sk_live_` :

```bash
# ✅ Format correct
sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ❌ Format incorrect
ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # C'est pour les entreprises
rp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Ancien format
```

#### 2. En-tête HTTP correct

Assurez-vous d'envoyer la clé API dans le bon en-tête :

```bash
# Option 1 : En-tête X-API-Key (recommandé)
X-API-Key: sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Option 2 : En-tête Authorization
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Exemple avec curl :**
```bash
curl -X POST http://localhost:8001/api/integrations/stores \
  -H "X-API-Key: sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Magasin",
    "location": "Paris"
  }'
```

#### 3. Permissions de la clé API

La clé API doit avoir la permission `stores:write` pour créer un magasin.

**Vérification via l'interface :**
1. Connectez-vous à l'application
2. Allez dans "Clés API" ou "Intégrations"
3. Vérifiez que votre clé a la permission `stores:write` cochée

**Permissions requises pour chaque endpoint :**
- `POST /api/integrations/stores` → `stores:write`
- `GET /api/integrations/stores` → `stores:read`
- `POST /api/integrations/stores/{store_id}/managers` → `users:write`
- `POST /api/integrations/kpi/sync` → `write:kpi`

#### 4. Statut de la clé API

La clé API doit être **active** dans la base de données.

**Causes possibles :**
- La clé a été désactivée manuellement
- La clé a expiré (si une date d'expiration était définie)
- La clé a été révoquée

**Solution :** Créez une nouvelle clé API ou réactivez l'ancienne via l'interface.

#### 5. Expiration de la clé

Si la clé a une date d'expiration, vérifiez qu'elle n'est pas dépassée.

**Message d'erreur spécifique :** `"API Key expired"`

**Solution :** Créez une nouvelle clé API avec une nouvelle date d'expiration.

### 🔍 Diagnostic avancé

#### Vérifier les logs du serveur

Les logs du serveur contiennent maintenant plus d'informations sur les échecs de vérification :

```bash
# Cherchez dans les logs
grep "API key verification failed" logs/app.log
grep "Invalid API key format" logs/app.log
grep "No API keys found with prefix" logs/app.log
```

#### Messages d'erreur détaillés

Les nouveaux messages d'erreur vous indiquent la cause exacte :

| Message d'erreur | Cause | Solution |
|-----------------|-------|----------|
| `"API key required"` | Clé manquante dans les en-têtes | Ajoutez `X-API-Key` ou `Authorization: Bearer` |
| `"Invalid API Key format"` | Format incorrect (pas `sk_live_`) | Vérifiez que la clé commence par `sk_live_` |
| `"No matching key found"` | Aucune clé avec ce préfixe | Vérifiez que la clé existe dans la base |
| `"Hash verification failed"` | Le hash ne correspond pas | La clé a peut-être été modifiée, créez-en une nouvelle |
| `"API Key is inactive"` | Clé désactivée | Réactivez ou créez une nouvelle clé |
| `"API Key expired"` | Date d'expiration dépassée | Créez une nouvelle clé |
| `"missing tenant_id"` | Problème de configuration | Contactez le support |

### 📝 Exemple de requête complète

```bash
# 1. Créer un magasin
curl -X POST http://localhost:8001/api/integrations/stores \
  -H "X-API-Key: sk_live_VOTRE_CLE_ICI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Magasin Test",
    "location": "Paris",
    "address": "123 Rue de la Paix",
    "phone": "+33123456789"
  }'

# Réponse attendue (200 OK) :
{
  "success": true,
  "store": {
    "id": "store-uuid",
    "name": "Magasin Test",
    "location": "Paris",
    ...
  }
}

# Erreur si clé invalide (401) :
{
  "detail": "Invalid or inactive API Key - No matching key found"
}
```

### 🆘 Solutions rapides

1. **Recréer une clé API :**
   - Allez dans l'interface → Clés API
   - Supprimez l'ancienne clé
   - Créez une nouvelle clé avec les permissions `stores:write`
   - Copiez la nouvelle clé (affichée une seule fois)

2. **Vérifier la configuration N8N :**
   - Assurez-vous que N8N envoie bien l'en-tête `X-API-Key`
   - Vérifiez qu'il n'y a pas d'espaces avant/après la clé
   - Vérifiez que la clé complète est utilisée (pas tronquée)

3. **Tester avec curl d'abord :**
   - Testez la requête avec curl pour isoler le problème
   - Si curl fonctionne mais pas N8N, le problème vient de la configuration N8N

### 📞 Support

Si le problème persiste après ces vérifications, fournissez :
1. Le message d'erreur complet
2. Les logs du serveur (lignes contenant "API key")
3. Le format de la clé utilisée (premiers 15 caractères seulement)
4. La configuration N8N (sans la clé complète)

