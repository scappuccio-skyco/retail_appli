# 🔑 Identifiants de Test - Retail Performer AI

## 📋 Base de données actuelle
**Base MongoDB :** `retail_coach`  
**URL :** `mongodb://localhost:27017`

---

## ✅ COMPTES DE TEST SIMPLIFIÉS (Créés pour vous)

**Comptes de démonstration (mot de passe : TestDemo123!) :**
- `gerant.demo@test.fr` (Gérant) ✅ VALIDÉ
- `manager.demo@test.fr` (Manager) ✅ VALIDÉ
- `vendeur.demo@test.fr` (Vendeur) ✅ VALIDÉ

**Autres comptes (mot de passe : test123) :**
- `gerant.test@demo.com` (Gérant)
- `manager.test@demo.com` (Manager)
- `vendeur.test@demo.com` (Vendeur)
- `s.cappuccio@skyco.fr` (Gérant)

📄 Documentation complète : `/app/IDENTIFIANTS_TEST.md`

---

## 📝 COMPTES EXISTANTS AVEC MOTS DE PASSE CONNUS

### 🏪 Gérants
- **Email :** `gerant@retail-coach.fr`
  - **Mot de passe :** `TestPassword123!`
  - **Nom :** Gérant Demo

### 👤 Vendeurs (selon handoff)
- **Email :** `vendeur@retail-coach.fr`
  - **Mot de passe :** `TestPassword123!`
  - **Nom :** Vendeur (si existant)

---

## 🗂️ AUTRES COMPTES DANS LA BASE (mot de passe inconnu)

### Managers
- `cappuccioseb@gmail.com` - Dalmatien Damein (status: deleted)
- `Manager12@test.com` - DENIS TOM
- `y.legoff@skyco.fr` - le goff
- `manager_analyse@test.com` - Manager Test Analyse

### Vendeurs
- `vendeur1@test.com` à `vendeur4@test.com` - Vendeur Test 1-4
- `emma.petit@test.com` - Emma Petit
- `sophie.durand@test.com` - Sophie Durand
- `lucas.bernard@test.com` - Lucas Bernard
- `sophie.martin@skyco.fr` - Sophie Martin
- `alexandre.petit@skyco.fr` - Alexandre Petit
- Et plusieurs autres...

---

## 🔧 Comment réinitialiser un mot de passe

Si vous avez besoin de réinitialiser le mot de passe d'un compte existant vers "test123" :

```bash
python3 /tmp/reset_password.py <email>
```

---

## ⚠️ IMPORTANT : Vider le cache du navigateur

Après avoir corrigé le bug de redirection Gérant, vous DEVEZ vider le cache de votre navigateur :

1. **Chrome/Edge** : F12 → Clic droit sur rafraîchir → "Vider le cache et actualiser"
2. **Firefox** : Ctrl+Shift+Suppr → Cocher "Cache" → Effacer
3. **Safari** : Cmd+Option+E

---

## 🧪 Tester la connexion

Pour tester un compte depuis le terminal :

```bash
curl -X POST "https://dashview-enhance.preview.emergentagent.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"gerant.test@demo.com","password":"test123"}'
```

---

**Dernière mise à jour :** 4 décembre 2025
