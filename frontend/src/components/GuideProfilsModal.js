import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function GuideProfilsModal({ onClose, userRole = 'manager' }) {
  // Define sections based on user role
  const allSections = userRole === 'seller' 
    ? ['style_vente', 'niveau', 'motivation', 'disc']  // 4 sections for sellers
    : ['management', 'style_vente', 'niveau', 'motivation', 'disc', 'compatibilite'];  // 6 sections for managers
  
  const [activeSection, setActiveSection] = useState(allSections[0]);
  const [currentProfile, setCurrentProfile] = useState(0);
  
  // States for compatibility selector
  const [selectedManagementType, setSelectedManagementType] = useState('');
  const [selectedSellingStyle, setSelectedSellingStyle] = useState('');

  // Styles de vente (5 profils)
  const stylesVente = [
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
        'Découverte approfondie des besoins',
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

  // Niveaux d'expérience (4 niveaux gamifiés)
  const niveaux = [
    {
      name: 'Explorateur',
      icon: '🟢',
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

  // Leviers de motivation (4 types)
  const motivations = [
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
      name: 'Découverte',
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

  // DISC profiles (existing)
  const discProfiles = [
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

  // Styles de management (7 profils)
  const managementStyles = [
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
      name: 'Le Coach',
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
      name: 'Le Stratège',
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
      name: 'Le Leader Inspirant',
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

  // Guide de compatibilité Manager-Vendeur
  const compatibilityGuide = [
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
      name: 'Manager Stratège × Vendeur Convivial',
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
      name: 'Manager Leader Inspirant × Tous profils',
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

  // Compatibility matrix function
  const getCompatibilityResult = (managementType, sellingStyle) => {
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
        },
        'Dynamique': {
          score: '⭐⭐⭐⭐',
          title: 'Manager Stratège × Vendeur Dynamique',
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
          ]
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
          ]
        },
        'Technique': {
          score: '⭐⭐⭐⭐⭐',
          title: 'Manager Stratège × Vendeur Technique',
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
          ]
        },
        'Challenger': {
          score: '⭐⭐⭐⭐',
          title: 'Manager Stratège × Vendeur Challenger',
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
          ]
        }
      },
      'Leader Inspirant': {
        'Convivial': {
          score: '⭐⭐⭐⭐⭐',
          title: 'Manager Leader Inspirant × Vendeur Convivial',
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
          ]
        },
        'Dynamique': {
          score: '⭐⭐⭐⭐⭐',
          title: 'Manager Leader Inspirant × Vendeur Dynamique',
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
          ]
        },
        'Explorateur': {
          score: '⭐⭐⭐⭐⭐',
          title: 'Manager Leader Inspirant × Vendeur Explorateur',
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
          ]
        },
        'Technique': {
          score: '⭐⭐⭐⭐',
          title: 'Manager Leader Inspirant × Vendeur Technique',
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
          ]
        },
        'Challenger': {
          score: '⭐⭐⭐⭐⭐',
          title: 'Manager Leader Inspirant × Vendeur Challenger',
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
        }
      }
    };

    const result = compatibilityMatrix[managementType]?.[sellingStyle];
    return result || null;
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200',
      red: 'bg-red-50 border-red-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      orange: 'bg-orange-50 border-orange-200',
      pink: 'bg-pink-50 border-pink-200',
      gray: 'bg-gray-50 border-gray-200'
    };
    return colors[color] || colors.blue;
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setCurrentProfile(0);
  };

  const getCurrentProfiles = () => {
    if (activeSection === 'management') return managementStyles;
    if (activeSection === 'style_vente') return stylesVente;
    if (activeSection === 'niveau') return niveaux;
    if (activeSection === 'motivation') return motivations;
    if (activeSection === 'disc') return discProfiles;
    if (activeSection === 'compatibilite') return compatibilityGuide;
    return [];
  };

  const profiles = getCurrentProfiles();
  const profile = profiles[currentProfile];

  const handleNext = () => {
    if (currentProfile < profiles.length - 1) {
      setCurrentProfile(currentProfile + 1);
    }
  };

  const handlePrevious = () => {
    if (currentProfile > 0) {
      setCurrentProfile(currentProfile - 1);
    }
  };

  const getSectionTitle = () => {
    if (activeSection === 'style_vente') return '🎨 Styles de Vente';
    if (activeSection === 'niveau') return '⭐ Niveaux d\'Expérience';
    if (activeSection === 'motivation') return '⚡ Leviers de Motivation';
    if (activeSection === 'disc') return '🎭 Profils DISC';
    if (activeSection === 'management') return '👔 Type de Management';
    if (activeSection === 'compatibilite') return '🤝 Compatibilité';
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">📚 Guide des Profils</h2>
          <p className="text-white text-opacity-90">Comprends les différents profils pour mieux adapter ta communication</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 overflow-x-auto">
          {allSections.includes('management') && (
            <button
              onClick={() => handleSectionChange('management')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'management'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👔 Type de management
            </button>
          )}
          {allSections.includes('style_vente') && (
            <button
              onClick={() => handleSectionChange('style_vente')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'style_vente'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎨 Styles de Vente
            </button>
          )}
          {allSections.includes('niveau') && (
            <button
              onClick={() => handleSectionChange('niveau')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'niveau'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⭐ Niveaux
            </button>
          )}
          {allSections.includes('motivation') && (
            <button
              onClick={() => handleSectionChange('motivation')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'motivation'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⚡ Motivations
            </button>
          )}
          {allSections.includes('disc') && (
            <button
              onClick={() => handleSectionChange('disc')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'disc'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎭 DISC
            </button>
          )}
          {allSections.includes('compatibilite') && (
            <button
              onClick={() => handleSectionChange('compatibilite')}
              className={`px-4 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'compatibilite'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🤝 Compatibilité
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {profile && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className={`${getColorClasses(profile.color)} rounded-2xl p-6 border-2`}>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-5xl">{profile.icon}</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{profile.name}</h3>
                    <p className="text-gray-600">{profile.description}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentProfile === 0}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Précédent
                </button>
                <span className="text-gray-600 font-medium">
                  {currentProfile + 1} / {profiles.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={currentProfile === profiles.length - 1}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Caractéristiques */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  ✨ Caractéristiques
                </h4>
                <ul className="space-y-2">
                  {profile.caracteristiques.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Forces / Moteurs / Communication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    ✅ {profile.forces ? 'Forces' : profile.moteurs ? 'Moteurs' : 'Communication'}
                  </h4>
                  <ul className="space-y-2">
                    {(profile.forces || profile.moteurs || profile.communication || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-green-800">
                        <span className="text-green-600 mt-1">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-xl border-2 border-orange-200 p-5">
                  <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                    📝 {profile.attention ? 'Points d\'attention' : profile.objectifs ? 'Objectifs' : profile.conseils ? 'Conseils' : 'Développement'}
                  </h4>
                  <ul className="space-y-2">
                    {(profile.attention || profile.objectifs || profile.conseils || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-orange-800">
                        <span className="text-orange-600 mt-1">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 rounded-b-2xl text-center text-sm text-gray-600">
          Retail Coach 2.0 - Guide des Profils
        </div>
      </div>
    </div>
  );
}
