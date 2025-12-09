# 🔑 Accès pour Tests - Architecture Multi-Magasins

## 📅 Date : 2025-11-18
## ✅ Phase B - Migration COMPLÉTÉE

---

## 🏢 ACCÈS GÉRANT (Nouveau Rôle)

### 👨‍💼 Directeur Skyco (Gérant de tous les magasins)
```
📧 Email: gerant@skyco.fr
🔑 Mot de passe: gerant123
🎭 Rôle: gerant
```

**Ce qu'il peut faire :**
- ✅ Voir tous les magasins (Paris, Lyon, Bordeaux)
- ✅ Créer de nouveaux magasins
- ✅ Voir les stats globales (tous magasins)
- ✅ Voir et transférer les managers entre magasins
- ✅ Voir et transférer les vendeurs entre magasins
- ✅ Comparer les performances inter-magasins

**Endpoint de test :**
```bash
curl -X POST https://retail-api-fix-1.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gerant@skyco.fr","password":"gerant123"}'
```

---

## 🏪 MAGASINS CRÉÉS

### 1. 📍 Skyco Paris Centre
- **Location :** 75001 Paris
- **Adresse :** 123 Rue de Rivoli, 75001 Paris
- **Téléphone :** +33 1 42 60 30 00
- **Horaires :** 9h-19h du Lundi au Samedi
- **Managers :** 2
- **Vendeurs :** 4

### 2. 📍 Skyco Lyon Part-Dieu
- **Location :** 69003 Lyon
- **Adresse :** 45 Rue de la République, 69003 Lyon
- **Téléphone :** +33 4 78 63 40 00
- **Horaires :** 9h-19h du Lundi au Samedi
- **Managers :** 2
- **Vendeurs :** 13

### 3. 📍 Skyco Bordeaux Mériadeck
- **Location :** 33000 Bordeaux
- **Adresse :** 78 Cours de l'Intendance, 33000 Bordeaux
- **Téléphone :** +33 5 56 44 20 00
- **Horaires :** 9h-19h du Lundi au Samedi
- **Managers :** 1
- **Vendeurs :** 6

---

## 👨‍💼 ACCÈS MANAGERS (par magasin)

### Skyco Paris Centre
```
📧 Email: cappuccioseb@gmail.com
🔑 Mot de passe: [mot de passe existant]
👤 Nom: Dalmatien Damein
🏪 Magasin: Skyco Paris Centre
```

```
📧 Email: manager_analyse@test.com
🔑 Mot de passe: password123
👤 Nom: Manager Test Analyse
🏪 Magasin: Skyco Paris Centre
```

### Skyco Lyon Part-Dieu
```
📧 Email: Manager12@test.com
🔑 Mot de passe: [mot de passe existant]
👤 Nom: DENIS TOM
🏪 Magasin: Skyco Lyon Part-Dieu
```

```
📧 Email: manager1@test.com
🔑 Mot de passe: password123
👤 Nom: Test Manager 1
🏪 Magasin: Skyco Lyon Part-Dieu
```

### Skyco Bordeaux Mériadeck
```
📧 Email: y.legoff@skyco.fr
🔑 Mot de passe: password123
👤 Nom: le goff
🏪 Magasin: Skyco Bordeaux Mériadeck
```

---

## 👥 ACCÈS VENDEURS (exemples par magasin)

### Skyco Paris Centre (4 vendeurs)
```
📧 Email: [email du vendeur]
🔑 Mot de passe: password123
🏪 Magasin: Skyco Paris Centre
```

### Skyco Lyon Part-Dieu (13 vendeurs)
```
📧 Email: sophie.martin@skyco.fr
🔑 Mot de passe: password123
👤 Nom: Sophie Martin
🏪 Magasin: Skyco Lyon Part-Dieu
```

### Skyco Bordeaux Mériadeck (6 vendeurs)
```
📧 Email: sophie.martin@skyco.fr (duplicate)
🔑 Mot de passe: password123
👤 Nom: Sophie Martin
🏪 Magasin: Skyco Bordeaux Mériadeck
```

---

## 🧪 TESTS À EFFECTUER

### 1. Test Connexion Gérant
1. Se connecter avec `gerant@skyco.fr` / `gerant123`
2. Vérifier la redirection vers `/gerant-dashboard` (à créer en Phase C)
3. **Note :** Pour l'instant, vous serez redirigé vers `/manager-dashboard` ou erreur car l'interface gérant n'existe pas encore

### 2. Test Endpoints API Gérant

#### a) Dashboard Stats Globales
```bash
# Récupérer le token après login
curl -X GET https://retail-api-fix-1.preview.emergentagent.com/api/gerant/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "total_stores": 3,
  "total_managers": 5,
  "total_sellers": 23,
  "today_ca": [montant],
  "today_ventes": [nombre],
  "today_articles": [nombre],
  "stores": [...]
}
```

#### b) Liste des Magasins
```bash
curl -X GET https://retail-api-fix-1.preview.emergentagent.com/api/gerant/stores \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### c) Stats d'un Magasin Spécifique
```bash
curl -X GET https://retail-api-fix-1.preview.emergentagent.com/api/gerant/stores/{store_id}/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### d) Managers d'un Magasin
```bash
curl -X GET https://retail-api-fix-1.preview.emergentagent.com/api/gerant/stores/{store_id}/managers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### e) Créer un Nouveau Magasin
```bash
curl -X POST https://retail-api-fix-1.preview.emergentagent.com/api/gerant/stores \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Skyco Marseille Vieux-Port",
    "location": "13001 Marseille",
    "address": "12 Quai du Port, 13001 Marseille",
    "phone": "+33 4 91 90 00 00",
    "opening_hours": "9h-19h"
  }'
```

#### f) Transférer un Manager
```bash
curl -X POST https://retail-api-fix-1.preview.emergentagent.com/api/gerant/managers/{manager_id}/transfer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_store_id": "{nouveau_magasin_id}"
  }'
```

#### g) Transférer un Vendeur
```bash
curl -X POST https://retail-api-fix-1.preview.emergentagent.com/api/gerant/sellers/{seller_id}/transfer \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_store_id": "{nouveau_magasin_id}",
    "new_manager_id": "{nouveau_manager_id}"
  }'
```

### 3. Test Managers Existants
1. Se connecter avec un manager existant (ex: `y.legoff@skyco.fr`)
2. Vérifier que le dashboard manager fonctionne toujours
3. Vérifier que les KPIs s'affichent correctement
4. ✅ Les managers devraient voir uniquement leur magasin

### 4. Test Vendeurs Existants
1. Se connecter avec un vendeur (ex: `sophie.martin@skyco.fr`)
2. Vérifier que le dashboard vendeur fonctionne
3. Vérifier que les KPIs historiques sont toujours présents
4. ✅ Pas de changement pour les vendeurs

---

## 📊 RÉSUMÉ MIGRATION

### Données Migrées
- ✅ **3 Magasins créés** (Paris, Lyon, Bordeaux)
- ✅ **1 Gérant créé** (gerant@skyco.fr)
- ✅ **5 Managers assignés** aux magasins
- ✅ **23 Vendeurs assignés** aux magasins
- ✅ **182 KPI entries** migrées avec store_id/gerant_id
- ✅ **24 KPIs mensuels** migrés avec store_id/gerant_id
- ✅ **3 Challenges** migrés avec store_id/gerant_id

### Répartition
- **Paris Centre :** 2 managers, 4 vendeurs
- **Lyon Part-Dieu :** 2 managers, 13 vendeurs
- **Bordeaux Mériadeck :** 1 manager, 6 vendeurs

---

## 🚀 PROCHAINE ÉTAPE

**Phase C - Frontend Interface Gérant**

Fichiers à créer :
1. `frontend/src/pages/GerantDashboard.js`
2. `frontend/src/components/gerant/StoreCard.js`
3. `frontend/src/components/gerant/StoreDetailModal.js`
4. `frontend/src/components/gerant/CreateStoreModal.js`
5. `frontend/src/components/gerant/ManagerTransferModal.js`
6. `frontend/src/components/gerant/SellerTransferModal.js`

Modifications :
- `frontend/src/pages/Login.js` : Redirection gérant
- `frontend/src/App.js` : Route `/gerant-dashboard`
- `frontend/src/pages/ManagerDashboard.js` : Afficher nom magasin

---

## ⚠️ NOTES IMPORTANTES

1. **Interface Gérant Non Créée** : Pour l'instant, la connexion en tant que gérant ne fonctionnera pas visuellement car l'interface n'existe pas encore (Phase C)

2. **Backend Prêt** : Tous les endpoints API sont fonctionnels et testables avec curl

3. **Compatibilité** : Les managers et vendeurs existants peuvent se connecter normalement, rien n'a changé pour eux

4. **KPIs Conservés** : Tous les KPIs historiques sont préservés et maintenant associés à leur magasin

---

## 📝 COMMANDES UTILES

### Vérifier la Migration
```bash
# Connexion MongoDB
mongosh mongodb://localhost:27017/retail_coach

# Vérifier les magasins
db.stores.find({}).pretty()

# Vérifier un utilisateur
db.users.findOne({email: "gerant@skyco.fr"})

# Compter par magasin
db.users.aggregate([
  {$match: {role: "seller"}},
  {$group: {_id: "$store_id", count: {$sum: 1}}}
])
```

### Relancer la Migration (si nécessaire)
```bash
cd /app/backend
python migrate_to_multi_store.py
```

---

**✅ Phase B TERMINÉE - Backend + Migration COMPLETS**

**Prêt pour Phase C - Interface Frontend** 🚀
