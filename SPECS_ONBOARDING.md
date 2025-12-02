# 📖 SPÉCIFICATIONS ONBOARDING
## Retail Performer AI - Tutoriel interactif

**Date**: 2 Décembre 2024  
**Status**: ✅ Specs validées avec utilisateur  
**Type**: Fonctionnalité non-intrusive, accessible à la demande

---

## 🎯 OBJECTIF

Créer un système de tutoriel interactif qui guide les utilisateurs dans la découverte de l'application, **sans l'imposer**, accessible via un bouton permanent.

---

## 👤 DÉCISIONS UTILISATEUR

### Validations confirmées
- ✅ **Bouton permanent** : Toujours accessible (pas de popup imposée)
- ✅ **Label** : "Tutoriel" (avec icône 🎓)
- ✅ **Navigation libre** : Possibilité de sauter des étapes
- ✅ **Style** : Modal centré (inspiré de l'app Père Noël)
- ✅ **Relançable** : Peut être relancé à tout moment

---

## 🎨 DESIGN & UX

### A. Placement du bouton "Tutoriel"

**Dans le header de chaque dashboard** :
```
┌─────────────────────────────────────────────────────┐
│ 👤 Jean Martin      [🎓 Tutoriel] [⚙️] [🚪]         │
└─────────────────────────────────────────────────────┘
```

**Spécifications visuelles** :
- Icône : 🎓 (graduation cap)
- Position : À côté des paramètres, avant déconnexion
- Style : Bouton secondaire (non proéminent mais visible)
- Tooltip : "Découvrir l'application"

### B. Modal de tutoriel

**Structure du modal** :
```
┌────────────────────────────────────────────────────┐
│  [X]                                               │
│                                                    │
│  ━━━●━━━○━━━○━━━○━━━○━━━○━━━  3/7                │
│                                                    │
│  📝 Étape 3 : Saisissez vos KPI                   │
│                                                    │
│  Chaque jour, enregistrez vos résultats :         │
│  • CA réalisé                                      │
│  • Nombre de ventes                                │
│  • Panier moyen                                    │
│                                                    │
│  C'est essentiel pour recevoir du coaching        │
│  IA personnalisé basé sur vos performances !      │
│                                                    │
│  [Illustration ou capture d'écran]                │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [← Précédent] [Passer] [Suivant →]          │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**Dimensions** :
- Largeur : 600-700px (max-w-2xl en Tailwind)
- Hauteur : Auto (max 80vh)
- Fond : backdrop blur + opacité
- Centré verticalement et horizontalement

### C. Barre de progression

**Style** :
```
Étapes complétées : ━━━● (bleu foncé)
Étape courante     : ●    (bleu vif + plus gros)
Étapes à venir     : ○    (gris clair)
```

**Interactions** :
- ✅ **Cliquable** : Clic sur un cercle → va directement à l'étape
- ✅ **Visuel** : Affiche "3/7" à côté
- ✅ **Responsive** : S'adapte au nombre d'étapes

### D. Boutons de navigation

**Trois boutons à chaque étape** :

1. **"← Précédent"** (si étape > 0)
   - Style : Bouton secondaire (outline)
   - Position : Gauche
   - Action : Retour à l'étape précédente

2. **"Passer"**
   - Style : Bouton tertiaire (texte uniquement)
   - Position : Centre
   - Action : Passe à l'étape suivante (même comportement que "Suivant")

3. **"Suivant →"** (ou "Terminer" si dernière étape)
   - Style : Bouton primaire (bleu)
   - Position : Droite
   - Action : Avance à l'étape suivante ou ferme le modal

**Bouton fermer (X)** :
- Position : Coin supérieur droit
- Toujours visible
- Ferme le modal immédiatement

---

## 🔧 ARCHITECTURE TECHNIQUE

### A. Structure des composants

```
/app/frontend/src/
├── components/
│   └── onboarding/
│       ├── OnboardingModal.js          # Composant principal
│       ├── OnboardingStep.js           # Contenu d'une étape
│       ├── ProgressBar.js              # Barre de progression
│       └── TutorialButton.js           # Bouton "🎓 Tutoriel"
└── hooks/
    └── useOnboarding.js                # Hook de gestion d'état
```

### B. Hook `useOnboarding.js`

```javascript
export const useOnboarding = (role, totalSteps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Actions
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  
  const next = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      markCompleted(currentStep);
    }
  };
  
  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const goTo = (step) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  };
  
  const skip = () => next(); // Même comportement que next
  
  const markCompleted = (step) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  return {
    isOpen,
    currentStep,
    completedSteps,
    open,
    close,
    next,
    prev,
    goTo,
    skip
  };
};
```

### C. Composant `TutorialButton.js`

```javascript
import React from 'react';
import { GraduationCap } from 'lucide-react';

export default function TutorialButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title="Découvrir l'application"
    >
      <GraduationCap className="w-5 h-5" />
      <span className="hidden md:inline">Tutoriel</span>
    </button>
  );
}
```

### D. Composant `OnboardingModal.js`

```javascript
import React from 'react';
import { X } from 'lucide-react';
import ProgressBar from './ProgressBar';
import OnboardingStep from './OnboardingStep';

export default function OnboardingModal({
  isOpen,
  onClose,
  currentStep,
  totalSteps,
  steps,
  onNext,
  onPrev,
  onGoTo,
  onSkip
}) {
  if (!isOpen) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Progress bar */}
          <ProgressBar
            current={currentStep}
            total={totalSteps}
            onGoTo={onGoTo}
          />

          {/* Step content */}
          <OnboardingStep step={steps[currentStep]} />

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <button
              onClick={onPrev}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isFirstStep
                  ? 'opacity-0 cursor-default'
                  : 'border-2 border-gray-300 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              ← Précédent
            </button>

            <button
              onClick={onSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Passer
            </button>

            <button
              onClick={isLastStep ? onClose : onNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? 'Terminer' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### E. Composant `ProgressBar.js`

```javascript
import React from 'react';

export default function ProgressBar({ current, total, onGoTo }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-2">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={`transition-all ${
              i === current
                ? 'w-4 h-4 bg-blue-600 rounded-full'
                : i < current
                ? 'w-3 h-3 bg-blue-400 rounded-full hover:scale-125'
                : 'w-3 h-3 bg-gray-300 rounded-full hover:scale-125'
            }`}
            title={`Étape ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-center text-sm text-gray-500">
        Étape {current + 1} sur {total}
      </p>
    </div>
  );
}
```

### F. Composant `OnboardingStep.js`

```javascript
import React from 'react';

export default function OnboardingStep({ step }) {
  return (
    <div className="py-4">
      {/* Icon */}
      {step.icon && (
        <div className="text-5xl mb-4 text-center">
          {step.icon}
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
        {step.title}
      </h2>

      {/* Description */}
      <div className="text-gray-600 text-center space-y-3 mb-6">
        {step.description}
      </div>

      {/* Screenshot or illustration (optional) */}
      {step.image && (
        <div className="bg-gray-100 rounded-lg p-4 mb-4">
          <img 
            src={step.image} 
            alt={step.title}
            className="w-full rounded"
          />
        </div>
      )}

      {/* Tips (optional) */}
      {step.tips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Conseil :</strong> {step.tips}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 📋 CONTENU DES ÉTAPES

### VENDEUR (7 étapes - Adaptatif)

#### Étape 1 : Bienvenue
```javascript
{
  icon: '👋',
  title: 'Bienvenue sur Retail Performer AI',
  description: (
    <>
      <p>Vous êtes vendeur chez [Nom Entreprise].</p>
      <p>Ce tutoriel va vous guider dans la découverte de votre espace personnel.</p>
      <p>Vous pouvez passer ou revenir sur n'importe quelle étape.</p>
    </>
  ),
  tips: 'Prenez votre temps, vous pourrez relancer ce tutoriel à tout moment !'
}
```

#### Étape 2 : Diagnostic (CRITIQUE)
```javascript
{
  icon: '🎯',
  title: 'Complétez votre diagnostic',
  description: (
    <>
      <p>Le diagnostic de compétences est votre <strong>première étape obligatoire</strong>.</p>
      <p>Il permet de :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Identifier votre profil de vendeur</li>
        <li>Personnaliser votre coaching IA</li>
        <li>Débloquer toutes les fonctionnalités</li>
      </ul>
    </>
  ),
  image: '/screenshots/diagnostic.png',
  tips: 'Soyez honnête dans vos réponses, personne ne les jugera !'
}
```

#### Étape 3 : KPI (ADAPTATIF selon mode)
```javascript
// Mode 1 : Vendeur saisit
{
  icon: '📝',
  title: 'Saisissez vos KPI quotidiens',
  description: (
    <>
      <p>Chaque jour, enregistrez vos résultats :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>CA réalisé</li>
        <li>Nombre de ventes</li>
        <li>Panier moyen</li>
      </ul>
      <p className="mt-3">C'est essentiel pour recevoir du coaching IA personnalisé !</p>
    </>
  ),
  tips: 'Plus vous êtes régulier, meilleurs seront vos insights IA.'
}

// Mode 2 : Manager saisit
{
  icon: '👁️',
  title: 'Consultez vos KPI',
  description: (
    <>
      <p>Votre manager saisit vos résultats quotidiens.</p>
      <p>Vous pouvez les consulter ici à tout moment.</p>
      <p className="mt-3">Les données sont utilisées pour :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Vos analyses de performances</li>
        <li>Votre coaching IA personnalisé</li>
        <li>Votre classement dans l'équipe</li>
      </ul>
    </>
  )
}

// Mode 3 : API
{
  icon: '🔄',
  title: 'KPI Synchronisés',
  description: (
    <>
      <p>Vos données sont automatiquement synchronisées depuis votre système d'entreprise en temps réel.</p>
      <div className="inline-flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full mt-2">
        <span>🔄</span>
        <span className="text-sm font-medium">Sync API</span>
      </div>
      <p className="mt-3">Avantages :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Pas de saisie manuelle nécessaire</li>
        <li>Données toujours à jour</li>
        <li>Coaching IA basé sur vos vraies performances</li>
      </ul>
    </>
  )
}
```

#### Étape 4 : Performances
```javascript
{
  icon: '📊',
  title: 'Suivez vos performances',
  description: (
    <>
      <p>Consultez vos statistiques en temps réel :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Évolution de votre CA</li>
        <li>Taux de conversion</li>
        <li>Comparaison avec vos objectifs</li>
        <li>Classement dans l'équipe</li>
      </ul>
    </>
  ),
  tips: 'Utilisez les graphiques pour identifier vos points forts !'
}
```

#### Étape 5 : Coaching IA
```javascript
{
  icon: '🤖',
  title: 'Recevez du coaching IA',
  description: (
    <>
      <p>L'IA analyse vos performances et vous donne des conseils personnalisés :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Points forts à maintenir</li>
        <li>Axes d'amélioration</li>
        <li>Tactiques adaptées à votre profil</li>
        <li>Plan d'action concret</li>
      </ul>
    </>
  ),
  tips: 'Le coaching s\'améliore avec le temps, plus vous avez de données !'
}
```

#### Étape 6 : Challenges
```javascript
{
  icon: '🎖️',
  title: 'Participez aux challenges',
  description: (
    <>
      <p>Chaque jour, un nouveau challenge vous attend :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Objectifs quotidiens personnalisés</li>
        <li>Récompenses et badges</li>
        <li>Compétition amicale avec l'équipe</li>
      </ul>
    </>
  ),
  tips: 'Les challenges rendent le travail plus fun et motivant !'
}
```

#### Étape 7 : Finir
```javascript
{
  icon: '🎉',
  title: 'C\'est parti !',
  description: (
    <>
      <p>Vous êtes prêt à utiliser Retail Performer AI !</p>
      <p className="mt-3">N'oubliez pas :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Complétez votre diagnostic dès maintenant</li>
        <li>Saisissez vos KPI tous les jours</li>
        <li>Consultez vos conseils IA régulièrement</li>
      </ul>
      <p className="mt-3">Vous pouvez relancer ce tutoriel à tout moment via le bouton <strong>🎓 Tutoriel</strong>.</p>
    </>
  ),
  tips: 'Bon courage et excellentes ventes ! 💪'
}
```

### GÉRANT (5 étapes)

#### Étape 1 : Bienvenue
```javascript
{
  icon: '👋',
  title: 'Bienvenue dans votre espace Gérant',
  description: (
    <>
      <p>Vous êtes le pilote de votre entreprise.</p>
      <p>Ce tutoriel vous guide dans la gestion de votre structure.</p>
    </>
  )
}
```

#### Étape 2 : Créer un magasin
```javascript
{
  icon: '🏪',
  title: 'Créez vos magasins',
  description: (
    <>
      <p>Première étape : structurez votre entreprise en créant vos magasins.</p>
      <p className="mt-3">Pour chaque magasin :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Nom et adresse</li>
        <li>Configuration des KPI</li>
        <li>Attribution d'un manager</li>
      </ul>
    </>
  ),
  tips: 'Vous pourrez ajouter, modifier ou supprimer des magasins à tout moment.'
}
```

#### Étape 3 : Inviter du personnel
```javascript
{
  icon: '👥',
  title: 'Invitez votre équipe',
  description: (
    <>
      <p>Vous êtes le seul à pouvoir inviter du personnel :</p>
      <ul className="list-disc list-inside space-y-1">
        <li><strong>Managers</strong> : Géreront un magasin</li>
        <li><strong>Vendeurs</strong> : Travailleront dans un magasin</li>
      </ul>
      <p className="mt-3">Chaque invitation génère un lien unique envoyé par email.</p>
    </>
  ),
  tips: 'Assignez toujours les utilisateurs au bon magasin dès l\'invitation.'
}
```

#### Étape 4 : Statistiques globales
```javascript
{
  icon: '📊',
  title: 'Suivez vos performances',
  description: (
    <>
      <p>Consultez les statistiques de toute votre entreprise :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>CA global et par magasin</li>
        <li>Classement des magasins</li>
        <li>Évolution temporelle</li>
        <li>Comparaisons de performances</li>
      </ul>
    </>
  ),
  tips: 'Utilisez les filtres par période pour analyser les tendances.'
}
```

#### Étape 5 : Abonnement
```javascript
{
  icon: '💳',
  title: 'Gérez votre abonnement',
  description: (
    <>
      <p>Consultez et gérez votre formule d'abonnement :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Plan actuel et nombre de sièges</li>
        <li>Crédits IA restants</li>
        <li>Historique de facturation</li>
        <li>Upgrade/downgrade</li>
      </ul>
    </>
  ),
  tips: 'Les sièges s\'ajustent automatiquement selon votre équipe.'
}
```

### MANAGER (6 étapes)

#### Étape 1 : Bienvenue
```javascript
{
  icon: '👋',
  title: 'Bienvenue Manager',
  description: (
    <>
      <p>Vous gérez le magasin : <strong>[Nom du magasin]</strong>.</p>
      <p>Ce tutoriel vous guide dans la gestion de votre équipe.</p>
    </>
  )
}
```

#### Étape 2 : Diagnostic
```javascript
{
  icon: '🎯',
  title: 'Votre diagnostic manager',
  description: (
    <>
      <p>Complétez votre diagnostic de compétences managériales.</p>
      <p className="mt-3">Cela permet de :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Identifier votre style de management</li>
        <li>Personnaliser vos analyses IA</li>
        <li>Recevoir des conseils adaptés</li>
      </ul>
    </>
  )
}
```

#### Étape 3 : Votre équipe
```javascript
{
  icon: '👥',
  title: 'Découvrez votre équipe',
  description: (
    <>
      <p>Consultez la liste de vos vendeurs :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Performances individuelles</li>
        <li>Diagnostic de compétences</li>
        <li>Historique et statistiques</li>
      </ul>
    </>
  ),
  tips: 'Cliquez sur un vendeur pour voir ses détails complets.'
}
```

#### Étape 4 : KPI magasin (ADAPTATIF)
```javascript
// Si manager saisit
{
  icon: '📝',
  title: 'Saisissez les KPI',
  description: (
    <>
      <p>Vous êtes responsable de la saisie des KPI :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>KPI du magasin (global)</li>
        <li>KPI de chaque vendeur</li>
      </ul>
      <p className="mt-3">💡 Saisissez chaque jour pour des analyses IA précises !</p>
    </>
  )
}

// Si vendeur saisit
{
  icon: '📊',
  title: 'Consultez les KPI',
  description: (
    <>
      <p>Vos vendeurs saisissent leurs KPI quotidiens.</p>
      <p>Vous pouvez :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Consulter les performances</li>
        <li>Valider les saisies</li>
        <li>Identifier les tendances</li>
      </ul>
    </>
  )
}

// Si API
{
  icon: '🔄',
  title: 'KPI Synchronisés',
  description: (
    <>
      <p>Les données de votre équipe sont synchronisées automatiquement.</p>
      <p>Consultez-les en temps réel.</p>
    </>
  )
}
```

#### Étape 5 : Coaching IA d'équipe
```javascript
{
  icon: '🤖',
  title: 'Bilans IA de votre équipe',
  description: (
    <>
      <p>Demandez une analyse IA complète de votre équipe :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Points forts collectifs</li>
        <li>Axes d'amélioration</li>
        <li>Recommandations par vendeur</li>
        <li>Stratégies d'optimisation</li>
      </ul>
    </>
  ),
  tips: 'Les bilans IA sont plus précis avec des données régulières.'
}
```

#### Étape 6 : Configuration
```javascript
{
  icon: '⚙️',
  title: 'Configurez vos KPI',
  description: (
    <>
      <p>Personnalisez les KPI suivis pour votre magasin :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Choisir les métriques importantes</li>
        <li>Définir les objectifs</li>
        <li>Configurer les alertes</li>
      </ul>
    </>
  )
}
```

### IT ADMIN (4 étapes)

#### Étape 1 : Bienvenue
```javascript
{
  icon: '👋',
  title: 'Espace IT Admin',
  description: (
    <>
      <p>Vous gérez le compte enterprise de votre organisation.</p>
      <p>Ce tutoriel vous guide dans la gestion des intégrations API.</p>
    </>
  )
}
```

#### Étape 2 : Clés API
```javascript
{
  icon: '🔑',
  title: 'Générez vos clés API',
  description: (
    <>
      <p>Créez des clés API pour intégrer Retail Performer à vos systèmes :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Définir les permissions</li>
        <li>Configurer les rate limits</li>
        <li>Révoquer si nécessaire</li>
      </ul>
    </>
  ),
  tips: 'Conservez vos clés API en sécurité, ne les partagez jamais publiquement.'
}
```

#### Étape 3 : Documentation
```javascript
{
  icon: '📚',
  title: 'Documentation API',
  description: (
    <>
      <p>Consultez la documentation complète pour :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Importer des utilisateurs en masse</li>
        <li>Synchroniser les magasins</li>
        <li>Récupérer les données</li>
      </ul>
    </>
  )
}
```

#### Étape 4 : Synchronisation
```javascript
{
  icon: '🔄',
  title: 'Logs de synchronisation',
  description: (
    <>
      <p>Suivez l'état de vos synchronisations :</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Statut en temps réel</li>
        <li>Historique des syncs</li>
        <li>Erreurs et résolutions</li>
      </ul>
    </>
  )
}
```

---

## 🔧 BACKEND (Optionnel)

### Endpoints pour persistance

#### GET `/api/user/onboarding-progress`
Récupère l'état d'avancement de l'onboarding.

**Response** :
```javascript
{
  completed: false,
  current_step: 3,
  skipped_steps: [1, 5],
  last_seen: "2024-12-02T10:30:00Z"
}
```

#### POST `/api/user/onboarding-progress`
Sauvegarde l'état d'avancement.

**Body** :
```javascript
{
  current_step: 4,
  completed: false
}
```

### Modification collection `users`

```javascript
{
  id: "user-123",
  // ... autres champs
  onboarding_completed: boolean,
  onboarding_current_step: number,
  onboarding_skipped_steps: [number],
  onboarding_last_seen: datetime
}
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Composants UI de base
- [ ] Créer `/app/frontend/src/components/onboarding/`
- [ ] `TutorialButton.js` - Bouton permanent
- [ ] `OnboardingModal.js` - Modal principal
- [ ] `ProgressBar.js` - Barre de progression cliquable
- [ ] `OnboardingStep.js` - Contenu d'une étape

### Phase 2 : Logic & State
- [ ] Hook `useOnboarding.js` avec toutes les actions
- [ ] Tester navigation (next, prev, goTo, skip)
- [ ] Gestion état (isOpen, currentStep, completedSteps)

### Phase 3 : Contenu adaptatif
- [ ] Détecter le mode KPI (useSyncMode + kpi-enabled)
- [ ] Contenu conditionnel pour étape 3 (vendeur)
- [ ] Contenu conditionnel pour étape 4 (manager)

### Phase 4 : Intégration
- [ ] Ajouter bouton dans `SellerDashboard.js`
- [ ] Ajouter bouton dans `ManagerDashboard.js`
- [ ] Ajouter bouton dans `GerantDashboard.js`
- [ ] Ajouter bouton dans `ITAdminDashboard.js`

### Phase 5 : Backend (optionnel)
- [ ] Endpoint GET `/api/user/onboarding-progress`
- [ ] Endpoint POST `/api/user/onboarding-progress`
- [ ] Modifier schéma `users` avec champs onboarding

### Phase 6 : Tests
- [ ] Test navigation libre (skip, prev, next)
- [ ] Test progression cliquable
- [ ] Test fermeture et réouverture
- [ ] Test contenu adaptatif (3 modes KPI)
- [ ] Test sur chaque dashboard
- [ ] Test responsive (mobile)

---

## 📱 RESPONSIVE

**Mobile** :
- Modal prend 95% de la largeur
- Texte "Tutoriel" caché, seulement icône 🎓
- Boutons empilés verticalement si nécessaire

**Tablet** :
- Modal 80% de largeur
- Tout visible

**Desktop** :
- Modal taille fixe (max-w-2xl)
- Layout optimal

---

**Document créé par**: Agent E1  
**Dernière mise à jour**: 2024-12-02  
**Version**: 1.0  
**Status**: ✅ Specs complètes et validées
