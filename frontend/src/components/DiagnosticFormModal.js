import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Questions organisées par sections comme le manager
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
          "Mon professionnalisme et ma présentation",
          "Ma connaissance des produits"
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
    section: "🟡 Découverte des Besoins",
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
          "Je lui propose de rejoindre le programme de fidélité",
          "Je prends ses coordonnées pour le tenir informé",
          "Je lui donne des conseils d'utilisation personnalisés",
          "Je lui parle des prochaines nouveautés"
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
          "La qualité du service et l'attention portée",
          "Les prix compétitifs et les promotions",
          "La relation personnelle créée avec lui",
          "La qualité constante des produits"
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
      }
    ]
  }
];

export default function DiagnosticFormModal({ onClose, onSuccess }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAnswer = (questionId, answer, optionIndex = null) => {
    // For DISC questions (16-23), store the index; for others, store the text
    const isDISCQuestion = questionId >= 16 && questionId <= 23;
    const valueToStore = (isDISCQuestion && optionIndex !== null) ? optionIndex : answer;
    setResponses(prev => ({
      ...prev,
      [questionId]: valueToStore
    }));
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
      await axios.post(`${API}/diagnostic`, { responses }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Ton profil vendeur est prêt ! 🔥');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-gray-800" />
            <h2 className="text-2xl font-bold text-gray-800">Identifier mon profil vendeur</h2>
          </div>
          <p className="text-gray-700">Découvre ton style de vente et ton profil DISC pour recevoir un coaching personnalisé.</p>
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
                  
                  {question.type === 'choice' ? (
                    <div className="space-y-2">
                      {question.options.map((option, optionIdx) => (
                        <button
                          key={optionIdx}
                          onClick={() => handleAnswer(question.id, option, optionIdx)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            responses[question.id] === option || responses[question.id] === optionIdx
                              ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-20 font-medium'
                              : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-100'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
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
