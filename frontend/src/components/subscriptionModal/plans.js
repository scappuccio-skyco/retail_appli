// ⚠️ SECURITY: No hardcoded prices - Stripe handles all pricing via tiered pricing
export const PLANS = {
  starter: {
    name: 'Small Team',
    minSellers: 1,
    maxSellers: 5,
    subtitle: 'Petites boutiques',
    color: '#10B981', // Green
    colorHover: '#059669',
    mainFeatures: [
      'Dashboard Gérant, Manager & Vendeur',
      'Diagnostic Profil Manager',
      'Diagnostic Profil Vendeur',
      'Coaching IA & Briefs Matinaux',
      'Préparation des Évaluations',
      'Suivi KPI, Objectifs & Challenges',
      'Connexion API (Tous logiciels)'
    ],
    specs: [
      '1 à 5 vendeurs',
      'Analyses IA illimitées',
      'Support email sous 48h'
    ]
  },
  professional: {
    name: 'Medium Team',
    minSellers: 6,
    maxSellers: 15,
    subtitle: 'Magasins moyens',
    color: '#F97316', // Orange
    colorHover: '#EA580C',
    mainFeatures: [
      'Dashboard Gérant, Manager & Vendeur',
      'Diagnostic Profil Manager',
      'Diagnostic Profil Vendeur',
      'Coaching IA & Briefs Matinaux',
      'Préparation des Évaluations',
      'Suivi KPI, Objectifs & Challenges',
      'Connexion API (Tous logiciels)'
    ],
    specs: [
      '6 à 15 vendeurs',
      'Analyses IA illimitées',
      'Support email sous 48h'
    ]
  },
  enterprise: {
    name: 'Large Team',
    minSellers: 16,
    maxSellers: null,
    subtitle: 'Pour réseaux & enseignes',
    isEnterprise: true,
    color: '#7C3AED', // Purple
    colorHover: '#6D28D9',
    mainFeatures: [
      'Dashboard Gérant, Manager & Vendeur',
      'Diagnostic Profil Manager',
      'Diagnostic Profil Vendeur',
      'Coaching IA & Briefs Matinaux',
      'Préparation des Évaluations',
      'Suivi KPI, Objectifs & Challenges',
      'Connexion API (Tous logiciels)'
    ],
    specs: [
      '16+ vendeurs',
      'Analyses IA illimitées',
      'Support prioritaire dédié'
    ]
  }
};
