# 🧪 GUIDE DE TESTS - Onboarding

**Objectif** : Tester complètement le système d'onboarding avant validation finale

---

## 📋 CHECKLIST DE TESTS

### Test 1 : Vendeur - Mode VENDEUR_SAISIT
- [ ] Créer un compte vendeur
- [ ] Cliquer sur le bouton 🎓 Tutoriel
- [ ] Vérifier l'étape 3 : "📝 Saisissez vos KPI quotidiens"
- [ ] Tester navigation : Précédent, Suivant, Passer
- [ ] Cliquer sur la barre de progression (aller à l'étape 5 directement)
- [ ] Fermer avec X
- [ ] Rouvrir le tutoriel
- [ ] Compléter jusqu'à la fin

**✅ Résultat attendu** :
- Étape 3 affiche "Saisissez vos KPI"
- Navigation fluide
- Modal se ferme et se rouvre correctement

---

### Test 2 : Vendeur - Mode MANAGER_SAISIT
**Configuration** : Manager saisit les KPI (kpi_config.enabled = false)

- [ ] Se connecter en tant que vendeur
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier l'étape 3 : "👁️ Consultez vos KPI"
- [ ] Vérifier le texte : "Votre manager saisit vos résultats quotidiens"

**✅ Résultat attendu** :
- Étape 3 affiche "Consultez vos KPI" (lecture seule)
- Contenu adapté au mode

---

### Test 3 : Vendeur - Mode API_SYNC
**Configuration** : Compte enterprise avec sync_mode = "api_sync"

- [ ] Se connecter en tant que vendeur enterprise
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier l'étape 3 : "🔄 KPI Synchronisés"
- [ ] Vérifier le badge "🔄 Sync API"

**✅ Résultat attendu** :
- Étape 3 affiche "KPI Synchronisés"
- Badge bleu visible

---

### Test 4 : Gérant
- [ ] Créer un compte gérant
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier 5 étapes :
  1. 👋 Bienvenue
  2. 🏪 Créez vos magasins
  3. 👥 Invitez votre équipe
  4. 📊 Suivez vos performances
  5. 💳 Gérez votre abonnement
- [ ] Tester toutes les navigations

**✅ Résultat attendu** :
- 5 étapes affichées correctement
- Contenu pertinent pour le gérant

---

### Test 5 : Manager - Mode VENDEUR_SAISIT
- [ ] Créer un compte manager
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier l'étape 4 : "📊 Consultez les KPI"
- [ ] Vérifier le texte : "Vos vendeurs saisissent leurs KPI quotidiens"

**✅ Résultat attendu** :
- Étape 4 adaptée (consultation)
- 6 étapes au total

---

### Test 6 : Manager - Mode MANAGER_SAISIT
- [ ] Se connecter en tant que manager (mode saisie)
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier l'étape 4 : "📝 Saisissez les KPI"
- [ ] Vérifier le texte : "Vous êtes responsable de la saisie"

**✅ Résultat attendu** :
- Étape 4 adaptée (saisie active)

---

### Test 7 : IT Admin
- [ ] Se connecter en tant qu'IT Admin
- [ ] Cliquer sur 🎓 Tutoriel
- [ ] Vérifier 4 étapes :
  1. 👋 Espace IT Admin
  2. 🔑 Générez vos clés API
  3. 📚 Documentation API
  4. 🔄 Logs de synchronisation

**✅ Résultat attendu** :
- 4 étapes affichées
- Contenu technique adapté

---

## 🎯 TESTS FONCTIONNELS

### Test 8 : Navigation
- [ ] Cliquer "Suivant" → Passe à l'étape suivante
- [ ] Cliquer "Précédent" → Revient à l'étape précédente
- [ ] Cliquer "Passer" → Passe à l'étape suivante
- [ ] Bouton "Précédent" invisible sur étape 1
- [ ] Bouton "Suivant" devient "Terminer" sur dernière étape

**✅ Résultat attendu** :
- Navigation fluide sans bugs
- Boutons adaptés selon l'étape

---

### Test 9 : Barre de progression
- [ ] Cliquer sur cercle étape 1 → Va à l'étape 1
- [ ] Cliquer sur cercle étape 5 → Va à l'étape 5
- [ ] Cliquer sur cercle étape courante → Rien ne se passe (normal)
- [ ] Vérifier l'affichage "Étape X sur Y"
- [ ] Vérifier couleurs : bleu foncé (courante), bleu clair (passée), gris (à venir)

**✅ Résultat attendu** :
- Navigation directe fonctionnelle
- Indicateurs visuels corrects

---

### Test 10 : Fermeture
- [ ] Cliquer sur X → Modal se ferme
- [ ] Cliquer sur le backdrop (fond) → Modal se ferme
- [ ] Cliquer "Terminer" sur dernière étape → Modal se ferme
- [ ] Rouvrir le tutoriel → Recommence à l'étape 1

**✅ Résultat attendu** :
- Fermeture fonctionne de 3 manières différentes
- Réouverture réinitialise à l'étape 1

---

### Test 11 : Responsive
**Desktop (>768px)** :
- [ ] Modal centré, largeur fixe
- [ ] Texte "Tutoriel" visible sur le bouton
- [ ] Tout le contenu visible

**Mobile (<768px)** :
- [ ] Modal prend 95% de la largeur
- [ ] Texte "Tutoriel" caché, seulement icône 🎓
- [ ] Scrolling vertical si nécessaire
- [ ] Boutons empilés si besoin

**✅ Résultat attendu** :
- Interface adaptée à chaque taille d'écran

---

### Test 12 : Performance
- [ ] Ouverture du modal : < 100ms
- [ ] Navigation entre étapes : instantanée
- [ ] Pas de lag ou freeze
- [ ] Animations fluides

**✅ Résultat attendu** :
- Expérience utilisateur fluide

---

## 🐛 TESTS DE BUGS POTENTIELS

### Bug 1 : Double clic
- [ ] Double-cliquer rapidement sur "Suivant"
- [ ] Vérifier qu'on ne saute pas 2 étapes

### Bug 2 : Clic rapide barre de progression
- [ ] Cliquer rapidement sur plusieurs cercles
- [ ] Vérifier qu'on arrive bien à la dernière étape cliquée

### Bug 3 : Fermeture pendant navigation
- [ ] Cliquer "Suivant" puis "X" immédiatement
- [ ] Rouvrir → Doit être à l'étape 1

### Bug 4 : Mode KPI non détecté
- [ ] Vérifier que l'étape KPI est correcte
- [ ] Si erreur API, vérifier mode par défaut (VENDEUR_SAISIT)

---

## 📊 RAPPORT DE TESTS

Remplir après les tests :

| Test | Status | Commentaires |
|------|--------|--------------|
| Test 1 - Vendeur mode standard | ⏳ | |
| Test 2 - Vendeur manager saisit | ⏳ | |
| Test 3 - Vendeur API sync | ⏳ | |
| Test 4 - Gérant | ⏳ | |
| Test 5 - Manager mode standard | ⏳ | |
| Test 6 - Manager saisit | ⏳ | |
| Test 7 - IT Admin | ⏳ | |
| Test 8 - Navigation | ⏳ | |
| Test 9 - Barre progression | ⏳ | |
| Test 10 - Fermeture | ⏳ | |
| Test 11 - Responsive | ⏳ | |
| Test 12 - Performance | ⏳ | |

**Légende** : ⏳ À tester | ✅ OK | ❌ Bug trouvé

---

## 🔧 DEBUGGING

### Si le bouton Tutoriel n'apparaît pas :
1. Vider le cache (Ctrl+Shift+R)
2. Vérifier que l'application est bien redéployée
3. Inspecter la console pour erreurs JavaScript

### Si le modal ne s'ouvre pas :
1. Ouvrir la console navigateur (F12)
2. Chercher erreurs en rouge
3. Vérifier que les imports sont corrects

### Si le contenu KPI n'est pas adaptatif :
1. Vérifier le mode détecté dans la console
2. Tester l'endpoint `/api/seller/kpi-enabled`
3. Vérifier `isReadOnly` du hook `useSyncMode`

### Si navigation ne fonctionne pas :
1. Vérifier qu'il n'y a pas d'erreurs console
2. Tester dans un autre navigateur
3. Vider cache et cookies

---

## ✅ VALIDATION FINALE

Une fois tous les tests passés :
- [ ] Aucun bug critique trouvé
- [ ] Navigation fluide sur tous les rôles
- [ ] Contenu adaptatif fonctionne
- [ ] Design responsive OK
- [ ] Performance acceptable

**Si tous les tests sont ✅** → Système d'onboarding validé ! 🎉

**Si des bugs ❌** → Reporter les issues pour correction
