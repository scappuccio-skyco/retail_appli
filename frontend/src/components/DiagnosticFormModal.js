import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
        text: "Qu'est-ce qui, selon toi, donne envie à un client de te faire confiance dès les premières secondes ?",
        type: "text"
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
        text: "Raconte une situation où tu as découvert un besoin caché chez un client.",
        type: "text"
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
        text: "Décris une fois où tu as su adapter ton discours pour convaincre un client difficile.",
        type: "text"
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
        type: "text"
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
        type: "text"
      }
    ]
  },
  {
    section: "🟡 Fidélisation Client",
    items: [
      {
        id: 13,
        text: "Après une vente, que fais-tu pour que le client revienne ?",
        type: "text"
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
        type: "text"
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
        <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 rounded-t-2xl relative">
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
                  ) : (
                    <textarea
                      value={responses[question.id] || ''}
                      onChange={(e) => handleAnswer(question.id, e.target.value)}
                      placeholder="Écris ta réponse ici..."
                      rows={4}
                      className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-[#ffd871] focus:outline-none resize-none"
                    />
                  )}
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
  {
    id: 17,
    theme: "Profil DISC 🎨",
    question: "Quand tu reçois un feedback négatif de ton manager, tu :",
    type: "choice",
    options: [
      "Cherches immédiatement à corriger et à prouver ta valeur",
      "Discutes avec tes collègues pour comprendre et garder le moral",
      "Prends du recul et réfléchis calmement à comment t'améliorer",
      "Analyses en détail ce qui n'a pas fonctionné pour ne plus recommencer"
    ]
  },
  {
    id: 18,
    theme: "Profil DISC 🎨",
    question: "Dans ton quotidien de vente, tu es plus à l'aise avec :",
    type: "choice",
    options: [
      "Les challenges et les objectifs ambitieux à atteindre",
      "Les interactions sociales et la création de liens",
      "Les routines stables et un environnement prévisible",
      "Les procédures claires et les méthodes bien définies"
    ]
  },
  {
    id: 19,
    theme: "Profil DISC 🎨",
    question: "Quand tu dois travailler en équipe sur un projet, tu as tendance à :",
    type: "choice",
    options: [
      "Prendre la lead et organiser le travail des autres",
      "Créer une bonne ambiance et motiver tout le monde",
      "Soutenir l'équipe et t'assurer que chacun se sent bien",
      "Vérifier que tout est bien fait selon les standards"
    ]
  },
  {
    id: 20,
    theme: "Profil DISC 🎨",
    question: "Face à un changement de procédure dans le magasin, tu :",
    type: "choice",
    options: [
      "T'adaptes rapidement et cherches à optimiser la nouvelle façon de faire",
      "Partages ton enthousiasme et aides les autres à s'adapter",
      "As besoin de temps pour comprendre et intégrer le changement",
      "Vérifies tous les détails pour t'assurer de bien appliquer la nouvelle procédure"
    ]
  },
  {
    id: 21,
    theme: "Profil DISC 🎨",
    question: "Ton style de communication avec les clients, c'est plutôt :",
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
    theme: "Profil DISC 🎨",
    question: "Ce qui te motive le plus dans la vente, c'est :",
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
    theme: "Profil DISC 🎨",
    question: "En fin de journée chargée, tu es plutôt :",
    type: "choice",
    options: [
      "Energisé par les résultats et prêt à recommencer demain",
      "Content des belles interactions que tu as eues",
      "Soulagé que tout se soit bien passé sans accroc",
      "Satisfait d'avoir bien respecté toutes les procédures"
    ]
  }
];

export default function DiagnosticFormModal({ onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentQuestion = QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;
  const questionsRemaining = QUESTIONS.length - (currentStep + 1);

  const handleAnswer = useCallback((answer, optionIndex = null) => {
    if (isTransitioning || loading) return;
    // For DISC questions (16-23), store the index if provided; otherwise store the text
    const isDISCQuestion = currentQuestion.id >= 16 && currentQuestion.id <= 23;
    const valueToStore = (isDISCQuestion && optionIndex !== null) ? optionIndex : answer;
    setResponses(prev => ({ ...prev, [currentQuestion.id]: valueToStore }));
  }, [currentQuestion.id, isTransitioning, loading]);

  const canGoNext = useCallback(() => {
    const answer = responses[currentQuestion.id];
    return answer && answer.trim() !== '';
  }, [responses, currentQuestion.id]);

  const handleNext = useCallback(() => {
    if (isTransitioning || loading) return;
    
    if (currentStep < QUESTIONS.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 200);
    } else {
      handleSubmit();
    }
  }, [currentStep, isTransitioning, loading]);

  const handleBack = useCallback(() => {
    if (isTransitioning || currentStep === 0 || loading) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsTransitioning(false);
    }, 200);
  }, [currentStep, isTransitioning, loading]);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/diagnostic`, { responses }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Diagnostic complété avec succès!');
      onSuccess();
    } catch (err) {
      console.error('Diagnostic error:', err);
      toast.error('Erreur lors du diagnostic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 rounded-t-2xl relative z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-xl shadow-md object-cover" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Diagnostic vendeur</h2>
              <p className="text-sm text-gray-700">{questionsRemaining} questions restantes</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {currentStep + 1} sur {QUESTIONS.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#ffd871] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Theme Badge */}
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-[#ffd871] bg-opacity-20 rounded-full text-sm font-medium text-gray-800">
              {currentQuestion.theme}
            </span>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h3>

            {currentQuestion.type === 'choice' ? (
              <div className="space-y-3">
                {currentQuestion.options.map((option, optIndex) => {
                  const isSelected = responses[currentQuestion.id] === option || responses[currentQuestion.id] === optIndex;
                  return (
                    <div
                      key={optIndex}
                      onClick={() => handleAnswer(option, optIndex)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                          : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-50'
                      } ${(isTransitioning || loading) ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      <p className="text-gray-800">{option}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={responses[currentQuestion.id] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Écris ta réponse ici..."
                className="w-full min-h-[150px] p-4 border-2 border-gray-200 rounded-xl focus:border-[#ffd871] focus:outline-none resize-none"
                disabled={isTransitioning || loading}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isTransitioning || loading}
              className="btn-secondary px-6 py-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Précédent
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext() || isTransitioning || loading}
              className="flex-1 btn-primary px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Analyse en cours...'
              ) : currentStep === QUESTIONS.length - 1 ? (
                'Terminer'
              ) : (
                <>
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
