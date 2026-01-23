# 🔄 INSTRUCTIONS : VIDER LE CACHE DU NAVIGATEUR

**Problème**: Les cadenas n'ont pas disparu après le déploiement  
**Cause probable**: Cache du navigateur qui utilise encore l'ancienne version du JavaScript

---

## 🎯 SOLUTION RAPIDE

### Option 1 : Rechargement forcé (Recommandé)

**Windows/Linux**:
- `Ctrl + Shift + R` ou `Ctrl + F5`

**Mac**:
- `Cmd + Shift + R`

**Résultat**: Force le navigateur à télécharger la nouvelle version du JavaScript

---

### Option 2 : Vider le cache manuellement

**Chrome/Edge**:
1. Ouvrir les outils développeur (`F12`)
2. Clic droit sur le bouton de rechargement (🔄)
3. Sélectionner "Vider le cache et effectuer un rechargement forcé"

**Firefox**:
1. Ouvrir les outils développeur (`F12`)
2. Onglet "Réseau"
3. Clic droit → "Vider le cache"
4. Recharger la page (`F5`)

---

### Option 3 : Mode navigation privée

1. Ouvrir une fenêtre de navigation privée (`Ctrl + Shift + N` ou `Cmd + Shift + N`)
2. Se connecter à l'application
3. Tester si les cadenas ont disparu

---

## ⏱️ VÉRIFICATION DU DÉPLOIEMENT

Le déploiement Vercel prend généralement **2-3 minutes**. Pour vérifier :

1. **Vérifier le statut du déploiement**:
   - Aller sur https://vercel.com
   - Vérifier que le dernier déploiement est "Ready" (vert)

2. **Vérifier la version du JavaScript**:
   - Ouvrir les outils développeur (`F12`)
   - Onglet "Network"
   - Recharger la page
   - Chercher `main.*.js` ou `StaffOverview.*.js`
   - Vérifier la date/heure du fichier (doit être récente)

---

## 🔍 VÉRIFICATION DU CODE DÉPLOYÉ

Si après avoir vidé le cache les cadenas sont toujours là :

1. **Vérifier dans la console**:
   ```javascript
   // Dans la console du navigateur (F12)
   // Vérifier que canManageStaff est bien true
   ```

2. **Vérifier le code source**:
   - Ouvrir les outils développeur (`F12`)
   - Onglet "Sources"
   - Chercher `StaffOverview.js`
   - Vérifier que la ligne contient `canManageStaff` (pas `isReadOnly`)

---

## 🚨 SI LE PROBLÈME PERSISTE

1. **Vérifier que le déploiement est terminé** (voir ci-dessus)
2. **Attendre 5 minutes** après le déploiement (propagation CDN)
3. **Vider complètement le cache**:
   - Chrome: `chrome://settings/clearBrowserData`
   - Firefox: `about:preferences#privacy` → "Effacer les données"
4. **Tester dans un autre navigateur** pour confirmer

---

*Instructions créées le 23 Janvier 2026*
