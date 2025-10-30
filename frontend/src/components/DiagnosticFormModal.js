import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QUESTIONS = [
  {
    id: 1,
    theme: "Accueil 👋",
    question: "Un client entre alors que tu termines une vente. Que fais-tu ?",
    type: "choice",
    options: [
      "Je lui fais un signe ou un mot pour lui montrer que je l'ai vu.",
      "Je finis ma vente et je vais le voir ensuite.",
      "J'envoie un regard ou un sourire, mais je reste concentré sur mon client actuel."
    ]
  },
  {
    id: 2,
    theme: "Accueil 👋",
    question: "Qu'est-ce qui, selon toi, donne envie à un client de te faire confiance dès les premières secondes ?",
    type: "text"
  },
  {
    id: 3,
    theme: "Accueil 👋",
    question: 'Un client te dit : "Je cherche un cadeau mais je ne sais pas trop quoi."',
    type: "choice",
    options: [
      "Je lui montre quelques idées pour l'inspirer.",
      "Je lui pose des questions pour savoir à qui c'est destiné.",
      "Je lui demande ce qu'il a déjà offert pour éviter les doublons."
    ]
  },
  {
    id: 4,
    theme: "Découverte 🔍",
    question: "Quand un client parle beaucoup, comment réagis-tu ?",
    type: "choice",
    options: [
      "Je l'écoute attentivement pour trouver ce qu'il veut vraiment.",
      "J'essaie de recentrer doucement la conversation.",
      "Je partage aussi pour créer une vraie discussion."
    ]
  },
  {
    id: 5,
    theme: "Découverte 🔍",
    question: "Raconte une situation où tu as découvert un besoin caché chez un client.",
    type: "text"
  },
  {
    id: 6,
    theme: "Découverte 🔍",
    question: 'Un client répond : "Je cherche juste à comparer." Que fais-tu ?',
    type: "choice",
    options: [
      "Je lui demande ce qu'il compare pour mieux le conseiller.",
      "Je lui propose mes meilleures offres pour le convaincre.",
      "Je respecte sa démarche et reste disponible."
    ]
  },
  {
    id: 7,
    theme: "Argumentation 💬",
    question: "Comment présentes-tu un produit à un client hésitant ?",
    type: "choice",
    options: [
      "Je mets en avant les caractéristiques techniques.",
      "Je montre comment ça répond à ses besoins.",
      "Je partage des avis d'autres clients satisfaits."
    ]
  },
  {
    id: 8,
    theme: "Argumentation 💬",
    question: "Décris une fois où tu as su adapter ton discours pour convaincre un client difficile.",
    type: "text"
  },
  {
    id: 9,
    theme: "Argumentation 💬",
    question: 'Un client dit : "C\'est trop cher." Quelle est ta première réaction ?',
    type: "choice",
    options: [
      "Je justifie le prix en expliquant la valeur.",
      "Je propose une alternative moins chère.",
      "Je comprends son budget et j'adapte ma proposition."
    ]
  },
  {
    id: 10,
    theme: "Closing 🎯",
    question: "Comment sais-tu qu'un client est prêt à acheter ?",
    type: "text"
  },
  {
    id: 11,
    theme: "Closing 🎯",
    question: "Un client hésite encore après toutes tes explications. Que fais-tu ?",
    type: "choice",
    options: [
      "Je le relance gentiment pour le rassurer.",
      "Je lui laisse du temps pour réfléchir.",
      "Je lui propose un dernier argument décisif."
    ]
  },
  {
    id: 12,
    theme: "Closing 🎯",
    question: "Quelle est ta technique préférée pour finaliser une vente ?",
    type: "text"
  },
  {
    id: 13,
    theme: "Fidélisation 🤝",
    question: "Après une vente, que fais-tu pour que le client revienne ?",
    type: "text"
  },
  {
    id: 14,
    theme: "Fidélisation 🤝",
    question: 'Un ancien client revient avec un problème sur son achat. Tu fais quoi ?',
    type: "choice",
    options: [
      "Je trouve une solution rapidement pour le satisfaire.",
      "Je l'écoute d'abord pour comprendre le problème.",
      "Je lui propose une compensation pour garder sa confiance."
    ]
  },
  {
    id: 15,
    theme: "Fidélisation 🤝",
    question: "Qu'est-ce qui fait qu'un client devient fidèle selon toi ?",
    type: "text"
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

  const handleAnswer = useCallback((answer) => {
    if (isTransitioning || loading) return;
    setResponses(prev => ({ ...prev, [currentQuestion.id]: answer }));
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
                  const isSelected = responses[currentQuestion.id] === option;
                  return (
                    <div
                      key={optIndex}
                      onClick={() => handleAnswer(option)}
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
