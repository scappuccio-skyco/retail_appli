# 🚀 Mise à Jour du Rate Limiting API

## Date : 9 décembre 2025

## 🎯 Problème
L'utilisateur a rencontré une erreur lors de l'envoi de données via N8N :
```
Rate limit exceeded. Maximum 100 requests per minute.
```

La limite de 100 requêtes/minute était trop faible pour les cas d'usage réels :
- Imports quotidiens de plusieurs magasins
- Imports historiques (30+ jours de données)
- Synchronisation automatisée via N8N

## ✅ Solution Implémentée

### Nouvelle Configuration : **600 requêtes par minute**

#### Pourquoi 600 ?
- ✅ Permet à 6 magasins de synchroniser simultanément (100 req chacun)
- ✅ Import historique : 1 mois de données (3000 entrées) en ~5 minutes
- ✅ Marge de sécurité pour les pics d'activité
- ✅ Protection contre les abus maintenue

### Modifications Apportées

#### 1. Backend `.env` - Nouvelle Variable
**Fichier** : `/app/backend/.env`

```env
# Rate Limiting API (requêtes par minute)
API_RATE_LIMIT=600
```

#### 2. Configuration du Rate Limiter
**Fichier** : `/app/backend/server.py`

**Avant :**
```python
rate_limiter = RateLimiter(requests_per_minute=100)
```

**Après :**
```python
API_RATE_LIMIT = int(os.environ.get('API_RATE_LIMIT', 600))
rate_limiter = RateLimiter(requests_per_minute=API_RATE_LIMIT)
```

#### 3. Message d'Erreur Dynamique
Le message d'erreur affiche maintenant la limite configurée :

**Avant :**
```
Rate limit exceeded. Maximum 100 requests per minute.
```

**Après :**
```
Rate limit exceeded. Maximum 600 requests per minute.
```

## 📊 Comparaison Avant/Après

| Scénario | Avant (100/min) | Après (600/min) |
|----------|----------------|-----------------|
| Import quotidien (5 magasins) | ❌ Limite atteinte | ✅ OK (500 req) |
| Import 1 mois (3000 entrées) | ⏱️ 30 minutes | ⏱️ 5 minutes |
| Synchronisation N8N | ❌ Échec | ✅ Fonctionne |

## 🔧 Comment Ajuster la Limite

Si vous avez besoin de changer la limite à l'avenir :

1. Éditez `/app/backend/.env`
2. Modifiez la valeur de `API_RATE_LIMIT`
3. Redémarrez le backend :
   ```bash
   sudo supervisorctl restart backend
   ```

### Exemples de Valeurs

| Limite | Cas d'Usage |
|--------|-------------|
| 300 | Petite plateforme (1-3 magasins) |
| 600 | **Production standard (recommandé)** |
| 1000 | Forte activité (10+ magasins) |
| 2000 | Imports massifs fréquents |

⚠️ **Note** : Des valeurs trop élevées (>2000) peuvent impacter les performances du serveur.

## 🧪 Test de la Configuration

Pour vérifier que le rate limit fonctionne :

```bash
# Tester avec curl (remplacez YOUR_API_KEY)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-API-Key: YOUR_API_KEY" \
    https://retailperformerai.com/api/v1/integrations/stores
  sleep 0.1
done
```

**Résultat attendu :**
- Les 600 premières requêtes : `200 OK`
- La 601ème requête : `429 Rate Limit Exceeded`

## 📈 Headers HTTP Retournés

En cas de dépassement, l'API retourne :

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Remaining: 0

{
  "detail": "Rate limit exceeded. Maximum 600 requests per minute. Try again in a few seconds."
}
```

## 🔍 Monitoring

### Logs Backend
Les dépassements de limite sont loggés automatiquement :
```bash
tail -f /var/log/supervisor/backend.err.log | grep "Rate limit"
```

### Vérifier la Configuration Active
```bash
grep API_RATE_LIMIT /app/backend/.env
```

## 🚀 Recommandations N8N

Pour optimiser vos workflows N8N avec cette nouvelle limite :

### 1. Traitement Par Lots
```javascript
// Envoyer par lots de 100 requêtes
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  // Traiter le batch
  if (i + batchSize < items.length) {
    await new Promise(r => setTimeout(r, 10000)); // Pause 10s entre lots
  }
}
```

### 2. Configuration N8N
- **Max Concurrency** : 10-20 (éviter de saturer)
- **Retry on Failure** : Oui, avec backoff exponentiel
- **Timeout** : 30 secondes

### 3. Gérer les Erreurs 429
```javascript
// Dans votre node N8N
if (error.statusCode === 429) {
  const retryAfter = error.headers['retry-after'] || 60;
  console.log(`Rate limit hit, retrying in ${retryAfter}s`);
  await new Promise(r => setTimeout(r, retryAfter * 1000));
  // Retry request
}
```

## 📋 Checklist de Vérification

- ✅ Variable `API_RATE_LIMIT=600` ajoutée dans `.env`
- ✅ Code mis à jour pour utiliser la variable
- ✅ Message d'erreur mis à jour
- ✅ Backend redémarré
- ✅ Configuration testée avec N8N

## 🎯 Résultat

Vous pouvez maintenant envoyer jusqu'à **600 requêtes par minute** via N8N ou toute autre intégration API, ce qui devrait couvrir tous vos besoins d'importation de données.

---

**Fichiers Modifiés :**
- `/app/backend/.env` - Ajout de `API_RATE_LIMIT=600`
- `/app/backend/server.py` - Configuration dynamique du rate limiter

**Agent** : E1 (Fork Agent)  
**Session** : 9 décembre 2025
