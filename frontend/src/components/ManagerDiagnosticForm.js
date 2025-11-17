import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const questions = [
  {
    section: "🟡 Compétences Managériales",
    items: [
      {
        id: 1,
        text: "Quand ton équipe rencontre une difficulté, ta première réaction est de :",
        options: [
          "Trouver une solution rapide et passer à l'action",
          "Encourager tout le monde pour garder le moral",
          "Chercher à comprendre individuellement ce qui bloque",
          "Vérifier les indicateurs pour objectiver le problème"
        ]
      },
      {
        id: 2,
        text: "En briefing, tu es plutôt du genre à :",
        options: [
          "Délivrer un message clair, précis et orienté résultats",
          "Dynamiser et créer de l'énergie dans le groupe",
          "Poser des questions et impliquer chacun dans la réflexion",
          "Cadrer les priorités et rappeler les process"
        ]
      },
      {
        id: 3,
        text: "Quand un collaborateur n'atteint pas ses objectifs, tu :",
        options: [
          "Fixes un plan d'action concret et mesurable",
          "Encourages et motives pour qu'il retrouve confiance",
          "Cherches à comprendre le \"pourquoi\" avant de juger",
          "Reformules la méthode pour qu'il suive les bonnes étapes"
        ]
      },
      {
        id: 4,
        text: "Tu te sens le plus efficace quand :",
        options: [
          "Les chiffres progressent et les objectifs sont clairs",
          "L'ambiance est positive et tout le monde se parle",
          "Ton équipe est engagée et autonome",
          "Les process tournent bien sans que tu aies à intervenir"
        ]
      },
      {
        id: 5,
        text: "Quand tu prépares un brief ou un coaching, tu penses d'abord à :",
        options: [
          "Les résultats à atteindre",
          "Ce que tu veux faire ressentir",
          "Les comportements à améliorer",
          "La méthode à transmettre"
        ]
      },
      {
        id: 6,
        text: "Ce que tu regardes le plus souvent pour piloter ton équipe :",
        options: [
          "Les ventes, taux de transfo, panier moyen",
          "Le moral et la cohésion du groupe",
          "Les comportements observés en boutique",
          "Le respect du cadre (planning, procédures, standards)"
        ]
      },
      {
        id: 7,
        text: "Ce qui te motive le plus dans ton rôle de manager :",
        options: [
          "Atteindre les objectifs et performer",
          "Créer une belle dynamique collective",
          "Voir ton équipe s'épanouir et progresser",
          "Faire respecter une organisation fluide et efficace"
        ]
      },
      {
        id: 8,
        text: "Quand tout va bien, ton réflexe est de :",
        options: [
          "Fixer un nouveau challenge",
          "Féliciter et célébrer les réussites",
          "Renforcer la cohésion du groupe",
          "Capitaliser pour formaliser la méthode"
        ]
      },
      {
        id: 9,
        text: "Et quand ça va moins bien, tu :",
        options: [
          "Rappelles les priorités et recentres l'énergie",
          "Boostes l'équipe avec une communication positive",
          "Écoutes et accompagnes avec empathie",
          "Cherches la cause racine pour corriger durablement"
        ]
      },
      {
        id: 10,
        text: "Si tu devais résumer ta mission de manager en une phrase, ce serait :",
        options: [
          "Atteindre les objectifs",
          "Créer de la motivation collective",
          "Faire grandir les autres",
          "Garantir la rigueur et l'efficacité"
        ]
      },
      {
        id: 11,
        text: "Quand tu délègues une tâche importante à un collaborateur, tu :",
        options: [
          "Fixes des résultats attendus et lui laisses la main",
          "Encourages et montres ta confiance avec enthousiasme",
          "Accompagnes progressivement et restes disponible",
          "Expliques la méthode précise à suivre étape par étape"
        ]
      },
      {
        id: 12,
        text: "Pour faire monter un vendeur en compétence, tu privilégies :",
        options: [
          "Des objectifs challenges qui le poussent à progresser",
          "Des feedbacks positifs et des encouragements constants",
          "Un accompagnement patient et personnalisé",
          "Une formation structurée avec des méthodes claires"
        ]
      },
      {
        id: 13,
        text: "Pour communiquer la stratégie de l'entreprise à ton équipe, tu :",
        options: [
          "Présentes les objectifs chiffrés et les priorités d'action",
          "Racontes une histoire inspirante qui donne du sens",
          "Prends le temps d'écouter leurs questions et préoccupations",
          "Expliques la logique et les étapes du plan avec rigueur"
        ]
      },
      {
        id: 14,
        text: "Ta méthode pour gérer tes priorités quotidiennes :",
        options: [
          "Je me concentre sur ce qui a le plus d'impact immédiat",
          "Je jongle facilement entre plusieurs sujets selon les besoins",
          "Je traite mes tâches dans un ordre logique et prévisible",
          "Je planifie rigoureusement chaque activité de la journée"
        ]
      },
      {
        id: 15,
        text: "Face à un processus inefficace dans ton équipe, tu :",
        options: [
          "Changes rapidement pour gagner en efficacité",
          "Impliques l'équipe pour co-construire l'amélioration",
          "Observes d'abord l'impact avant de modifier",
          "Analyses en détail avant de proposer une solution optimale"
        ]
      }
    ]
  },
  {
    section: "🎨 Ton profil DISC",
    items: [
      {
        id: 16,
        text: "En réunion d'équipe, tu préfères :",
        options: [
          "Prendre les devants et diriger la discussion vers des décisions concrètes",
          "Créer une ambiance positive et encourager chacun à participer",
          "Écouter attentivement tous les points de vue avant de conclure",
          "Présenter des données précises et suivre un ordre du jour structuré"
        ]
      },
      {
        id: 17,
        text: "Face à un changement important dans l'organisation, ta réaction naturelle est de :",
        options: [
          "Agir rapidement et prendre les choses en main",
          "Communiquer avec enthousiasme pour embarquer l'équipe",
          "Prendre le temps d'analyser l'impact sur chacun",
          "Étudier en détail les implications avant de valider"
        ]
      },
      {
        id: 18,
        text: "Quand tu dois donner un feedback difficile à un collaborateur, tu :",
        options: [
          "Vas droit au but avec des faits et des attentes claires",
          "Commences par du positif pour maintenir la relation",
          "Choisis un moment calme et t'assures qu'il se sent en confiance",
          "Prépares des exemples précis et des arguments documentés"
        ]
      },
      {
        id: 19,
        text: "Dans ton travail quotidien, tu es plus à l'aise avec :",
        options: [
          "Les défis et les situations qui demandent des décisions rapides",
          "Les interactions sociales et le travail en équipe",
          "Les routines stables et un environnement prévisible",
          "L'analyse de données et les process bien définis"
        ]
      },
      {
        id: 20,
        text: "Un conflit éclate entre deux vendeurs. Ta première réaction est de :",
        options: [
          "Intervenir immédiatement et trancher pour rétablir l'ordre",
          "Réunir tout le monde pour discuter ouvertement du problème",
          "Parler à chacun individuellement pour comprendre leur ressenti",
          "Analyser la situation objectivement avant de prendre position"
        ]
      },
      {
        id: 21,
        text: "Quand tu fixes des objectifs à ton équipe, tu privilégies :",
        options: [
          "Des objectifs ambitieux qui poussent à se dépasser",
          "Des objectifs motivants présentés de manière inspirante",
          "Des objectifs progressifs qui respectent le rythme de chacun",
          "Des objectifs précis avec des indicateurs mesurables"
        ]
      },
      {
        id: 22,
        text: "Si tu devais décrire ton style de communication, ce serait :",
        options: [
          "Direct et efficace, je vais à l'essentiel",
          "Chaleureux et expressif, j'aime créer du lien",
          "Patient et à l'écoute, je prends le temps",
          "Précis et factuel, je m'appuie sur des données"
        ]
      },
      {
        id: 23,
        text: "Face à une deadline serrée, tu as tendance à :",
        options: [
          "Accélérer le rythme et exiger des résultats rapides",
          "Motiver l'équipe avec de l'énergie et de l'optimisme",
          "Garder ton calme et rassurer ton équipe",
          "Planifier méthodiquement chaque étape restante"
        ]
      },
      {
        id: 24,
        text: "Quand tu dois gérer plusieurs urgences en même temps, tu :",
        options: [
          "Priorises rapidement et prends des décisions fermes",
          "Mobilises l'équipe avec enthousiasme pour tout gérer ensemble",
          "Restes calme et traites chaque urgence méthodiquement",
          "Analyses la situation pour déterminer l'ordre logique d'intervention"
        ]
      },
      {
        id: 25,
        text: "Ton approche face à un nouveau projet ambitieux :",
        options: [
          "Je me lance immédiatement avec confiance",
          "J'embarque l'équipe avec une vision inspirante",
          "Je prends le temps d'évaluer tous les aspects avant de démarrer",
          "J'établis d'abord un plan détaillé avec toutes les étapes"
        ]
      },
      {
        id: 26,
        text: "Quand un membre de ton équipe fait une erreur importante :",
        options: [
          "J'interviens directement pour corriger et éviter que ça se reproduise",
          "J'en discute de manière positive pour maintenir la confiance",
          "Je prends le temps de comprendre les causes sans juger",
          "J'analyse précisément l'erreur pour mettre en place des garde-fous"
        ]
      },
      {
        id: 27,
        text: "Dans une négociation difficile avec ta hiérarchie, tu es :",
        options: [
          "Assertif et tu défends fermement les intérêts de ton équipe",
          "Persuasif et tu utilises ton réseau relationnel",
          "Patient et tu cherches un compromis acceptable",
          "Rationnel et tu présentes des arguments factuels solides"
        ]
      },
      {
        id: 28,
        text: "Ton style pour motiver ton équipe en période difficile :",
        options: [
          "Je fixe un cap clair et je montre l'exemple par l'action",
          "Je crée de l'énergie positive et je valorise chaque effort",
          "Je soutiens chacun individuellement avec empathie",
          "Je présente les données objectives pour rationaliser la situation"
        ]
      },
      {
        id: 29,
        text: "Dans l'organisation de ton temps de travail, tu privilégies :",
        options: [
          "L'efficacité et l'action immédiate",
          "La flexibilité pour être disponible pour l'équipe",
          "Une routine stable qui te permet d'être efficace",
          "Une planification rigoureuse de chaque activité"
        ]
      },
      {
        id: 30,
        text: "Quand tu dois implémenter un changement imposé par la direction :",
        options: [
          "Je l'applique rapidement sans tergiverser",
          "Je le présente de manière positive pour embarquer l'équipe",
          "Je prends le temps d'accompagner chacun dans la transition",
          "Je décortique le changement pour l'expliquer rationnellement"
        ]
      },
      {
        id: 31,
        text: "Ton rapport aux procédures et aux règles :",
        options: [
          "Je les adapte si ça permet d'être plus efficace",
          "Je les interprète avec souplesse selon les situations",
          "Je les suis car elles apportent de la stabilité",
          "Je les respecte strictement car elles garantissent la qualité"
        ]
      },
      {
        id: 32,
        text: "Ton environnement de travail idéal comme manager :",
        options: [
          "Dynamique avec des défis constants à relever",
          "Convivial avec des interactions fréquentes",
          "Stable avec des routines bien établies",
          "Structuré avec des process clairs et efficaces"
        ]
      },
      {
        id: 33,
        text: "Quand tu recrutes un nouveau collaborateur, tu cherches avant tout :",
        options: [
          "Quelqu'un de déterminé qui obtient des résultats",
          "Quelqu'un d'enthousiaste qui s'intègre facilement",
          "Quelqu'un de fiable et de constant dans l'effort",
          "Quelqu'un de compétent qui maîtrise son métier"
        ]
      },
      {
        id: 34,
        text: "Dans ta gestion des priorités quotidiennes :",
        options: [
          "Je me concentre sur ce qui a le plus d'impact immédiat",
          "Je jongle facilement entre plusieurs sujets selon les besoins",
          "Je traite mes tâches dans un ordre logique et prévisible",
          "Je classe tout par ordre d'importance et d'urgence"
        ]
      },
      {
        id: 35,
        text: "Face à un échec collectif de ton équipe :",
        options: [
          "Je tourne vite la page et je fixe un nouvel objectif",
          "Je dédramatise et je remobilise avec un discours positif",
          "Je rassure et j'accompagne chacun dans l'analyse",
          "Je décortique factuellement pour comprendre et éviter la répétition"
        ]
      }
    ]
  }
];

export default function ManagerDiagnosticForm({ onClose, onSuccess }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSelectOption = (questionId, option, optionIndex) => {
    // For DISC questions (11-34), store the index; for others, store the text
    const isDISCQuestion = questionId >= 11 && questionId <= 34;
    
    setResponses(prev => {
      const updated = {
        ...prev,
        [questionId]: isDISCQuestion ? optionIndex : option
      };
      console.log('Updated manager responses:', updated);
      return updated;
    });
  };

  const handleSubmit = async () => {
    // Check if all questions are answered
    const totalQuestions = questions.reduce((sum, section) => sum + section.items.length, 0);
    if (Object.keys(responses).length < totalQuestions) {
      toast.error('Merci de répondre à toutes les questions');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/manager-diagnostic`, { responses }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ton profil manager est prêt ! 🔥');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error submitting diagnostic:', err);
      toast.error('Erreur lors de l\'analyse du profil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-white" />
            <h2 className="text-2xl font-bold text-white">Identifier mon profil de management</h2>
          </div>
          <p className="text-white opacity-90">Découvre ton style de management dominant et reçois un coaching personnalisé.</p>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {questions.map((section, sectionIdx) => (
            <div key={sectionIdx} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">{section.section}</h3>
              
              {section.items.map((question) => (
                <div key={question.id} className="mb-6 bg-gray-50 rounded-xl p-5">
                  <p className="text-gray-800 font-medium mb-4">
                    {question.id}. {question.text}
                  </p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIdx) => {
                      const isDISCQuestion = question.id >= 11 && question.id <= 34;
                      const isSelected = isDISCQuestion 
                        ? responses[question.id] === optionIdx
                        : responses[question.id] === option;
                      
                      return (
                        <button
                          key={optionIdx}
                          onClick={() => handleSelectOption(question.id, option, optionIdx)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-20 font-medium'
                              : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-100'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {Object.keys(responses).length} / {questions.reduce((sum, s) => sum + s.items.length, 0)} questions répondues
          </p>
          <button
            onClick={handleSubmit}
            disabled={loading || Object.keys(responses).length < questions.reduce((sum, s) => sum + s.items.length, 0)}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyse en cours...' : 'Découvrir mon profil'}
          </button>
        </div>
      </div>
    </div>
  );
}
