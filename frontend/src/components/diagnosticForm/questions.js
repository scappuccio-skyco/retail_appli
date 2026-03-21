import { LABEL_DECOUVERTE_DES_BESOINS } from '../../lib/constants';

const questions = [
  {
    section: "🟡 Accueil & Premier Contact",
    items: [
      {
        id: 1,
        text: "Un client entre alors que tu termines une vente. Que fais-tu ?",
        type: "choice",
        options: [
          "Je lui fais un signe ou un mot pour lui montrer que je l'ai vu.",
          "Je finis ma vente et je vais le voir ensuite.",
          "J'envoie un regard ou un sourire, mais je reste concentré sur mon client actuel."
        ]
      },
      {
        id: 2,
        text: "Qu'est-ce qui donne envie à un client de te faire confiance dès les premières secondes ?",
        type: "choice",
        options: [
          "Mon sourire et mon attitude accueillante",
          "Ma disponibilité immédiate et mon écoute",
          "Ma capacité à comprendre rapidement ses besoins",
          "Ma connaissance approfondie des produits"
        ]
      },
      {
        id: 3,
        text: 'Un client te dit : "Je cherche un cadeau mais je ne sais pas trop quoi."',
        type: "choice",
        options: [
          "Je lui montre quelques idées pour l'inspirer.",
          "Je lui pose des questions pour savoir à qui c'est destiné.",
          "Je lui demande ce qu'il a déjà offert pour éviter les doublons."
        ]
      }
    ]
  },
  {
    section: `🟡 ${LABEL_DECOUVERTE_DES_BESOINS}`,
    items: [
      {
        id: 4,
        text: "Quand un client parle beaucoup, comment réagis-tu ?",
        type: "choice",
        options: [
          "Je l'écoute attentivement pour trouver ce qu'il veut vraiment.",
          "J'essaie de recentrer doucement la conversation.",
          "Je partage aussi pour créer une vraie discussion."
        ]
      },
      {
        id: 5,
        text: "Comment découvres-tu un besoin caché chez un client ?",
        type: "choice",
        options: [
          "En posant des questions ouvertes sur son usage",
          "En écoutant attentivement ce qu'il ne dit pas",
          "En observant ses réactions face aux produits",
          "En proposant des produits complémentaires"
        ]
      },
      {
        id: 6,
        text: 'Un client répond : "Je cherche juste à comparer." Que fais-tu ?',
        type: "choice",
        options: [
          "Je lui demande ce qu'il compare pour mieux le conseiller.",
          "Je lui propose mes meilleures offres pour le convaincre.",
          "Je respecte sa démarche et reste disponible."
        ]
      }
    ]
  },
  {
    section: "🟡 Argumentation & Persuasion",
    items: [
      {
        id: 7,
        text: "Comment présentes-tu un produit à un client hésitant ?",
        type: "choice",
        options: [
          "Je mets en avant les caractéristiques techniques.",
          "Je montre comment ça répond à ses besoins.",
          "Je partage des avis d'autres clients satisfaits."
        ]
      },
      {
        id: 8,
        text: "Comment adaptes-tu ton discours pour convaincre un client difficile ?",
        type: "choice",
        options: [
          "Je reste sur mes arguments et j'insiste sur la valeur",
          "J'écoute ses objections et j'adapte ma présentation",
          "Je change de produit pour mieux correspondre à ses attentes",
          "Je fais des concessions sur le prix ou les services"
        ]
      },
      {
        id: 9,
        text: 'Un client dit : "C\'est trop cher." Quelle est ta première réaction ?',
        type: "choice",
        options: [
          "Je justifie le prix en expliquant la valeur.",
          "Je propose une alternative moins chère.",
          "Je comprends son budget et j'adapte ma proposition."
        ]
      }
    ]
  },
  {
    section: "🟡 Closing & Finalisation",
    items: [
      {
        id: 10,
        text: "Comment sais-tu qu'un client est prêt à acheter ?",
        type: "choice",
        options: [
          "Il pose des questions sur la livraison ou le paiement",
          "Il manipule le produit avec attention",
          "Il arrête de poser des questions et semble décidé",
          "Il me demande s'il y a des promotions"
        ]
      },
      {
        id: 11,
        text: "Un client hésite encore après toutes tes explications. Que fais-tu ?",
        type: "choice",
        options: [
          "Je le relance gentiment pour le rassurer.",
          "Je lui laisse du temps pour réfléchir.",
          "Je lui propose un dernier argument décisif."
        ]
      },
      {
        id: 12,
        text: "Quelle est ta technique préférée pour finaliser une vente ?",
        type: "choice",
        options: [
          "Proposer un choix entre deux options",
          "Créer un sentiment d'urgence (stock limité, promo)",
          "Résumer tous les avantages du produit",
          "Proposer des facilités de paiement"
        ]
      }
    ]
  },
  {
    section: "🟡 Fidélisation Client",
    items: [
      {
        id: 13,
        text: "Après une vente, que fais-tu pour que le client revienne ?",
        type: "choice",
        options: [
          "Je lui fixe un rappel pour assurer son suivi",
          "Je lui propose de rejoindre le programme de fidélité",
          "Je lui donne des conseils d'utilisation personnalisés",
          "Je lui explique précisément l'entretien et la garantie"
        ]
      },
      {
        id: 14,
        text: 'Un ancien client revient avec un problème sur son achat. Tu fais quoi ?',
        type: "choice",
        options: [
          "Je trouve une solution rapidement pour le satisfaire.",
          "Je l'écoute d'abord pour comprendre le problème.",
          "Je lui propose une compensation pour garder sa confiance."
        ]
      },
      {
        id: 15,
        text: "Qu'est-ce qui fait qu'un client devient fidèle selon toi ?",
        type: "choice",
        options: [
          "La rapidité du service et l'efficacité",
          "La relation personnelle créée avec lui",
          "La qualité du service et l'attention portée",
          "La qualité constante des produits et l'expertise"
        ]
      }
    ]
  },
  {
    section: "🎨 Profil DISC - Ton Style de Vente",
    items: [
      {
        id: 16,
        text: "Face à un client indécis, tu préfères :",
        type: "choice",
        options: [
          "Prendre les devants et le guider fermement vers une décision",
          "Créer une connexion chaleureuse et le rassurer avec enthousiasme",
          "Prendre le temps d'écouter toutes ses hésitations patiemment",
          "Lui présenter tous les détails techniques pour qu'il décide en connaissance de cause"
        ]
      },
      {
        id: 17,
        text: "Quand tu as plusieurs clients en même temps, tu :",
        type: "choice",
        options: [
          "Gères la situation avec rapidité et efficacité",
          "Gardes le sourire et crées une ambiance sympa pour tout le monde",
          "Restes calme et méthodique pour ne rien oublier",
          "T'assures que chaque client reçoive une réponse précise"
        ]
      },
      {
        id: 18,
        text: "Ce qui te frustre le plus dans ton travail, c'est :",
        type: "choice",
        options: [
          "L'inaction ou la lenteur",
          "Le manque de reconnaissance ou d'ambiance",
          "Les changements trop brusques ou le stress",
          "Le manque de rigueur ou les erreurs"
        ]
      },
      {
        id: 19,
        text: "Ton approche avec un nouveau produit en rayon :",
        type: "choice",
        options: [
          "Je me lance tout de suite pour le tester en conditions réelles",
          "J'en parle avec enthousiasme aux clients dès que possible",
          "Je prends le temps de bien le comprendre avant d'en parler",
          "J'étudie toutes les caractéristiques pour maîtriser chaque détail"
        ]
      },
      {
        id: 20,
        text: "Dans une équipe, tu es plutôt :",
        type: "choice",
        options: [
          "Celui qui mène et qui pousse les autres à avancer",
          "Celui qui motive et qui crée la bonne ambiance",
          "Celui qui écoute et qui soutient",
          "Celui qui organise et qui veille à la qualité"
        ]
      },
      {
        id: 21,
        text: "Ton style de communication avec les clients, c'est plutôt :",
        type: "choice",
        options: [
          "Direct et efficace, je vais à l'essentiel",
          "Chaleureux et expressif, je crée de la complicité",
          "Patient et à l'écoute, je prends mon temps",
          "Précis et factuel, je m'appuie sur les caractéristiques"
        ]
      },
      {
        id: 22,
        text: "Ce qui te motive le plus dans la vente, c'est :",
        type: "choice",
        options: [
          "Atteindre et dépasser mes objectifs",
          "Créer des relations authentiques avec les clients",
          "La stabilité et la routine rassurante du métier",
          "Maîtriser parfaitement mon produit et mon expertise"
        ]
      },
      {
        id: 23,
        text: "En fin de journée chargée, tu es plutôt :",
        type: "choice",
        options: [
          "Energisé par les résultats et prêt à recommencer demain",
          "Content des belles interactions que tu as eues",
          "Soulagé que tout se soit bien passé sans accroc",
          "Satisfait d'avoir bien respecté toutes les procédures"
        ]
      },
      {
        id: 24,
        text: "Face à une réclamation client, ton premier réflexe :",
        type: "choice",
        options: [
          "Trouver une solution rapide et concrète immédiatement",
          "Rassurer le client avec empathie et optimisme",
          "Écouter calmement sans l'interrompre",
          "Analyser précisément le problème avant d'agir"
        ]
      },
      {
        id: 25,
        text: "Quand ton manager te donne un feedback, tu préfères qu'il soit :",
        type: "choice",
        options: [
          "Direct et factuel, sans détour",
          "Encourageant et positif avant tout",
          "Bienveillant et progressif",
          "Détaillé et constructif avec des exemples"
        ]
      },
      {
        id: 26,
        text: "Dans une période de soldes intense, tu es :",
        type: "choice",
        options: [
          "Stimulé par le challenge et la pression",
          "Motivé par l'énergie collective et l'ambiance",
          "Concentré sur le maintien d'un bon service malgré le flux",
          "Attentif à ne commettre aucune erreur de caisse ou de conseil"
        ]
      },
      {
        id: 27,
        text: "Ton organisation au quotidien :",
        type: "choice",
        options: [
          "Je fixe des objectifs clairs et j'avance vite",
          "Je m'adapte spontanément selon les situations",
          "Je suis mes routines habituelles qui marchent bien",
          "Je planifie et je structure mes tâches méthodiquement"
        ]
      },
      {
        id: 28,
        text: "Avec un client difficile ou agressif, tu :",
        type: "choice",
        options: [
          "Gardes ton autorité et poses les limites fermement",
          "Utilises l'humour et la légèreté pour désamorcer",
          "Restes patient et compréhensif sans te laisser déstabiliser",
          "Restes professionnel et factuel pour éviter l'émotion"
        ]
      },
      {
        id: 29,
        text: "Quand tu apprends une nouvelle technique de vente :",
        type: "choice",
        options: [
          "Je l'applique immédiatement pour voir si ça marche",
          "J'en discute avec les collègues pour échanger",
          "Je prends le temps de bien l'assimiler à mon rythme",
          "J'étudie d'abord la logique avant de l'appliquer"
        ]
      },
      {
        id: 30,
        text: "Dans ton espace de vente idéal, il y a :",
        type: "choice",
        options: [
          "Des défis quotidiens et des objectifs stimulants",
          "Une ambiance chaleureuse et des collègues sympas",
          "Un environnement stable et prévisible",
          "Des process clairs et une organisation rigoureuse"
        ]
      },
      {
        id: 31,
        text: "Pendant un inventaire ou une tâche répétitive, tu :",
        type: "choice",
        options: [
          "Veux terminer le plus vite possible",
          "Transformes ça en moment convivial avec l'équipe",
          "Restes concentré et appliqué jusqu'au bout",
          "T'assures de la précision de chaque comptage"
        ]
      },
      {
        id: 32,
        text: "Ta réaction face à un changement d'organisation du magasin :",
        type: "choice",
        options: [
          "Parfait, on avance et on fait évoluer les choses",
          "Super, du nouveau ça redonne de l'énergie !",
          "J'ai besoin de temps pour m'adapter",
          "Je veux comprendre la logique et les raisons"
        ]
      },
      {
        id: 33,
        text: "Ce qui décrit le mieux ton style de closing :",
        type: "choice",
        options: [
          "Je suis assertif et je guide vers la décision",
          "Je crée l'enthousiasme et l'envie d'acheter",
          "Je respecte le rythme du client sans pression",
          "Je récapitule factuellement les bénéfices produit"
        ]
      },
      {
        id: 34,
        text: "Si tu pouvais choisir ton environnement de travail idéal :",
        type: "choice",
        options: [
          "Dynamique avec des résultats visibles",
          "Convivial avec beaucoup d'interactions",
          "Sécurisant avec des routines stables",
          "Structuré avec des standards de qualité"
        ]
      },
      {
        id: 35,
        text: "Face à un objectif commercial très ambitieux :",
        type: "choice",
        options: [
          "Je relève le défi avec détermination",
          "Je motive l'équipe pour qu'on y arrive ensemble",
          "Je reste réaliste et fais de mon mieux",
          "J'établis un plan d'action précis pour l'atteindre"
        ]
      },
      {
        id: 36,
        text: "Quand un collègue a besoin d'aide :",
        type: "choice",
        options: [
          "Je lui donne des conseils directs et actionnables",
          "Je l'encourage et lui remonte le moral",
          "Je l'écoute attentivement et le soutiens",
          "Je l'aide à analyser le problème méthodiquement"
        ]
      },
      {
        id: 37,
        text: "Dans une situation de conflit entre collègues :",
        type: "choice",
        options: [
          "Je tranche rapidement pour avancer",
          "J'essaie de détendre l'atmosphère",
          "Je cherche un compromis qui satisfasse tout le monde",
          "J'analyse objectivement les faits pour trouver une solution juste"
        ]
      },
      {
        id: 38,
        text: "Ton rapport au temps en boutique :",
        type: "choice",
        options: [
          "J'aime l'action et l'efficacité",
          "Je vis l'instant et les échanges spontanés",
          "J'apprécie la constance et la régularité",
          "Je planifie et respecte les timing"
        ]
      },
      {
        id: 39,
        text: "Ce qui te rend le plus fier dans ton travail :",
        type: "choice",
        options: [
          "Mes résultats et mes performances",
          "Les relations que je crée avec les clients",
          "Ma fiabilité et ma constance",
          "Mon expertise et mon professionnalisme"
        ]
      }
    ]
  }
];

export default questions;
