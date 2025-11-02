import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export default function GuideProfilsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('vente');
  const [currentProfile, setCurrentProfile] = useState(0);

  const venteProfiles = [
    {
      id: 'convivial',
      name: 'Le Convivial',
      icon: '🤝',
      color: 'blue',
      description: 'Le vendeur qui crée naturellement du lien avec les clients',
      caracteristiques: [
        'Crée facilement du lien avec les clients',
        'Excellente écoute et empathie naturelle',
        'Préfère les relations long terme aux ventes one-shot',
        'Atmosphère chaleureuse et rassurante'
      ],
      forces: [
        'Fidélisation client exceptionnelle',
        'Atmosphère magasin accueillante',
        'Client se sent compris et écouté',
        'Bouche-à-oreille positif naturel'
      ],
      developpement: [
        'Peut manquer d\'assertivité au moment du closing',
        'Risque de trop se disperser en discussions',
        'Besoin de structurer davantage le process de vente',
        'Peut avoir du mal à gérer les clients pressés'
      ],
      conseilManager: 'Valorisez son relationnel exceptionnel tout en l\'aidant à structurer avec des scripts de closing simples. Fixez des objectifs de conversion tout en maintenant sa spontanéité.',
      exemple: 'Sophie accueille chaque client avec un sourire sincère. Elle prend le temps de discuter, de comprendre leurs besoins réels. Ses clients reviennent souvent car ils se sentent comme chez un ami.'
    },
    {
      id: 'performer',
      name: 'Le Performer',
      icon: '🎯',
      color: 'red',
      description: 'Le vendeur orienté résultats et compétition',
      caracteristiques: [
        'Orienté résultats et chiffres avant tout',
        'Compétitif et ambitieux',
        'Adore les challenges et défis',
        'Énergie communicative et motivante'
      ],
      forces: [
        'Atteint ou dépasse systématiquement les objectifs',
        'Énergique et motivant pour toute l\'équipe',
        'Closing efficace et sans hésitation',
        'Gestion du temps optimale'
      ],
      developpement: [
        'Peut négliger la relation client au profit du résultat',
        'Risque de burn-out si mal encadré',
        'Parfois trop direct avec les clients',
        'Peut créer une pression négative dans l\'équipe'
      ],
      conseilManager: 'Canalisez son énergie avec des objectifs clairs et ambitieux. Attention à l\'équilibre vie pro/perso. Valorisez aussi la qualité de la relation client, pas que les chiffres.',
      exemple: 'Marc challenge quotidiennement son record personnel. Il transforme chaque vente en opportunité de dépassement. Son tableau de bord est toujours vert, mais il doit apprendre à ralentir avec certains clients.'
    },
    {
      id: 'challenger',
      name: 'Le Challenger',
      icon: '🚀',
      color: 'purple',
      description: 'Le vendeur qui ose sortir des sentiers battus',
      caracteristiques: [
        'Aime sortir de sa zone de confort',
        'Teste constamment de nouvelles approches',
        'Questionne le statu quo de manière constructive',
        'Adaptabilité remarquable'
      ],
      forces: [
        'Innovation dans les techniques de vente',
        'Excellente adaptabilité aux clients difficiles',
        'Dynamise l\'équipe avec ses idées',
        'Gestion efficace des objections complexes'
      ],
      developpement: [
        'Résultats parfois instables',
        'Besoin d\'un cadre pour ne pas se disperser',
        'Parfois trop créatif au détriment du process',
        'Peut déstabiliser les clients traditionnels'
      ],
      conseilManager: 'Donnez-lui de l\'autonomie tout en fixant un cadre clair. Parfait pour tester de nouvelles approches ou former sur l\'adaptabilité. Canalisez sa créativité.',
      exemple: 'Léa n\'hésite pas à sortir du script. Face à un client sceptique, elle invente une démo originale qui fait mouche. Ses méthodes ne marchent pas toujours, mais quand ça marche, c\'est spectaculaire.'
    },
    {
      id: 'analyste',
      name: 'L\'Analyste',
      icon: '🔍',
      color: 'indigo',
      description: 'Le vendeur expert qui maîtrise son sujet sur le bout des doigts',
      caracteristiques: [
        'Maîtrise parfaite du produit et de ses spécificités',
        'Approche méthodique et structurée',
        'Répond à toutes les objections techniques',
        'Préparation minutieuse avant chaque vente'
      ],
      forces: [
        'Crédibilité technique exceptionnelle',
        'Rassure les clients experts ou exigeants',
        'Très peu de retours produits',
        'Argumentation solide et documentée'
      ],
      developpement: [
        'Peut noyer le client sous l\'information',
        'Manque parfois de spontanéité',
        'Process de closing peut être long',
        'Peut sur-analyser au lieu d\'agir'
      ],
      conseilManager: 'Encouragez la simplification et le storytelling. Valorisez son expertise tout en lui apprenant à adapter son discours. Parfait pour les produits techniques ou premium.',
      exemple: 'Thomas connaît chaque référence par cœur. Face à un client technophile, il déroule une argumentation imparable. Mais parfois, un client simple veut juste "le bleu" sans 10 minutes d\'explications.'
    },
    {
      id: 'relationnel',
      name: 'Le Relationnel',
      icon: '🎭',
      color: 'pink',
      description: 'Le vendeur qui transforme chaque vente en expérience mémorable',
      caracteristiques: [
        'Transforme chaque vente en expérience unique',
        'Storytelling naturel et captivant',
        'Énergie communicative et enthousiasme',
        'Crée des émotions positives'
      ],
      forces: [
        'Clients enthousiastes et engagés',
        'Bouche-à-oreille viral',
        'Ambiance magasin dynamique et vivante',
        'Mémorabilité de l\'expérience client'
      ],
      developpement: [
        'Besoin de structure dans le suivi administratif',
        'Peut oublier les détails opérationnels',
        'Risque de sur-promesse',
        'Dépendant de son humeur du jour'
      ],
      conseilManager: 'Encadrez avec des check-lists et process clairs. Laissez libre cours à sa créativité relationnelle. Parfait pour les lancements produits ou événements spéciaux.',
      exemple: 'Emma raconte l\'histoire derrière chaque produit comme un conte. Les clients repartent ravis, avec des étoiles dans les yeux. Mais le suivi SAV n\'est pas son fort...'
    },
    {
      id: 'consultant',
      name: 'Le Consultant',
      icon: '⚖️',
      color: 'teal',
      description: 'Le vendeur qui privilégie le conseil à la vente pure',
      caracteristiques: [
        'Approche conseil avant approche vente',
        'Recherche la solution optimale pour le client',
        'Éthique forte et transparence',
        'Peut refuser une vente si inadaptée'
      ],
      forces: [
        'Confiance client maximale',
        'Ventes de très haute qualité (peu de retours)',
        'Fidélisation exceptionnelle',
        'Image de marque premium'
      ],
      developpement: [
        'Peut laisser partir des clients (vente "manquée")',
        'Volume de ventes parfois plus faible',
        'Perfectionniste (peut ralentir le process)',
        'Peut frustrer le management sur les objectifs'
      ],
      conseilManager: 'Valorisez la qualité plutôt que la quantité. Parfait pour les produits premium ou le conseil personnalisé. Mesurez la satisfaction client, pas que le CA.',
      exemple: 'Paul conseille parfois à un client de ne PAS acheter si le produit ne correspond pas. Résultat : une confiance totale et un taux de retour quasi nul. Mais son CA mensuel est en dents de scie.'
    }
  ];

  const discProfiles = [
    {
      id: 'dominant',
      name: 'Dominant',
      letter: 'D',
      icon: '🔴',
      color: 'red',
      motCle: 'RÉSULTATS',
      description: 'Direct, décisif et orienté action',
      comportements: [
        'Direct et franc dans sa communication',
        'Prend des décisions rapides',
        'Aime les défis et la compétition',
        'Impatient avec les détails',
        'Veut contrôler son environnement',
        'Fonctionne bien sous pression'
      ],
      communication: {
        aFaire: [
          'Soyez concis et direct',
          'Focalisez sur les résultats',
          'Donnez des options et laissez décider',
          'Allez droit au but',
          'Respectez son besoin d\'autonomie'
        ],
        aEviter: [
          'Les longs discours détaillés',
          'Perdre du temps en préliminaires',
          'Être trop émotionnel',
          'Micro-manager',
          'Éviter les conflits directs'
        ]
      },
      motivation: [
        '🎯 Challenges et objectifs ambitieux',
        '🏆 Reconnaissance des résultats',
        '⚡ Nouveaux projets stimulants',
        '👑 Autonomie et pouvoir de décision',
        '📈 Possibilités d\'avancement rapide'
      ],
      exemple: 'En réunion, David va droit au but : "Quel est l\'objectif ? Qui fait quoi ? On valide et on y va." Il n\'a pas le temps pour les discussions qui tournent en rond.'
    },
    {
      id: 'influent',
      name: 'Influent',
      letter: 'I',
      icon: '🟡',
      color: 'yellow',
      motCle: 'RELATION',
      description: 'Enthousiaste, sociable et inspirant',
      comportements: [
        'Enthousiaste et optimiste',
        'Aime parler et partager',
        'Spontané et expressif',
        'Besoin de reconnaissance sociale',
        'Évite les conflits',
        'Peut manquer de rigueur dans les détails'
      ],
      communication: {
        aFaire: [
          'Soyez chaleureux et positif',
          'Racontez des histoires',
          'Encouragez et félicitez publiquement',
          'Créez un environnement fun',
          'Impliquez socialement'
        ],
        aEviter: [
          'Être trop sérieux ou froid',
          'Critiquer publiquement',
          'Environnement isolé',
          'Communication uniquement écrite',
          'Ignorer leurs idées'
        ]
      },
      motivation: [
        '🌟 Reconnaissance publique',
        '👥 Travail d\'équipe et socialisation',
        '🎉 Environnement fun et dynamique',
        '💡 Possibilité d\'innover',
        '🎤 Opportunités de présentation'
      ],
      exemple: 'Marie anime chaque briefing avec enthousiasme. Elle transforme chaque victoire en célébration. Son énergie est communicative, mais elle oublie parfois les deadlines.'
    },
    {
      id: 'stable',
      name: 'Stable',
      letter: 'S',
      icon: '🟢',
      color: 'green',
      motCle: 'HARMONIE',
      description: 'Calme, patient et fiable',
      comportements: [
        'Calme et patient',
        'Fiable et loyal',
        'Besoin de sécurité',
        'N\'aime pas les changements brusques',
        'Excellent écoutant',
        'Évite les confrontations'
      ],
      communication: {
        aFaire: [
          'Prenez le temps d\'écouter',
          'Expliquez le "pourquoi"',
          'Rassurez et accompagnez',
          'Préparez les changements',
          'Valorisez leur constance'
        ],
        aEviter: [
          'Changements brutaux',
          'Conflits directs',
          'Pression excessive',
          'Ignorer leurs inquiétudes',
          'Manque de reconnaissance'
        ]
      },
      motivation: [
        '🤝 Stabilité et routine',
        '💙 Environnement harmonieux',
        '🛡️ Sécurité de l\'emploi',
        '👨‍👩‍👧‍👦 Esprit d\'équipe',
        '📅 Prévisibilité'
      ],
      exemple: 'Jean est le pilier de l\'équipe. Toujours à l\'heure, toujours fiable. Mais quand le manager annonce une réorganisation, il a besoin de temps pour s\'adapter.'
    },
    {
      id: 'consciencieux',
      name: 'Consciencieux',
      letter: 'C',
      icon: '🔵',
      color: 'blue',
      motCle: 'QUALITÉ',
      description: 'Analytique, précis et méthodique',
      comportements: [
        'Analytique et précis',
        'Perfectionniste',
        'Besoin de données et preuves',
        'Respecte les règles et procédures',
        'Réfléchi avant d\'agir',
        'Peut être trop critique'
      ],
      communication: {
        aFaire: [
          'Apportez des données et faits',
          'Soyez précis et structuré',
          'Donnez du temps pour analyser',
          'Respectez leur expertise',
          'Documentez par écrit'
        ],
        aEviter: [
          'Être trop émotionnel',
          'Approximations',
          'Décisions hâtives',
          'Manque de préparation',
          'Ignorer les détails'
        ]
      },
      motivation: [
        '📊 Qualité et précision',
        '🎓 Expertise reconnue',
        '📋 Processus clairs',
        '🔬 Amélioration continue',
        '🏅 Standards élevés'
      ],
      exemple: 'Claire analyse chaque chiffre en détail. Avant de valider une action, elle veut voir les données. Son travail est impeccable, mais elle peut ralentir les décisions urgentes.'
    }
  ];

  const managementStyles = [
    {
      id: 'coach',
      name: 'Le Coach',
      icon: '🎯',
      color: 'blue',
      description: 'Développe les talents individuels',
      approche: 'Développe les compétences individuelles par l\'écoute active, le questionnement et l\'accompagnement personnalisé',
      discTypique: 'I-S (Influent-Stable)',
      caracteristiques: [
        'Écoute active et questionnement puissant',
        'Accompagnement personnalisé de chaque vendeur',
        'Développement des compétences individuelles',
        'Feedback constructif et régulier',
        'Crée un environnement de confiance'
      ],
      efficaceAvec: [
        'Vendeurs en développement',
        'Profils S et I qui ont besoin d\'encouragement',
        'Situations d\'apprentissage',
        'Équipes jeunes ou en formation'
      ],
      attention: [
        'Peut manquer de fermeté quand nécessaire',
        'Risque de sur-investissement émotionnel',
        'Peut avoir du mal avec les décisions difficiles',
        'Besoin de fixer des limites claires'
      ],
      exemple: 'Sarah prend le temps avec chaque vendeur. "Qu\'est-ce qui t\'a bloqué dans cette vente ? Comment pourrais-tu faire différemment la prochaine fois ?" Elle développe l\'autonomie.'
    },
    {
      id: 'directif',
      name: 'Le Directif',
      icon: '⚡',
      color: 'red',
      description: 'Fixe des objectifs clairs et contrôle les résultats',
      approche: 'Fixe des objectifs clairs, prend des décisions rapides et contrôle les résultats de près',
      discTypique: 'D (Dominant)',
      caracteristiques: [
        'Fixe des objectifs clairs et chiffrés',
        'Prend des décisions rapides',
        'Contrôle régulier des résultats',
        'Communication directe et sans détour',
        'Exigence élevée'
      ],
      efficaceAvec: [
        'Vendeurs expérimentés et autonomes',
        'Situations de crise ou de transformation',
        'Profils D qui apprécient la clarté',
        'Objectifs ambitieux à court terme'
      ],
      attention: [
        'Peut démotiver les profils S et I',
        'Risque de micro-management',
        'Peut créer du stress excessif',
        'Manque parfois d\'écoute'
      ],
      exemple: 'Marc fixe des objectifs chaque lundi : "Cette semaine : +15% de CA, focus produits premium. Debrief vendredi 18h. Des questions ? Non ? Alors go !"'
    },
    {
      id: 'facilitateur',
      name: 'Le Facilitateur',
      icon: '🤝',
      color: 'green',
      description: 'Crée les conditions de réussite',
      approche: 'Crée les conditions optimales de réussite en enlevant les obstacles et en soutenant l\'équipe',
      discTypique: 'S-C (Stable-Consciencieux)',
      caracteristiques: [
        'Enlève les obstacles et simplifie les process',
        'Soutien logistique et opérationnel',
        'Organisation optimale',
        'Disponibilité et écoute',
        'Focus sur les conditions de travail'
      ],
      efficaceAvec: [
        'Équipes autonomes et matures',
        'Tous les profils (très adaptable)',
        'Environnements stables',
        'Gestion du quotidien'
      ],
      attention: [
        'Peut manquer de vision stratégique',
        'Risque d\'être trop en retrait',
        'Besoin de complément pour la direction',
        'Peut éviter les décisions difficiles'
      ],
      exemple: 'Julie s\'assure que tout roule : "Vous avez besoin de quoi pour réussir ? Stock ? Formation ? Planning ajusté ? Je m\'occupe de tout."'
    },
    {
      id: 'mentor',
      name: 'Le Mentor',
      icon: '🎓',
      color: 'purple',
      description: 'Transmet son expérience et son savoir-faire',
      approche: 'Partage son expérience, guide par l\'exemple et transmet son savoir-faire',
      discTypique: 'C-S (Consciencieux-Stable)',
      caracteristiques: [
        'Partage son expérience terrain',
        'Guide par l\'exemple (lead by doing)',
        'Transmission de savoir-faire',
        'Patience et pédagogie',
        'Focus sur la maîtrise technique'
      ],
      efficaceAvec: [
        'Nouveaux vendeurs',
        'Profils C qui aiment apprendre',
        'Situations d\'apprentissage technique',
        'Transmission de l\'expertise métier'
      ],
      attention: [
        'Peut être trop dans le détail',
        'Risque de "à mon époque..."',
        'Peut bloquer l\'innovation',
        'Besoin de lâcher prise'
      ],
      exemple: 'Pierre montre à ses vendeurs : "Regarde comment je fais avec ce client difficile. Ensuite, à ton tour, je t\'observe et on débrief."'
    },
    {
      id: 'visionnaire',
      name: 'Le Visionnaire',
      icon: '🚀',
      color: 'orange',
      description: 'Inspire et motive par une vision long terme',
      approche: 'Inspire et motive par une vision à long terme, encourage l\'innovation et la transformation',
      discTypique: 'D-I (Dominant-Influent)',
      caracteristiques: [
        'Inspire avec une vision claire',
        'Encourage l\'innovation',
        'Pense stratégie et long terme',
        'Crée l\'enthousiasme',
        'Challenge le statu quo'
      ],
      efficaceAvec: [
        'Changements majeurs',
        'Profils I et D qui aiment l\'aventure',
        'Lancement de nouveaux concepts',
        'Équipes qui ont besoin d\'un souffle'
      ],
      attention: [
        'Peut négliger l\'opérationnel',
        'Besoin d\'un bras droit S ou C',
        'Peut déstabiliser les profils S',
        'Risque de trop de changements'
      ],
      exemple: 'Laura peint un tableau du futur : "Dans 6 mois, on sera la référence. Voici comment : nouveau concept, nouvelle formation, nouveaux outils. Qui est partant ?"'
    }
  ];

  const compatibilityMatrix = [
    {
      manager: 'D',
      seller: 'D',
      status: 'warning',
      description: 'Risque de conflit de pouvoir',
      conseil: 'Respecter les zones d\'autonomie de chacun. Définir clairement qui décide quoi. Transformer la compétition en collaboration.'
    },
    {
      manager: 'D',
      seller: 'I',
      status: 'good',
      description: 'Complémentaire',
      conseil: 'Le D apporte la structure, le I l\'enthousiasme. Valoriser l\'énergie du I tout en fixant des cadres clairs.'
    },
    {
      manager: 'D',
      seller: 'S',
      status: 'warning',
      description: 'Risque de stress',
      conseil: 'Le S a besoin de temps. Annoncer les changements en avance. Expliquer le pourquoi. Éviter la pression excessive.'
    },
    {
      manager: 'D',
      seller: 'C',
      status: 'good',
      description: 'Efficacité opérationnelle',
      conseil: 'Le D fixe les objectifs, le C assure la qualité. Laisser du temps au C pour analyser avant de décider.'
    },
    {
      manager: 'I',
      seller: 'I',
      status: 'warning',
      description: 'Risque de dispersion',
      conseil: 'Beaucoup d\'enthousiasme mais manque de structure. Établir des process clairs. Compléter avec un C dans l\'équipe.'
    },
    {
      manager: 'I',
      seller: 'S',
      status: 'excellent',
      description: 'Excellente synergie',
      conseil: 'Le I motive, le S stabilise. Parfait équilibre entre dynamisme et fiabilité.'
    },
    {
      manager: 'I',
      seller: 'D',
      status: 'good',
      description: 'Énergie communicative',
      conseil: 'Le I inspire, le D exécute. Attention : le D a besoin de concret, pas que de motivation.'
    },
    {
      manager: 'I',
      seller: 'C',
      status: 'neutral',
      description: 'Différences à gérer',
      conseil: 'Le I est spontané, le C est analytique. Respecter le besoin de données du C. Structurer la communication.'
    },
    {
      manager: 'S',
      seller: 'S',
      status: 'warning',
      description: 'Trop de stabilité',
      conseil: 'Risque de manque de dynamisme. Intégrer des challenges progressifs. Encourager la prise d\'initiative.'
    },
    {
      manager: 'S',
      seller: 'C',
      status: 'excellent',
      description: 'Harmonie et qualité',
      conseil: 'Le S crée l\'harmonie, le C assure la qualité. Duo parfait pour l\'excellence opérationnelle.'
    },
    {
      manager: 'S',
      seller: 'D',
      status: 'warning',
      description: 'Rythmes différents',
      conseil: 'Le D va vite, le S va posément. Définir des rythmes compatibles. Le S peut freiner les excès du D.'
    },
    {
      manager: 'S',
      seller: 'I',
      status: 'good',
      description: 'Équilibre émotionnel',
      conseil: 'Le S stabilise l\'enthousiasme du I. Belle complémentarité. Attention à ne pas brider le I.'
    },
    {
      manager: 'C',
      seller: 'C',
      status: 'warning',
      description: 'Sur-analyse',
      conseil: 'Risque de paralysie par l\'analyse. Fixer des deadlines. Accepter le "suffisamment bon".'
    },
    {
      manager: 'C',
      seller: 'D',
      status: 'neutral',
      description: 'Qualité vs rapidité',
      conseil: 'Le C veut la perfection, le D veut l\'action. Trouver le bon équilibre. Définir les standards minimums.'
    },
    {
      manager: 'C',
      seller: 'I',
      status: 'neutral',
      description: 'Structure vs spontanéité',
      conseil: 'Le C structure, le I improvise. Canaliser la créativité du I avec des process. Le C peut apprendre la flexibilité.'
    },
    {
      manager: 'C',
      seller: 'S',
      status: 'good',
      description: 'Excellence tranquille',
      conseil: 'Le C fixe les standards, le S les applique fidèlement. Duo efficace pour la qualité constante.'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      red: 'bg-red-100 text-red-700 border-red-300',
      purple: 'bg-purple-100 text-purple-700 border-purple-300',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      pink: 'bg-pink-100 text-pink-700 border-pink-300',
      teal: 'bg-teal-100 text-teal-700 border-teal-300',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300'
    };
    return colors[color] || colors.blue;
  };

  const getCurrentProfiles = () => {
    if (activeTab === 'vente') return venteProfiles;
    if (activeTab === 'disc') return discProfiles;
    if (activeTab === 'management') return managementStyles;
    return [];
  };

  const profiles = getCurrentProfiles();
  const profile = profiles[currentProfile];

  const nextProfile = () => {
    if (currentProfile < profiles.length - 1) {
      setCurrentProfile(currentProfile + 1);
    }
  };

  const prevProfile = () => {
    if (currentProfile > 0) {
      setCurrentProfile(currentProfile - 1);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentProfile(0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">📚 Guide des Profils</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-2">
            Comprenez les différents profils pour mieux adapter votre communication
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => handleTabChange('vente')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'vente'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🛍️ Profils de Vente
          </button>
          <button
            onClick={() => handleTabChange('disc')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'disc'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🎨 Profils DISC
          </button>
          <button
            onClick={() => handleTabChange('management')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'management'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            👔 Styles de Management
          </button>
          <button
            onClick={() => handleTabChange('compatibilite')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'compatibilite'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🤝 Compatibilité
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab !== 'compatibilite' && profile ? (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className={`${getColorClasses(profile.color)} rounded-2xl p-6 border-2`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{profile.icon}</span>
                    <div>
                      <h3 className="text-2xl font-bold">{profile.name}</h3>
                      {profile.motCle && (
                        <p className="text-sm font-semibold mt-1">Mot-clé : {profile.motCle}</p>
                      )}
                    </div>
                  </div>
                  {profile.letter && (
                    <div className="text-3xl font-bold opacity-50">{profile.letter}</div>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{profile.description}</p>
              </div>

              {/* Navigation entre profils */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={prevProfile}
                  disabled={currentProfile === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentProfile === 0
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                  Précédent
                </button>
                <span className="text-sm text-gray-600">
                  {currentProfile + 1} / {profiles.length}
                </span>
                <button
                  onClick={nextProfile}
                  disabled={currentProfile === profiles.length - 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentProfile === profiles.length - 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Profils de Vente */}
              {activeTab === 'vente' && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      ✨ Caractéristiques
                    </h4>
                    <ul className="space-y-2">
                      {profile.caracteristiques.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                      <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                        ✅ Forces
                      </h4>
                      <ul className="space-y-2">
                        {profile.forces.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                            <span className="mt-0.5">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                      <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                        📈 Zones de développement
                      </h4>
                      <ul className="space-y-2">
                        {profile.developpement.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-orange-700">
                            <span className="mt-0.5">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                      💡 Conseil Manager
                    </h4>
                    <p className="text-sm text-blue-700 leading-relaxed">{profile.conseilManager}</p>
                  </div>

                  <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
                    <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                      📖 Exemple concret
                    </h4>
                    <p className="text-sm text-purple-700 leading-relaxed italic">{profile.exemple}</p>
                  </div>
                </>
              )}

              {/* Profils DISC */}
              {activeTab === 'disc' && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      🎭 Comportements typiques
                    </h4>
                    <ul className="space-y-2">
                      {profile.comportements.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                      <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                        ✅ Communication : À faire
                      </h4>
                      <ul className="space-y-2">
                        {profile.communication.aFaire.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                            <span className="mt-0.5">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                      <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                        ❌ Communication : À éviter
                      </h4>
                      <ul className="space-y-2">
                        {profile.communication.aEviter.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                            <span className="mt-0.5">✗</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5">
                    <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                      🎯 Leviers de motivation
                    </h4>
                    <ul className="space-y-2">
                      {profile.motivation.map((item, index) => (
                        <li key={index} className="text-sm text-yellow-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
                    <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                      📖 Exemple concret
                    </h4>
                    <p className="text-sm text-purple-700 leading-relaxed italic">{profile.exemple}</p>
                  </div>
                </>
              )}

              {/* Styles de Management */}
              {activeTab === 'management' && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-800 mb-2">📋 Approche</h4>
                    <p className="text-sm text-gray-700 mb-4">{profile.approche}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-700">Profil DISC typique :</span>
                      <span className={`px-3 py-1 rounded-full font-medium ${getColorClasses(profile.color)}`}>
                        {profile.discTypique}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      ✨ Caractéristiques
                    </h4>
                    <ul className="space-y-2">
                      {profile.caracteristiques.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                      <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                        ✅ Efficace avec
                      </h4>
                      <ul className="space-y-2">
                        {profile.efficaceAvec.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                            <span className="mt-0.5">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                      <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                        ⚠️ Points d'attention
                      </h4>
                      <ul className="space-y-2">
                        {profile.attention.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-orange-700">
                            <span className="mt-0.5">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
                    <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                      📖 Exemple concret
                    </h4>
                    <p className="text-sm text-purple-700 leading-relaxed italic">{profile.exemple}</p>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'compatibilite' ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-200">
                <h3 className="font-bold text-gray-800 mb-2">🎯 Matrice de Compatibilité Manager-Vendeur</h3>
                <p className="text-sm text-gray-600">
                  Comprendre les synergies et les tensions potentielles entre profils DISC
                </p>
              </div>

              <div className="space-y-3">
                {compatibilityMatrix.map((item, index) => {
                  const statusColors = {
                    excellent: 'bg-green-100 border-green-300 text-green-800',
                    good: 'bg-blue-100 border-blue-300 text-blue-800',
                    neutral: 'bg-yellow-100 border-yellow-300 text-yellow-800',
                    warning: 'bg-orange-100 border-orange-300 text-orange-800'
                  };
                  const statusIcons = {
                    excellent: '⭐',
                    good: '✅',
                    neutral: '⚖️',
                    warning: '⚠️'
                  };

                  return (
                    <div key={index} className={`${statusColors[item.status]} rounded-xl p-4 border-2`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{statusIcons[item.status]}</span>
                          <span className="font-bold text-sm">
                            Manager {item.manager} + Vendeur {item.seller}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white bg-opacity-50">
                          {item.description}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">
                        <span className="font-semibold">Conseil :</span> {item.conseil}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Retail Coach 2.0 - Guide des Profils
          </p>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Télécharger PDF
          </button>
        </div>
      </div>
    </div>
  );
}
