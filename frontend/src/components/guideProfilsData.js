// Static data for GuideProfilsModal — extracted to avoid recreation on every render
import {
  LABEL_DECOUVERTE,
  LABEL_DECOUVERTE_APPROFONDIE,
  LABEL_LE_COACH,
  LABEL_LE_STRATEGE,
  LABEL_MANAGER_STRATEGE_X_VENDEUR_CHALLENGER,
  LABEL_MANAGER_STRATEGE_X_VENDEUR_CONVIVIAL,
  LABEL_MANAGER_STRATEGE_X_VENDEUR_DYNAMIQUE,
  LABEL_MANAGER_STRATEGE_X_VENDEUR_TECHNIQUE,
} from '../lib/constants';

export const stylesVente = [
  {
    name: 'Le Convivial',
    icon: '🤝',
    color: 'blue',
    description: 'Crée naturellement du lien avec les clients',
    caracteristiques: [
      'Excellente écoute et empathie naturelle',
      'Privilégie la relation à la transaction',
      'Crée une atmosphère chaleureuse',
      'Client se sent compris et écouté'
    ],
    forces: [
      'Fidélisation client exceptionnelle',
      'Bouche-à-oreille positif',
      'Ambiance magasin accueillante'
    ],
    attention: [
      'Peut manquer d\'assertivité au closing',
      'Risque de trop se disperser en discussions',
      'Besoin de structurer le process de vente'
    ]
  },
  {
    name: 'L\'Explorateur',
    icon: '🔍',
    color: 'green',
    description: 'Curieux et en apprentissage constant',
    caracteristiques: [
      'Pose beaucoup de questions',
      'Apprend vite et s\'adapte',
      'Teste différentes approches',
      'Curieux des nouveaux produits'
    ],
    forces: [
      'Grande capacité d\'apprentissage',
      LABEL_DECOUVERTE_APPROFONDIE,
      'S\'améliore rapidement'
    ],
    attention: [
      'Peut manquer de confiance au début',
      'Besoin de temps pour se structurer',
      'Parfois trop de questions tuent la vente'
    ]
  },
  {
    name: 'Le Dynamique',
    icon: '⚡',
    color: 'red',
    description: 'Énergie et efficacité avant tout',
    caracteristiques: [
      'Rythme soutenu et énergique',
      'Va droit au but',
      'Closing rapide et efficace',
      'Gestion optimale du temps'
    ],
    forces: [
      'Volume de ventes élevé',
      'Énergise toute l\'équipe',
      'Excellente gestion du flux'
    ],
    attention: [
      'Peut brusquer certains clients',
      'Risque de négliger la relation',
      'Parfois trop direct'
    ]
  },
  {
    name: 'Le Discret',
    icon: '🎧',
    color: 'gray',
    description: 'Observe et s\'adapte en finesse',
    caracteristiques: [
      'Écoute active et profonde',
      'S\'adapte au rythme du client',
      'Approche douce et rassurante',
      'Jamais intrusif'
    ],
    forces: [
      'Excellente adaptation au client',
      'Clients sensibles à l\'approche douce',
      'Fidélisation silencieuse mais efficace'
    ],
    attention: [
      'Peut manquer de proactivité',
      'Besoin de se faire plus visible',
      'Parfois trop en retrait'
    ]
  },
  {
    name: 'Le Stratège',
    icon: '🎯',
    color: 'purple',
    description: 'Analyse et planifie chaque vente',
    caracteristiques: [
      'Approche méthodique',
      'Prépare ses argumentaires',
      'Maîtrise parfaitement les produits',
      'Analyse les besoins en profondeur'
    ],
    forces: [
      'Ventes complexes réussies',
      'Argumentation solide',
      'Gestion des objections maîtrisée'
    ],
    attention: [
      'Peut être trop analytique',
      'Risque de sur-préparer',
      'Parfois trop technique pour le client'
    ]
  }
];

export const niveaux = [
  {
    name: 'Nouveau Talent',
    icon: '⚡',
    color: 'green',
    niveau: 1,
    description: 'Découvre le terrain, teste, apprend les bases',
    caracteristiques: [
      'Curieux et volontaire',
      'En phase d\'apprentissage',
      'Teste différentes approches',
      'Construit sa confiance'
    ],
    forces: [
      'Grande capacité d\'apprentissage',
      'Fraîcheur et enthousiasme',
      'Ouverture d\'esprit totale',
      'Aucune mauvaise habitude'
    ],
    objectifs: [
      'Maîtriser les bases de la vente',
      'Gagner en confiance',
      'Structurer son approche',
      'Développer son aisance client'
    ]
  },
  {
    name: 'Challenger',
    icon: '🟡',
    color: 'yellow',
    niveau: 2,
    description: 'A pris ses repères, cherche à performer',
    caracteristiques: [
      'Maîtrise les fondamentaux',
      'Vise la performance',
      'Teste de nouvelles approches',
      'Confiance établie'
    ],
    forces: [
      'Bases solides acquises',
      'Motivation à progresser',
      'Autonomie croissante',
      'Résultats en amélioration'
    ],
    objectifs: [
      'Améliorer ses résultats',
      'Développer son style propre',
      'Gérer les ventes complexes',
      'Viser l\'excellence'
    ]
  },
  {
    name: 'Ambassadeur',
    icon: '🟠',
    color: 'orange',
    niveau: 3,
    description: 'Inspire confiance, maîtrise les étapes',
    caracteristiques: [
      'Expert reconnu',
      'Partage ses pratiques',
      'Modèle pour l\'équipe',
      'Maîtrise complète'
    ],
    forces: [
      'Expertise reconnue',
      'Résultats constants',
      'Capacité à former',
      'Leadership naturel'
    ],
    objectifs: [
      'Transmettre son expertise',
      'Coacher les nouveaux',
      'Maintenir l\'excellence',
      'Innover dans les pratiques'
    ]
  },
  {
    name: 'Maître du Jeu',
    icon: '🔴',
    color: 'red',
    niveau: 4,
    description: 'Expert absolu, adapte et entraîne les autres',
    caracteristiques: [
      'Virtuose de la vente',
      'Adapte son style à chaque client',
      'Leader naturel',
      'Forme et inspire'
    ],
    forces: [
      'Maîtrise totale',
      'Adaptabilité extrême',
      'Vision stratégique',
      'Mentor d\'excellence'
    ],
    objectifs: [
      'Excellence constante',
      'Former les futurs experts',
      'Innover en permanence',
      'Être la référence'
    ]
  }
];

export const motivations = [
  {
    name: 'Relation',
    icon: '❤️',
    color: 'pink',
    description: 'Motivé par le lien humain et les interactions',
    caracteristiques: [
      'Aime créer des connexions authentiques',
      'Se nourrit des échanges',
      'Valorise la confiance mutuelle',
      'Client = personne avant tout'
    ],
    moteurs: [
      'Retour des clients fidèles',
      'Feedback positifs',
      'Ambiance d\'équipe chaleureuse',
      'Relations durables'
    ],
    conseils: [
      'Valoriser les témoignages clients',
      'Célébrer les fidélisations',
      'Encourager le travail en équipe',
      'Créer des moments d\'échange'
    ]
  },
  {
    name: 'Reconnaissance',
    icon: '🏆',
    color: 'yellow',
    description: 'Motivé par la valorisation et les félicitations',
    caracteristiques: [
      'Besoin d\'être reconnu',
      'Aime être mis en avant',
      'Sensible aux compliments',
      'Valorisation = carburant'
    ],
    moteurs: [
      'Félicitations publiques',
      'Prix et récompenses',
      'Être cité en exemple',
      'Reconnaissance du manager'
    ],
    conseils: [
      'Feedback réguliers et positifs',
      'Mettre en avant les succès',
      'Créer des challenges avec prix',
      'Valoriser devant l\'équipe'
    ]
  },
  {
    name: 'Performance',
    icon: '📊',
    color: 'blue',
    description: 'Motivé par les résultats et les défis',
    caracteristiques: [
      'Orienté objectifs',
      'Aime les challenges',
      'Mesure sa progression',
      'Compétitif et ambitieux'
    ],
    moteurs: [
      'Atteindre ou dépasser les objectifs',
      'Battre ses records',
      'Challenges relevés',
      'Progression visible'
    ],
    conseils: [
      'Fixer des objectifs clairs',
      'Créer des challenges stimulants',
      'Dashboard de performance visible',
      'Célébrer les records'
    ]
  },
  {
    name: LABEL_DECOUVERTE,
    icon: '🚀',
    color: 'purple',
    description: 'Motivé par l\'apprentissage et la nouveauté',
    caracteristiques: [
      'Curieux de tout',
      'Aime apprendre',
      'Teste de nouvelles approches',
      'Innovation = excitation'
    ],
    moteurs: [
      'Nouveaux produits à découvrir',
      'Formations et apprentissages',
      'Tester de nouvelles techniques',
      'Évolution et changement'
    ],
    conseils: [
      'Proposer des formations régulières',
      'Confier les nouveaux produits',
      'Encourager l\'expérimentation',
      'Partager les innovations'
    ]
  }
];

export const discProfiles = [
  {
    letter: 'D',
    name: 'Dominant',
    icon: '🔴',
    color: 'red',
    description: 'Direct, décisif et orienté résultats',
    caracteristiques: [
      'Aime le contrôle et les défis',
      'Va droit au but',
      'Décisions rapides',
      'Orienté action et résultats'
    ],
    communication: [
      'Sois direct et concis',
      'Focus sur les résultats',
      'Propose des défis',
      'Laisse de l\'autonomie'
    ],
    attention: [
      'Peut être trop direct',
      'Risque d\'impatience',
      'Peut négliger les émotions',
      'Besoin de contrôler'
    ]
  },
  {
    letter: 'I',
    name: 'Influent',
    icon: '🟡',
    color: 'yellow',
    description: 'Enthousiaste, sociable et expressif',
    caracteristiques: [
      'Aime interagir et convaincre',
      'Enthousiaste et optimiste',
      'Communication expressive',
      'Orienté relations'
    ],
    communication: [
      'Sois chaleureux et positif',
      'Laisse de l\'espace pour parler',
      'Valorise et encourage',
      'Crée une ambiance fun'
    ],
    attention: [
      'Peut manquer de rigueur',
      'Risque de dispersion',
      'Peut négliger les détails',
      'Besoin de reconnaissance'
    ]
  },
  {
    letter: 'S',
    name: 'Stable',
    icon: '🟢',
    color: 'green',
    description: 'Patient, loyal et coopératif',
    caracteristiques: [
      'Aime la stabilité et la routine',
      'Patient et à l\'écoute',
      'Travail d\'équipe naturel',
      'Évite les conflits'
    ],
    communication: [
      'Sois patient et rassurant',
      'Explique les changements',
      'Valorise la contribution',
      'Crée un cadre sécurisant'
    ],
    attention: [
      'Résistance aux changements',
      'Peut manquer d\'assertivité',
      'Évite trop les conflits',
      'Besoin de temps pour s\'adapter'
    ]
  },
  {
    letter: 'C',
    name: 'Consciencieux',
    icon: '🔵',
    color: 'blue',
    description: 'Précis, analytique et méthodique',
    caracteristiques: [
      'Aime la précision et la qualité',
      'Analytique et réfléchi',
      'Suit les procédures',
      'Orienté détails'
    ],
    communication: [
      'Sois précis et structuré',
      'Fournis des données',
      'Respecte les procédures',
      'Laisse du temps pour réfléchir'
    ],
    attention: [
      'Peut être trop perfectionniste',
      'Risque de sur-analyser',
      'Peut manquer de spontanéité',
      'Besoin de temps pour décider'
    ]
  }
];

export const managementStyles = [
  {
    name: 'Le Pilote',
    icon: '🎯',
    color: 'blue',
    description: 'Structuré, orienté résultats et action concrète',
    caracteristiques: [
      'Ce manager conduit l\'équipe vers des objectifs clairs',
      'Il formalise, structure et met en place des process',
      'Communication directe et orientée résultats',
      'Prend les décisions rapidement et assume'
    ],
    forces: [
      'Capacité à fixer et atteindre les objectifs',
      'Organisation et structuration de l\'équipe',
      'Clarté dans les attentes et la direction',
      'Performance mesurable et constante'
    ],
    attention: [
      'Peut être perçu comme trop directif',
      'Risque de négliger l\'aspect humain',
      'Parfois inflexible sur les méthodes',
      'Besoin d\'apprendre à déléguer'
    ]
  },
  {
    name: LABEL_LE_COACH,
    icon: '🏋️',
    color: 'green',
    description: 'Développe et accompagne son équipe vers l\'excellence',
    caracteristiques: [
      'Accompagne individuellement chaque vendeur',
      'Identifie les forces et axes de progrès',
      'Crée un environnement d\'apprentissage',
      'Feedback constructifs et réguliers'
    ],
    forces: [
      'Développement des compétences de l\'équipe',
      'Montée en autonomie des vendeurs',
      'Culture de l\'amélioration continue',
      'Engagement et motivation élevés'
    ],
    attention: [
      'Peut manquer de recul sur le court terme',
      'Risque de surinvestissement émotionnel',
      'Besoin de trouver l\'équilibre coaching/résultats',
      'Parfois trop patient avec les non-performants'
    ]
  },
  {
    name: LABEL_LE_STRATEGE,
    icon: '🧠',
    color: 'purple',
    description: 'Vision claire et organisation millimétrée',
    caracteristiques: [
      'Définit des objectifs clairs et mesurables',
      'Organise les ressources et planifie',
      'Anticipe les besoins et opportunités',
      'Prend du recul pour optimiser'
    ],
    forces: [
      'Performance équipe prévisible et stable',
      'Optimisation des ressources',
      'Anticipation des problèmes',
      'Décisions basées sur les données'
    ],
    attention: [
      'Peut être trop rigide dans l\'exécution',
      'Risque de sous-estimer l\'humain',
      'Peut manquer de spontanéité',
      'Parfois déconnecté du terrain'
    ]
  },
  {
    name: 'Le Dynamiseur',
    icon: '⚡',
    color: 'yellow',
    description: 'Énergise et mobilise par l\'exemple et la vision',
    caracteristiques: [
      'Inspire par sa passion et son énergie',
      'Donne du sens aux actions',
      'Crée une dynamique d\'équipe forte',
      'Montre l\'exemple sur le terrain'
    ],
    forces: [
      'Équipe motivée et engagée',
      'Culture de l\'excellence',
      'Ambiance positive et stimulante',
      'Capacité à relever les défis'
    ],
    attention: [
      'Peut créer une dépendance à sa présence',
      'Risque d\'épuisement (sien et équipe)',
      'Parfois trop exigeant',
      'Difficulté à déléguer'
    ]
  },
  {
    name: 'Le Facilitateur',
    icon: '🤝',
    color: 'green',
    description: 'Crée les conditions de réussite et facilite les échanges',
    caracteristiques: [
      'Écoute et prend en compte les besoins',
      'Facilite la collaboration',
      'Résout les blocages et conflits',
      'Crée un environnement bienveillant'
    ],
    forces: [
      'Cohésion d\'équipe exceptionnelle',
      'Climat de confiance',
      'Communication fluide',
      'Bien-être au travail'
    ],
    attention: [
      'Peut manquer d\'autorité dans les moments critiques',
      'Risque d\'éviter les conflits nécessaires',
      'Parfois trop consensuel',
      'Difficulté à prendre des décisions impopulaires'
    ]
  },
  {
    name: 'Le Tacticien',
    icon: '⚙️',
    color: 'orange',
    description: 'Expert de l\'opérationnel et de l\'exécution',
    caracteristiques: [
      'Maîtrise les process et outils',
      'Optimise l\'opérationnel au quotidien',
      'Réactif et pragmatique',
      'Focalisé sur les résultats immédiats'
    ],
    forces: [
      'Efficacité opérationnelle maximale',
      'Résolution rapide des problèmes',
      'Maîtrise des indicateurs',
      'Performance court terme'
    ],
    attention: [
      'Peut manquer de vision long terme',
      'Risque de micro-management',
      'Parfois trop focus sur les process',
      'Difficulté à prendre du recul'
    ]
  },
  {
    name: 'Le Mentor',
    icon: '🎓',
    color: 'red',
    description: 'Transmet son expertise et forme les talents',
    caracteristiques: [
      'Partage son expérience et ses savoirs',
      'Forme individuellement',
      'Patience et pédagogie',
      'Valorise la montée en compétence'
    ],
    forces: [
      'Développement durable des talents',
      'Transmission de l\'expertise',
      'Culture d\'apprentissage',
      'Équipe autonome à terme'
    ],
    attention: [
      'Peut être trop patient',
      'Risque de favoriser certains profils',
      'Parfois moins focus sur les résultats',
      'Difficulté à sanctionner'
    ]
  }
];

export const compatibilityGuide = [
  {
    name: 'Manager Pilote × Vendeur Dynamique',
    icon: '🎯⚡',
    color: 'blue',
    description: 'Alliance orientée performance et résultats',
    caracteristiques: [
      'Communication directe et efficace',
      'Focus commun sur les objectifs',
      'Rythme soutenu et dynamique',
      'Peu de friction dans l\'exécution'
    ],
    forces: [
      'Atteinte rapide des objectifs',
      'Efficacité maximale',
      'Alignement naturel sur les résultats',
      'Décisions rapides'
    ],
    attention: [
      'Risque de négliger l\'humain',
      'Peut manquer de recul',
      'Besoin de célébrer les réussites',
      'Attention au surmenage'
    ]
  },
  {
    name: 'Manager Coach × Vendeur Explorateur',
    icon: '🏋️🔍',
    color: 'green',
    description: 'Duo idéal pour le développement',
    caracteristiques: [
      'Apprentissage continu favorisé',
      'Feedback réguliers et constructifs',
      'Curiosité encouragée',
      'Progression rapide'
    ],
    forces: [
      'Développement optimal des compétences',
      'Montée en autonomie rapide',
      'Motivation et engagement élevés',
      'Culture d\'excellence'
    ],
    attention: [
      'Risque de surinvestissement',
      'Peut manquer de pression résultats',
      'Besoin de fixer des deadlines',
      'Attention à la sur-analyse'
    ]
  },
  {
    name: LABEL_MANAGER_STRATEGE_X_VENDEUR_CONVIVIAL,
    icon: '🧠🤝',
    color: 'purple',
    description: 'Complémentarité organisation-relation',
    caracteristiques: [
      'Structure apportée par le manager',
      'Humanité apportée par le vendeur',
      'Équilibre process et relation',
      'Vision stratégique avec exécution chaleureuse'
    ],
    forces: [
      'Performance avec fidélisation',
      'Process respectés avec flexibilité',
      'Clients satisfaits et objectifs atteints',
      'Équilibre durable'
    ],
    attention: [
      'Communication à adapter (direct vs relationnel)',
      'Rythmes différents à synchroniser',
      'Besoin de compromis',
      'Patience requise des deux côtés'
    ]
  },
  {
    name: 'Manager Dynamiseur × Tous profils',
    icon: '⚡✨',
    color: 'yellow',
    description: 'Catalyseur universel de performance',
    caracteristiques: [
      'Inspire et motive tous les profils',
      'Donne du sens aux actions',
      'Crée une dynamique positive',
      'Adaptable à chaque personnalité'
    ],
    forces: [
      'Engagement équipe maximal',
      'Culture de dépassement',
      'Cohésion forte',
      'Résultats exceptionnels'
    ],
    attention: [
      'Peut créer de la dépendance',
      'Besoin de varier les styles',
      'Attention à l\'épuisement',
      'Délégation nécessaire'
    ]
  },
  {
    name: 'Manager Facilitateur × Vendeur Convivial',
    icon: '🤝❤️',
    color: 'pink',
    description: 'Duo relationnel fort',
    caracteristiques: [
      'Ambiance exceptionnelle',
      'Communication fluide',
      'Confiance mutuelle',
      'Bien-être prioritaire'
    ],
    forces: [
      'Fidélisation client maximale',
      'Turnover minimal',
      'Satisfaction équipe élevée',
      'Climat de travail idéal'
    ],
    attention: [
      'Peut manquer d\'assertivité',
      'Risque d\'éviter les conflits',
      'Besoin de focus résultats',
      'Attention aux décisions difficiles'
    ]
  },
  {
    name: 'Points clés de compatibilité',
    icon: '🔑',
    color: 'orange',
    description: 'Les fondamentaux d\'une bonne relation Manager-Vendeur',
    caracteristiques: [
      'Communication adaptée au profil',
      'Reconnaissance des forces de chacun',
      'Patience et écoute mutuelle',
      'Objectifs clairs et partagés'
    ],
    forces: [
      'Utiliser les différences comme forces',
      'S\'adapter plutôt que d\'imposer',
      'Feedback réguliers et ajustés',
      'Célébrer les réussites ensemble'
    ],
    attention: [
      'Éviter les jugements hâtifs',
      'Ne pas chercher à changer l\'autre',
      'Respecter les rythmes différents',
      'Communiquer sur les attentes'
    ]
  }
];

export const getCompatibilityResult = (managementType, sellingStyle) => {
  if (!managementType || !sellingStyle) return null;

  // Matrice de compatibilité
  const compatibilityMatrix = {
    'Pilote': {
      'Convivial': {
        score: '⭐⭐⭐',
        title: 'Manager Pilote × Vendeur Convivial',
        description: 'Complémentarité structure-relation',
        caracteristiques: [
          'Le manager apporte structure et objectifs clairs',
          'Le vendeur apporte chaleur et relation client',
          'Équilibre entre performance et fidélisation',
          'Communication à adapter'
        ],
        forces: [
          'Résultats mesurables avec clients satisfaits',
          'Process respectés avec flexibilité relationnelle',
          'Équilibre durable'
        ],
        attention: [
          'Rythmes différents (direct vs relationnel)',
          'Le manager doit valoriser l\'aspect humain',
          'Le vendeur doit accepter les objectifs chiffrés'
        ],
        recommandations: {
          manager: [
            'Valorisez la qualité relationnelle et la fidélisation client',
            'Donnez du temps pour construire les relations',
            'Expliquez le "pourquoi" derrière les objectifs',
            'Reconnaissez les soft skills autant que les chiffres'
          ],
          vendeur: [
            'Utilisez votre relationnel pour atteindre les objectifs',
            'Montrez l\'impact business de vos relations clients',
            'Acceptez la structure comme un cadre libérateur',
            'Proposez des KPIs relationnels (satisfaction, fidélité)'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Pilote × Vendeur Dynamique',
        description: 'Alliance parfaite orientée performance',
        caracteristiques: [
          'Communication directe et efficace',
          'Focus commun sur les objectifs',
          'Rythme soutenu et dynamique',
          'Peu de friction dans l\'exécution'
        ],
        forces: [
          'Atteinte rapide des objectifs',
          'Efficacité maximale',
          'Alignement naturel sur les résultats'
        ],
        attention: [
          'Risque de négliger l\'aspect humain',
          'Besoin de célébrer les réussites',
          'Attention au surmenage'
        ],
        recommandations: {
          manager: [
            'Prenez le temps de célébrer les victoires ensemble',
            'Intégrez des moments informels pour renforcer la relation',
            'Veillez au bien-être et à l\'équilibre vie pro/perso',
            'Variez les challenges pour maintenir la motivation'
          ],
          vendeur: [
            'N\'hésitez pas à demander des pauses si besoin',
            'Partagez vos idées d\'amélioration de process',
            'Profitez de l\'alignement pour viser l\'excellence',
            'Gardez un œil sur la satisfaction client'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐',
        title: 'Manager Pilote × Vendeur Explorateur',
        description: 'Complémentarité action-réflexion',
        caracteristiques: [
          'Le manager donne le cap et la structure',
          'Le vendeur apporte créativité et curiosité',
          'Besoin de compromis sur le tempo',
          'Communication régulière nécessaire'
        ],
        forces: [
          'Innovation cadrée et structurée',
          'Solutions créatives aux problèmes',
          'Développement mutuel'
        ],
        attention: [
          'Patience requise des deux côtés',
          'Le vendeur peut se sentir bridé',
          'Le manager doit laisser de l\'espace'
        ],
        recommandations: {
          manager: [
            'Laissez de l\'espace à la créativité dans le cadre des objectifs',
            'Définissez des objectifs clairs mais ouverts sur les méthodes',
            'Valorisez les idées nouvelles comme levier commercial',
            'Transformez la curiosité en atout pour l\'équipe'
          ],
          vendeur: [
            'Proposez des solutions innovantes en respectant le cadre fixé',
            'Montrez le retour sur investissement de vos idées',
            'Respectez le rythme d\'action du manager',
            'Utilisez votre créativité pour atteindre les objectifs chiffrés'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Pilote × Vendeur Technique',
        description: 'Duo d\'experts orienté résultats',
        caracteristiques: [
          'Excellence technique et méthodologie',
          'Respect mutuel des compétences',
          'Process et expertise valorisés',
          'Communication factuelle'
        ],
        forces: [
          'Performance technique exceptionnelle',
          'Crédibilité client maximale',
          'Fiabilité et rigueur'
        ],
        attention: [
          'Risque de sur-technicité',
          'Aspect humain à ne pas négliger',
          'Besoin de souplesse parfois'
        ],
        recommandations: {
          manager: [
            'Valorisez l\'expertise technique comme levier commercial',
            'Donnez de l\'autonomie sur les méthodes',
            'Encouragez le partage de connaissances en équipe',
            'Équilibrez excellence technique et relationnel client'
          ],
          vendeur: [
            'Traduisez votre expertise en bénéfices clients',
            'Utilisez la structure pour renforcer votre crédibilité',
            'Partagez vos connaissances avec l\'équipe',
            'Développez aussi vos soft skills'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Pilote × Vendeur Challenger',
        description: 'Émulation et dépassement',
        caracteristiques: [
          'Objectifs ambitieux fixés',
          'Culture du dépassement',
          'Compétition saine',
          'Respect mutuel de la performance'
        ],
        forces: [
          'Résultats exceptionnels',
          'Motivation par les défis',
          'Progression continue'
        ],
        attention: [
          'Besoin d\'équilibrer pression et bien-être',
          'Célébrer les succès ensemble',
          'Éviter la surcompétition'
        ],
        recommandations: {
          manager: [
            'Donnez des défis ambitieux et mesurables régulièrement',
            'Reconnaissez les performances publiquement',
            'Évitez le micro-management : faites confiance aux résultats',
            'Célébrez les victoires ensemble pour souder l\'équipe'
          ],
          vendeur: [
            'Canalisez votre énergie compétitive dans le cadre défini',
            'Montrez vos résultats avec des chiffres précis',
            'Acceptez le feedback constructif comme tremplin',
            'Proposez vos propres challenges pour rester motivé'
          ]
        }
      }
    },
    'Coach': {
      'Convivial': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Coach × Vendeur Convivial',
        description: 'Alliance développement et relation',
        caracteristiques: [
          'Accompagnement personnalisé',
          'Développement des soft skills',
          'Culture de bienveillance',
          'Écoute mutuelle'
        ],
        forces: [
          'Fidélisation client maximale',
          'Bien-être au travail',
          'Progression douce et durable'
        ],
        attention: [
          'Focus résultats à maintenir',
          'Besoin d\'assertivité parfois',
          'Fixer des limites claires'
        ],
        recommandations: {
          manager: [
            'Valorisez les succès relationnels autant que les chiffres',
            'Fixez des objectifs progressifs avec des étapes de célébration',
            'Encouragez l\'assertivité douce dans les situations commerciales',
            'Créez des espaces de feedback positif et constructif'
          ],
          vendeur: [
            'Utilisez votre talent relationnel comme moteur commercial',
            'Acceptez les objectifs chiffrés comme un défi bienveillant',
            'Partagez vos succès clients avec l\'équipe',
            'Développez votre confiance en vous pour affirmer votre valeur'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐',
        title: 'Manager Coach × Vendeur Dynamique',
        description: 'Rythmes différents à synchroniser',
        caracteristiques: [
          'Le manager prend le temps du développement',
          'Le vendeur veut de l\'action rapide',
          'Besoin de trouver un équilibre',
          'Patience mutuelle requise'
        ],
        forces: [
          'Performance avec développement',
          'Le vendeur apprend à se poser',
          'Résultats durables'
        ],
        attention: [
          'Le vendeur peut s\'impatienter',
          'Le manager doit accepter le tempo',
          'Communication sur les attentes'
        ],
        recommandations: {
          manager: [
            'Adaptez le rythme du coaching à l\'énergie naturelle du vendeur',
            'Donnez du feedback rapide et direct après chaque action',
            'Valorisez l\'action tout en développant la réflexion stratégique',
            'Fixez des micro-objectifs motivants à court terme'
          ],
          vendeur: [
            'Prenez le temps du feedback même quand vous voulez foncer',
            'Utilisez votre dynamisme pour progresser plus vite que prévu',
            'Acceptez les moments de réflexion comme investissement',
            'Montrez votre progression de façon régulière et concrète'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Coach × Vendeur Explorateur',
        description: 'Duo idéal pour le développement',
        caracteristiques: [
          'Apprentissage continu favorisé',
          'Feedback réguliers et constructifs',
          'Curiosité encouragée',
          'Progression rapide'
        ],
        forces: [
          'Développement optimal des compétences',
          'Montée en autonomie rapide',
          'Motivation et engagement élevés'
        ],
        attention: [
          'Risque de surinvestissement',
          'Peut manquer de pression résultats',
          'Attention à la sur-analyse'
        ],
        recommandations: {
          manager: [
            'Encouragez activement la curiosité et récompensez les découvertes',
            'Proposez des projets d\'apprentissage stimulants et variés',
            'Valorisez chaque nouvelle compétence acquise',
            'Créez un parcours de développement sur-mesure et évolutif'
          ],
          vendeur: [
            'Partagez vos apprentissages avec l\'équipe pour créer de la valeur',
            'Proposez des innovations testables avec un plan de mesure',
            'Montrez l\'impact concret de votre curiosité sur les ventes',
            'Fixez-vous des objectifs d\'exploration reliés aux résultats'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Coach × Vendeur Technique',
        description: 'Expertise + Développement',
        caracteristiques: [
          'Valorisation de l\'expertise',
          'Développement continu des compétences',
          'Accompagnement technique',
          'Culture d\'excellence'
        ],
        forces: [
          'Expert en devenir',
          'Transmission de savoirs',
          'Excellence technique'
        ],
        attention: [
          'Ne pas oublier l\'humain',
          'Équilibrer technique et relationnel',
          'Focus résultats'
        ],
        recommandations: {
          manager: [
            'Valorisez l\'expertise comme levier de développement personnel',
            'Proposez des formations avancées et des challenges techniques',
            'Encouragez le partage de savoir en équipe',
            'Connectez systématiquement la technique aux bénéfices business'
          ],
          vendeur: [
            'Partagez votre expertise avec l\'équipe pour renforcer votre leadership',
            'Développez vos compétences commerciales et relationnelles',
            'Acceptez le coaching comme un enrichissement mutuel',
            'Montrez votre expertise en rendez-vous clients pour créer de la valeur'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐⭐',
        title: 'Manager Coach × Vendeur Challenger',
        description: 'Développement vs Performance',
        caracteristiques: [
          'Le manager veut développer',
          'Le vendeur veut performer',
          'Besoin de compromis',
          'Coaching orienté résultats'
        ],
        forces: [
          'Développement de champion',
          'Performance durable',
          'Équilibre bien-être et résultats'
        ],
        attention: [
          'Le vendeur peut trouver le coaching lent',
          'Le manager doit s\'adapter',
          'Célébrer les victoires'
        ],
        recommandations: {
          manager: [
            'Transformez l\'ambition en développement structuré étape par étape',
            'Fixez des objectifs de progression clairs et mesurables',
            'Valorisez le chemin parcouru autant que les résultats obtenus',
            'Accompagnez avec exigence bienveillante et feedback régulier'
          ],
          vendeur: [
            'Utilisez le coaching pour dépasser vos propres limites',
            'Acceptez les temps de développement comme investissement à long terme',
            'Montrez votre progression régulièrement pour maintenir la dynamique',
            'Partagez votre drive et votre ambition pour inspirer l\'équipe'
          ]
        }
      }
    },
    'Stratège': {
      'Convivial': {
        score: '⭐⭐⭐',
        title: 'Manager Stratège × Vendeur Convivial',
        description: 'Vision stratégique et chaleur humaine',
        caracteristiques: [
          'Structure apportée par le manager',
          'Humanité apportée par le vendeur',
          'Complémentarité organisation-relation',
          'Communication à adapter'
        ],
        forces: [
          'Performance avec fidélisation',
          'Process respectés avec flexibilité',
          'Clients satisfaits et objectifs atteints'
        ],
        attention: [
          'Rythmes différents à synchroniser',
          'Le manager doit valoriser le relationnel',
          'Le vendeur doit accepter la planification'
        ],
        recommandations: {
          manager: [
            'Expliquez votre vision pour emporter l\'adhésion sincère du vendeur',
            'Valorisez l\'impact humain et relationnel de la stratégie',
            'Donnez du sens aux objectifs chiffrés',
            'Intégrez les remontées terrain dans votre planification'
          ],
          vendeur: [
            'Montrez comment votre relationnel sert concrètement la vision',
            'Acceptez la planification comme un cadre libérateur et motivant',
            'Traduisez vos relations clients en données stratégiques exploitables',
            'Partagez les informations terrain qui enrichissent la stratégie'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐⭐',
        title: LABEL_MANAGER_STRATEGE_X_VENDEUR_DYNAMIQUE,
        description: 'Vision et action',
        caracteristiques: [
          'Stratégie claire définie',
          'Exécution rapide et efficace',
          'Complémentarité réflexion-action',
          'Performance optimisée'
        ],
        forces: [
          'Objectifs clairs et atteints',
          'Efficacité maximale',
          'Anticipation et réactivité'
        ],
        attention: [
          'Le vendeur peut trouver la planification lourde',
          'Besoin de flexibilité',
          'Communication régulière'
        ],
        recommandations: {
          manager: [
            'Donnez une vision claire et des objectifs ambitieux bien définis',
            'Faites confiance à l\'exécution sans micro-manager',
            'Soyez disponible pour des ajustements tactiques rapides',
            'Valorisez les initiatives prises dans le cadre de la stratégie'
          ],
          vendeur: [
            'Alignez votre action sur la stratégie globale définie',
            'Communiquez vos résultats rapidement et régulièrement',
            'Proposez des améliorations tactiques dans le cadre fixé',
            'Utilisez votre énergie au service de la vision long terme'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Stratège × Vendeur Explorateur',
        description: 'Innovation stratégique',
        caracteristiques: [
          'Vision long terme',
          'Exploration cadrée',
          'Innovation structurée',
          'Complémentarité vision-créativité'
        ],
        forces: [
          'Solutions innovantes et viables',
          'Développement durable',
          'Anticipation des tendances'
        ],
        attention: [
          'Le vendeur peut se sentir limité',
          'Besoin de liberté encadrée',
          'Patience des deux côtés'
        ],
        recommandations: {
          manager: [
            'Intégrez les idées créatives dans votre planification stratégique',
            'Donnez une liberté encadrée d\'exploration avec des jalons clairs',
            'Transformez les innovations en opportunités stratégiques viables',
            'Valorisez la prospection de tendances et d\'opportunités nouvelles'
          ],
          vendeur: [
            'Ancrez votre créativité dans la vision long terme définie',
            'Proposez des innovations testables avec un plan de résultats',
            'Montrez comment vos explorations servent la stratégie globale',
            'Respectez les jalons stratégiques tout en explorant'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐⭐',
        title: LABEL_MANAGER_STRATEGE_X_VENDEUR_TECHNIQUE,
        description: 'Excellence stratégique et technique',
        caracteristiques: [
          'Vision long terme et expertise',
          'Process optimisés',
          'Excellence opérationnelle',
          'Respect mutuel des compétences'
        ],
        forces: [
          'Performance exceptionnelle durable',
          'Référence sur le marché',
          'Efficacité maximale'
        ],
        attention: [
          'Risque de sur-optimisation',
          'Ne pas négliger l\'humain',
          'Rester flexible'
        ],
        recommandations: {
          manager: [
            'Appuyez-vous sur l\'expertise comme avantage concurrentiel stratégique',
            'Donnez de l\'autonomie dans l\'exécution technique',
            'Intégrez l\'expertise dans votre vision de différenciation',
            'Valorisez la contribution technique à la stratégie globale'
          ],
          vendeur: [
            'Alignez votre expertise sur les objectifs stratégiques définis',
            'Partagez vos analyses techniques pour enrichir la vision',
            'Proposez des optimisations qui s\'inscrivent dans le long terme',
            'Montrez la valeur stratégique et commerciale de votre technique'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐⭐⭐',
        title: LABEL_MANAGER_STRATEGE_X_VENDEUR_CHALLENGER,
        description: 'Ambition stratégique',
        caracteristiques: [
          'Objectifs ambitieux et structurés',
          'Vision de conquête',
          'Planification des victoires',
          'Culture de l\'excellence'
        ],
        forces: [
          'Leadership marché',
          'Résultats exceptionnels',
          'Croissance continue'
        ],
        attention: [
          'Équilibrer ambition et réalisme',
          'Célébrer les étapes',
          'Attention au surmenage'
        ],
        recommandations: {
          manager: [
            'Fixez des objectifs de conquête ambitieux et structurés dans le temps',
            'Donnez une vision de victoire inspirante et partagée',
            'Créez des jalons de réussite mesurables pour entretenir la motivation',
            'Célébrez chaque étape de la conquête pour maintenir l\'élan'
          ],
          vendeur: [
            'Alignez votre ambition sur la vision stratégique globale',
            'Utilisez la planification pour démultiplier vos résultats individuels',
            'Partagez vos objectifs personnels avec le manager pour vous synchroniser',
            'Proposez des stratégies de conquête qui enrichissent le plan'
          ]
        }
      }
    },
    'Dynamiseur': {
      'Convivial': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Dynamiseur × Vendeur Convivial',
        description: 'Synergie humaine exceptionnelle',
        caracteristiques: [
          'Énergie positive et chaleur',
          'Culture de bienveillance',
          'Inspiration et relation',
          'Ambiance exceptionnelle'
        ],
        forces: [
          'Engagement maximal',
          'Fidélisation client et équipe',
          'Bien-être au travail',
          'Résultats avec plaisir'
        ],
        attention: [
          'Ne pas négliger la structure',
          'Fixer des objectifs clairs',
          'Éviter l\'excès d\'émotionnel'
        ],
        recommandations: {
          manager: [
            'Inspirez avec votre énergie positive et célébrez les réussites relationnelles',
            'Valorisez publiquement les succès en fidélisation client',
            'Créez des moments d\'équipe réguliers pour maintenir l\'ambiance',
            'Encouragez la prise d\'initiatives relationnelles et commerciales'
          ],
          vendeur: [
            'Laissez-vous porter par l\'énergie positive du manager',
            'Partagez votre enthousiasme et votre chaleur avec toute l\'équipe',
            'Proposez des animations clients pour dynamiser l\'activité',
            'Cultivez l\'ambiance positive tout en restant focus sur les objectifs'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Dynamiseur × Vendeur Dynamique',
        description: 'Duo d\'action et d\'énergie',
        caracteristiques: [
          'Énergie décuplée',
          'Action rapide et inspirée',
          'Culture du dépassement',
          'Performance exceptionnelle'
        ],
        forces: [
          'Résultats extraordinaires',
          'Motivation maximale',
          'Ambiance électrique',
          'Conquête de nouveaux sommets'
        ],
        attention: [
          'Attention à l\'épuisement',
          'Besoin de pauses',
          'Célébrer mais aussi reposer'
        ],
        recommandations: {
          manager: [
            'Canalisez l\'énergie commune vers des objectifs précis et mesurables',
            'Fixez des défis stimulants renouvelés régulièrement',
            'Créez des rituels de célébration pour entretenir la dynamique',
            'Veillez à préserver l\'équilibre et prévenir l\'épuisement'
          ],
          vendeur: [
            'Alignez votre énergie sur la vision et le rythme du manager',
            'Célébrez les victoires ensemble pour renforcer la cohésion',
            'Proposez des challenges d\'équipe pour fédérer autour de vous',
            'Surveillez votre propre niveau d\'énergie pour durer dans le temps'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Dynamiseur × Vendeur Explorateur',
        description: 'Innovation inspirée',
        caracteristiques: [
          'Vision inspirante',
          'Créativité encouragée',
          'Culture de l\'innovation',
          'Liberté d\'explorer'
        ],
        forces: [
          'Solutions innovantes',
          'Développement unique',
          'Différenciation marché',
          'Engagement maximal'
        ],
        attention: [
          'Structurer l\'innovation',
          'Fixer des jalons',
          'Mesurer les résultats'
        ],
        recommandations: {
          manager: [
            'Encouragez les initiatives innovantes avec enthousiasme sincère',
            'Donnez la liberté d\'expérimenter dans un cadre structurant',
            'Valorisez chaque nouvelle idée même celles qui n\'aboutissent pas',
            'Créez une culture de l\'innovation positive et collective'
          ],
          vendeur: [
            'Proposez vos idées avec enthousiasme et un plan de test concret',
            'Montrez l\'impact commercial de vos innovations en chiffres',
            'Embarquez l\'équipe dans vos explorations pour créer une dynamique',
            'Fixez-vous des jalons d\'expérimentation clairs et mesurables'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Dynamiseur × Vendeur Technique',
        description: 'Excellence inspirée',
        caracteristiques: [
          'Expertise valorisée et inspirée',
          'Culture de l\'excellence',
          'Passion technique communicative',
          'Fierté du métier'
        ],
        forces: [
          'Expertise de référence',
          'Passion contagieuse',
          'Excellence reconnue',
          'Innovation technique'
        ],
        attention: [
          'Ne pas survaloriser la technique',
          'Équilibrer avec le relationnel',
          'Rester accessible'
        ],
        recommandations: {
          manager: [
            'Valorisez l\'expertise avec passion et enthousiasme communicatif',
            'Créez des moments de partage de savoir inspirants en équipe',
            'Rendez la technique passionnante et accessible à tous',
            'Célébrez les réussites techniques publiquement et régulièrement'
          ],
          vendeur: [
            'Partagez votre passion technique pour inspirer l\'équipe',
            'Transmettez votre savoir-faire avec enthousiasme et générosité',
            'Rendez votre expertise accessible et compréhensible pour les clients',
            'Contribuez activement à l\'énergie positive de l\'équipe'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Dynamiseur × Vendeur Challenger',
        description: 'Champions ensemble',
        caracteristiques: [
          'Culture de champion',
          'Défis inspirants',
          'Dépassement permanent',
          'Excellence recherchée'
        ],
        forces: [
          'Performance exceptionnelle',
          'Records battus',
          'Leadership d\'équipe',
          'Résultats historiques'
        ],
        attention: [
          'Attention à l\'épuisement mutuel',
          'Célébrer les victoires',
          'Accepter les limites'
        ],
        recommandations: {
          manager: [
            'Définissez des défis toujours plus stimulants pour entretenir la flamme',
            'Célébrez chaque record battu ensemble pour renforcer la culture',
            'Préservez l\'énergie collective en instaurant des moments de récupération',
            'Créez une émulation saine et durable autour de valeurs communes'
          ],
          vendeur: [
            'Canalisez votre ambition vers des objectifs d\'équipe fédérateurs',
            'Inspirez par l\'exemple pour tirer le niveau de l\'équipe vers le haut',
            'Célébrez les victoires collectives au moins autant qu\'individuelles',
            'Gérez votre énergie sur la durée pour performer de façon pérenne'
          ]
        }
      }
    },
    'Facilitateur': {
      'Convivial': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Facilitateur × Vendeur Convivial',
        description: 'Duo relationnel exceptionnel',
        caracteristiques: [
          'Ambiance exceptionnelle',
          'Communication fluide',
          'Confiance mutuelle',
          'Bien-être prioritaire'
        ],
        forces: [
          'Fidélisation client maximale',
          'Turnover minimal',
          'Satisfaction équipe élevée',
          'Climat de travail idéal'
        ],
        attention: [
          'Peut manquer d\'assertivité',
          'Besoin de focus résultats',
          'Attention aux décisions difficiles'
        ],
        recommandations: {
          manager: [
            'Créez les conditions optimales pour les échanges et relations clients',
            'Facilitez l\'accès aux ressources dont le vendeur a besoin',
            'Valorisez chaque succès relationnel avec sincérité et précision',
            'Organisez des moments d\'équipe réguliers pour renforcer la cohésion'
          ],
          vendeur: [
            'Utilisez pleinement l\'environnement bienveillant mis en place',
            'Partagez vos meilleures pratiques relationnelles avec l\'équipe',
            'Proposez des initiatives de fidélisation pour enrichir l\'approche',
            'Cultivez aussi les relations internes pour renforcer la synergie'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐',
        title: 'Manager Facilitateur × Vendeur Dynamique',
        description: 'Rythmes à synchroniser',
        caracteristiques: [
          'Le manager facilite',
          'Le vendeur fonce',
          'Besoin d\'équilibre',
          'Communication sur les attentes'
        ],
        forces: [
          'Le vendeur se sent soutenu',
          'Fluidité opérationnelle',
          'Peu de conflits'
        ],
        attention: [
          'Le vendeur peut manquer de challenge',
          'Besoin de stimulation',
          'Fixer des objectifs ambitieux'
        ],
        recommandations: {
          manager: [
            'Challengez davantage avec des objectifs ambitieux et stimulants',
            'Donnez plus d\'autonomie et de liberté dans les méthodes d\'action',
            'Créez des défis réguliers pour maintenir l\'énergie et la motivation',
            'Valorisez l\'énergie déployée et les initiatives prises'
          ],
          vendeur: [
            'Utilisez la stabilité de l\'environnement pour performer sans freins',
            'Proposez vos propres objectifs ambitieux au manager',
            'Inspirez l\'équipe par votre dynamisme et votre énergie',
            'Guidez le manager vers plus d\'exigence pour progresser ensemble'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Facilitateur × Vendeur Explorateur',
        description: 'Exploration facilitée',
        caracteristiques: [
          'Espace d\'exploration donné',
          'Soutien et facilitation',
          'Culture de l\'innovation',
          'Confiance mutuelle'
        ],
        forces: [
          'Innovation libre',
          'Développement créatif',
          'Bien-être et performance',
          'Solutions originales'
        ],
        attention: [
          'Besoin de cadre parfois',
          'Fixer des jalons',
          'Mesurer les résultats'
        ],
        recommandations: {
          manager: [
            'Créez un espace d\'innovation libre mais sécurisé et structurant',
            'Facilitez l\'accès aux ressources créatives et aux outils d\'innovation',
            'Valorisez chaque expérimentation même celles qui échouent',
            'Aidez à transformer les idées en plans d\'action concrets'
          ],
          vendeur: [
            'Explorez avec sécurité et confiance dans cet environnement favorable',
            'Proposez des prototypes testables avec des métriques de succès',
            'Impliquez l\'équipe dans vos explorations pour créer une adhésion',
            'Montrez les résultats concrets de vos innovations régulièrement'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐',
        title: 'Manager Facilitateur × Vendeur Technique',
        description: 'Expertise facilitée',
        caracteristiques: [
          'Conditions optimales créées',
          'Expertise valorisée',
          'Soutien opérationnel',
          'Peu de contraintes'
        ],
        forces: [
          'Excellence technique',
          'Concentration maximale',
          'Satisfaction au travail'
        ],
        attention: [
          'Besoin de challenge',
          'Focus résultats',
          'Stimulation nécessaire'
        ],
        recommandations: {
          manager: [
            'Créez les conditions optimales pour l\'expression de l\'expertise',
            'Facilitez l\'accès aux formations et aux ressources techniques',
            'Valorisez la transmission de savoir comme contribution majeure',
            'Challengez vers plus de résultats commerciaux avec bienveillance'
          ],
          vendeur: [
            'Montrez vos résultats proactivement sans attendre d\'être challengé',
            'Partagez votre expertise dans l\'équipe pour créer de la valeur',
            'Proposez vos propres objectifs d\'excellence technique',
            'Demandez plus de challenge si vous avez besoin de stimulation'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐',
        title: 'Manager Facilitateur × Vendeur Challenger',
        description: 'Besoin de stimulation',
        caracteristiques: [
          'Le manager facilite',
          'Le vendeur a besoin de défis',
          'Incompatibilité possible',
          'Ajustements nécessaires'
        ],
        forces: [
          'Environnement sans stress',
          'Soutien permanent',
          'Peu de conflits'
        ],
        attention: [
          'Le vendeur peut s\'ennuyer',
          'Besoin de challenges',
          'Le manager doit pousser plus'
        ],
        recommandations: {
          manager: [
            'Augmentez le niveau d\'exigence progressivement et avec clarté',
            'Créez des défis stimulants et structurés autour des objectifs',
            'Donnez plus de feedback direct sur les performances attendues',
            'Valorisez l\'ambition et la performance pour créer une émulation'
          ],
          vendeur: [
            'Guidez le manager vers plus de challenge en exprimant vos besoins',
            'Créez vos propres défis personnels pour rester motivé',
            'Partagez votre ambition pour inspirer l\'équipe autour de vous',
            'Cherchez des challenges externes si le cadre ne suffit plus'
          ]
        }
      }
    },
    'Tacticien': {
      'Convivial': {
        score: '⭐⭐',
        title: 'Manager Tacticien × Vendeur Convivial',
        description: 'Process vs Relation',
        caracteristiques: [
          'Le manager focus process',
          'Le vendeur focus relation',
          'Besoin de compromis',
          'Communication essentielle'
        ],
        forces: [
          'Efficacité opérationnelle',
          'Clients satisfaits malgré tout',
          'Complémentarité possible'
        ],
        attention: [
          'Le vendeur peut se sentir bridé',
          'Le manager doit valoriser l\'humain',
          'Besoin de flexibilité'
        ],
        recommandations: {
          manager: [
            'Intégrez le relationnel dans vos process comme indicateur de performance',
            'Valorisez les soft skills comme des atouts mesurables',
            'Expliquez le "pourquoi" derrière chaque process pour créer l\'adhésion',
            'Créez des process centrés sur l\'expérience client et la relation'
          ],
          vendeur: [
            'Proposez des process relationnels mesurables qui parlent au manager',
            'Montrez comment la relation génère des résultats concrets et chiffrés',
            'Acceptez le cadre process comme un support à votre talent relationnel',
            'Enrichissez les process de votre sens du client pour les humaniser'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐⭐⭐',
        title: 'Manager Tacticien × Vendeur Dynamique',
        description: 'Opérationnel et efficace',
        caracteristiques: [
          'Optimisation opérationnelle',
          'Exécution rapide',
          'Process efficaces',
          'Performance court terme'
        ],
        forces: [
          'Efficacité maximale',
          'Résolution rapide',
          'Résultats immédiats',
          'Peu de perte de temps'
        ],
        attention: [
          'Risque de micro-management',
          'Vision long terme à garder',
          'Aspect humain à préserver'
        ],
        recommandations: {
          manager: [
            'Optimisez les process pour maximiser la vitesse d\'exécution',
            'Donnez de l\'autonomie dans l\'exécution une fois le process validé',
            'Créez des tableaux de bord clairs pour un suivi efficace',
            'Célébrez les performances rapides et les records de productivité'
          ],
          vendeur: [
            'Utilisez les process pour aller plus vite et maximiser vos résultats',
            'Proposez des optimisations opérationnelles basées sur votre terrain',
            'Respectez les indicateurs définis et communiquez vos résultats',
            'Montrez vos performances avec des chiffres précis et réguliers'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐',
        title: 'Manager Tacticien × Vendeur Explorateur',
        description: 'Process vs Créativité',
        caracteristiques: [
          'Le manager veut des process',
          'Le vendeur veut explorer',
          'Friction possible',
          'Compromis difficile'
        ],
        forces: [
          'Process structurés',
          'Créativité cadrée',
          'Équilibre possible'
        ],
        attention: [
          'Le vendeur peut se sentir étouffé',
          'Le manager doit lâcher prise',
          'Communication cruciale'
        ],
        recommandations: {
          manager: [
            'Créez des process d\'innovation structurés avec des étapes claires',
            'Donnez un espace d\'expérimentation encadré avec des règles définies',
            'Valorisez les idées testables et mesurables dans un cadre rigoureux',
            'Intégrez la créativité dans les process pour l\'institutionnaliser'
          ],
          vendeur: [
            'Proposez chaque idée avec un plan de test et des métriques précises',
            'Montrez comment l\'innovation peut être processisée et reproductible',
            'Acceptez le cadre comme un guide qui structure votre créativité',
            'Documentez vos explorations pour faciliter leur intégration'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Tacticien × Vendeur Technique',
        description: 'Excellence opérationnelle',
        caracteristiques: [
          'Process optimisés',
          'Expertise technique',
          'Rigueur partagée',
          'Excellence opérationnelle'
        ],
        forces: [
          'Performance technique maximale',
          'Efficacité exceptionnelle',
          'Fiabilité totale',
          'Référence du marché'
        ],
        attention: [
          'Risque de sur-process',
          'Ne pas oublier l\'humain',
          'Rester flexible'
        ],
        recommandations: {
          manager: [
            'Créez des process d\'excellence technique avec la rigueur partagée',
            'Donnez de l\'autonomie sur les méthodes dans le cadre des process',
            'Valorisez la rigueur, la fiabilité et la précision en toutes circonstances',
            'Mesurez et célébrez l\'excellence technique comme avantage concurrentiel'
          ],
          vendeur: [
            'Proposez des optimisations de process basées sur votre expertise terrain',
            'Documentez vos meilleures pratiques pour les partager et les pérenniser',
            'Partagez vos méthodes avec l\'équipe pour élever le niveau collectif',
            'Montrez la performance concrète et les bénéfices de l\'excellence technique'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐⭐',
        title: 'Manager Tacticien × Vendeur Challenger',
        description: 'Performance opérationnelle',
        caracteristiques: [
          'Process de performance',
          'Optimisation continue',
          'Focus résultats',
          'Efficacité recherchée'
        ],
        forces: [
          'Résultats mesurables',
          'Performance optimisée',
          'Dépassement structuré'
        ],
        attention: [
          'Le vendeur peut trouver ça lourd',
          'Besoin de souplesse',
          'Célébrer les victoires'
        ],
        recommandations: {
          manager: [
            'Créez des process de dépassement structurés autour d\'objectifs ambitieux',
            'Fixez des indicateurs mesurables et challengeants pour stimuler',
            'Valorisez les progrès étape par étape avec rigueur et régularité',
            'Créez une compétition saine et équitable dans un cadre process clair'
          ],
          vendeur: [
            'Utilisez les process pour démultiplier et optimiser vos résultats',
            'Proposez vos propres métriques de performance au manager',
            'Poussez les limites des process existants pour les améliorer',
            'Partagez vos stratégies gagnantes pour enrichir les process collectifs'
          ]
        }
      }
    },
    'Mentor': {
      'Convivial': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Mentor × Vendeur Convivial',
        description: 'Transmission et relation',
        caracteristiques: [
          'Transmission avec patience',
          'Développement relationnel',
          'Culture de l\'apprentissage',
          'Respect mutuel'
        ],
        forces: [
          'Développement exceptionnel',
          'Fidélisation client et vendeur',
          'Expertise transmise',
          'Bien-être au travail'
        ],
        attention: [
          'Focus résultats à maintenir',
          'Besoin de challenges',
          'Éviter la sur-protection'
        ],
        recommandations: {
          manager: [
            'Transmettez avec patience, bienveillance et exemples concrets',
            'Valorisez les progrès relationnels avec précision et sincérité',
            'Partagez votre sagesse sur la gestion client et la fidélisation',
            'Créez un climat de confiance profonde propice à l\'apprentissage'
          ],
          vendeur: [
            'Écoutez et absorbez l\'expérience partagée avec curiosité et humilité',
            'Appliquez les conseils relationnels et mesurez leur impact',
            'Partagez vos réussites pour enrichir la transmission mutuelle',
            'Montrez votre évolution régulièrement pour nourrir la dynamique'
          ]
        }
      },
      'Dynamique': {
        score: '⭐⭐',
        title: 'Manager Mentor × Vendeur Dynamique',
        description: 'Patience vs Action',
        caracteristiques: [
          'Le manager prend son temps',
          'Le vendeur veut aller vite',
          'Rythmes incompatibles',
          'Frustration possible'
        ],
        forces: [
          'Le vendeur apprend la patience',
          'Expertise transmise',
          'Développement durable'
        ],
        attention: [
          'Le vendeur peut s\'impatienter',
          'Le manager doit accélérer',
          'Communication essentielle'
        ],
        recommandations: {
          manager: [
            'Adaptez votre rythme de transmission à l\'impatience naturelle du vendeur',
            'Donnez des leçons courtes, concrètes et immédiatement actionnables',
            'Valorisez l\'apprentissage en faisant plutôt qu\'en théorisant',
            'Challengez vers la réflexion stratégique pour développer la profondeur'
          ],
          vendeur: [
            'Prenez le temps d\'apprendre avant d\'agir pour éviter les erreurs',
            'Partagez votre retour d\'expérience terrain pour enrichir la transmission',
            'Demandez des feedbacks rapides et concrets après chaque action',
            'Montrez que vous intégrez les leçons dans votre pratique quotidienne'
          ]
        }
      },
      'Explorateur': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Mentor × Vendeur Explorateur',
        description: 'Transmission et curiosité',
        caracteristiques: [
          'Partage d\'expertise',
          'Curiosité encouragée',
          'Apprentissage profond',
          'Développement unique'
        ],
        forces: [
          'Expert en devenir',
          'Innovation et tradition',
          'Excellence durable',
          'Passion transmise'
        ],
        attention: [
          'Besoin de résultats aussi',
          'Éviter la sur-analyse',
          'Fixer des deadlines'
        ],
        recommandations: {
          manager: [
            'Guidez la curiosité avec votre expérience et vos erreurs formatives',
            'Partagez les cas complexes de votre parcours comme matière à apprendre',
            'Encouragez l\'expérimentation encadrée avec des objectifs d\'apprentissage',
            'Connectez chaque exploration à un apprentissage profond et durable'
          ],
          vendeur: [
            'Utilisez l\'expérience du mentor comme boussole pour vos explorations',
            'Partagez vos découvertes pour enrichir la transmission mutuellement',
            'Proposez des terrains d\'exploration nouveaux qui profitent à toute l\'équipe',
            'Documentez vos apprentissages pour les rendre accessibles et durables'
          ]
        }
      },
      'Technique': {
        score: '⭐⭐⭐⭐⭐',
        title: 'Manager Mentor × Vendeur Technique',
        description: 'Transmission d\'excellence',
        caracteristiques: [
          'Maître et apprenti',
          'Excellence technique transmise',
          'Respect profond mutuel',
          'Culture de l\'expertise'
        ],
        forces: [
          'Expertise exceptionnelle',
          'Continuité du savoir',
          'Référence du marché',
          'Fierté du métier'
        ],
        attention: [
          'Ne pas oublier le commercial',
          'Équilibrer technique et vente',
          'Rester accessible aux clients'
        ],
        recommandations: {
          manager: [
            'Transmettez votre expertise avec générosité et sens du détail',
            'Partagez les cas techniques complexes de votre carrière comme héritage',
            'Valorisez l\'excellence technique comme un héritage professionnel précieux',
            'Encouragez le vendeur à dépasser votre propre niveau d\'expertise'
          ],
          vendeur: [
            'Absorbez chaque enseignement technique avec humilité et curiosité',
            'Posez des questions d\'approfondissement pour aller plus loin',
            'Partagez votre expertise en retour pour créer une transmission mutuelle',
            'Devenez le futur référent technique de l\'équipe grâce à ce mentorat'
          ]
        }
      },
      'Challenger': {
        score: '⭐⭐',
        title: 'Manager Mentor × Vendeur Challenger',
        description: 'Patience vs Ambition',
        caracteristiques: [
          'Le manager forme patiemment',
          'Le vendeur veut performer vite',
          'Rythmes différents',
          'Ajustement nécessaire'
        ],
        forces: [
          'Formation solide',
          'Bases excellentes',
          'Développement structuré'
        ],
        attention: [
          'Le vendeur peut trouver ça lent',
          'Le manager doit challenger',
          'Fixer des objectifs ambitieux'
        ],
        recommandations: {
          manager: [
            'Canalisez l\'ambition avec la sagesse et la perspective de l\'expérience',
            'Fixez des objectifs de développement ambitieux et progressifs',
            'Partagez les étapes clés de votre propre parcours de progression',
            'Valorisez la patience et la rigueur comme forces à long terme'
          ],
          vendeur: [
            'Utilisez l\'expérience du mentor pour aller plus vite et éviter les erreurs',
            'Acceptez la formation patiente comme un investissement à fort rendement',
            'Montrez votre progression régulièrement pour maintenir la dynamique',
            'Proposez des objectifs ambitieux à votre mentor pour accélérer le rythme'
          ]
        }
      }
    }
  };

  const result = compatibilityMatrix[managementType]?.[sellingStyle];
  return result || null;
};
