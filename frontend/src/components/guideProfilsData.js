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

