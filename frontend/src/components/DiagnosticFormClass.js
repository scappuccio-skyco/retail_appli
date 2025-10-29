import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import ErrorBoundary from './ErrorBoundary';

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
    question: "Quand tu présentes un produit, qu'est-ce que tu cherches avant tout ?",
    type: "choice",
    options: [
      "Donner envie en racontant une histoire ou une émotion.",
      "Montrer ce qui correspond exactement à son besoin.",
      "Mettre en avant les différences avec les autres produits."
    ]
  },
  {
    id: 6,
    theme: "Découverte 🔍",
    question: "Un client hésite entre deux produits. Que fais-tu ?",
    type: "choice",
    options: [
      "Je lui reformule ses priorités pour l'aider à trancher.",
      "Je lui montre la différence directement, visuellement ou par essai.",
      "Je propose le produit avec le meilleur rapport qualité-prix."
    ]
  },
  {
    id: 7,
    theme: "Vente 💬",
    question: 'Quand un client dit : "Je vais réfléchir", tu réagis comment ?',
    type: "choice",
    options: [
      "Je le laisse partir avec un mot gentil.",
      "Je lui rappelle l'avantage principal du produit.",
      "Je lui propose de repasser ou de réserver l'article."
    ]
  },
  {
    id: 8,
    theme: "Vente 💬",
    question: "Qu'est-ce qui, selon toi, fait la différence entre une vente réussie et une vente ratée ?",
    type: "text"
  },
  {
    id: 9,
    theme: "Conclusion 💰",
    question: "Après la vente, tu fais quoi ?",
    type: "choice",
    options: [
      "Je le remercie simplement avec le sourire.",
      "Je parle d'une nouveauté ou d'une prochaine visite.",
      "Je note une info sur lui pour mieux le reconnaître la prochaine fois."
    ]
  },
  {
    id: 10,
    theme: "Conclusion 💰",
    question: "Comment fais-tu pour qu'un client se souvienne de toi ?",
    type: "text"
  },
  {
    id: 11,
    theme: "Fidélisation 💌",
    question: "Quand une vente ne se conclut pas, tu ressens plutôt :",
    type: "choice",
    options: [
      "De la frustration, j'aurais voulu mieux faire.",
      "De la déception, mais je passe vite à autre chose.",
      "De la curiosité : j'essaie de comprendre pourquoi."
    ]
  },
  {
    id: 12,
    theme: "Motivation ⚙️",
    question: "Dans une journée difficile, qu'est-ce qui te redonne de l'énergie ?",
    type: "choice",
    options: [
      "Le contact avec un client sympa.",
      "Un mot positif d'un collègue ou du manager.",
      "Un challenge ou un objectif à atteindre."
    ]
  },
  {
    id: 13,
    theme: "Motivation ⚙️",
    question: "Ce que tu préfères dans ton métier de vendeur, c'est :",
    type: "choice",
    options: [
      "Le contact avec les gens.",
      "Les défis et les résultats.",
      "Apprendre et parler des produits."
    ]
  },
  {
    id: 14,
    theme: "Motivation ⚙️",
    question: "Si tu devais choisir une phrase qui te ressemble le plus :",
    type: "choice",
    options: [
      '"Je veux que mes clients passent un bon moment."',
      '"Je veux que mes ventes montent en flèche."',
      '"Je veux devenir un vrai expert dans ce que je vends."'
    ]
  },
  {
    id: 15,
    theme: "Motivation ⚙️",
    question: "En un mot, comment te décrirais-tu en tant que vendeur ?",
    type: "text"
  }
];

class DiagnosticFormClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentStep: 0,
      responses: {},
      loading: false
    };
  }

  handleAnswer = (answer) => {
    if (this.state.loading) return;
    const currentQuestion = QUESTIONS[this.state.currentStep];
    this.setState({
      responses: {
        ...this.state.responses,
        [currentQuestion.id]: answer
      }
    });
  }

  handleNext = () => {
    if (this.state.loading) return;
    const currentQuestion = QUESTIONS[this.state.currentStep];
    const answer = this.state.responses[currentQuestion.id];
    
    if (!answer || answer.trim() === '') return;
    
    if (this.state.currentStep < QUESTIONS.length - 1) {
      this.setState({ currentStep: this.state.currentStep + 1 });
    } else {
      this.handleSubmit();
    }
  }

  handleBack = () => {
    if (this.state.loading || this.state.currentStep === 0) return;
    this.setState({ currentStep: this.state.currentStep - 1 });
  }

  handleSubmit = async () => {
    if (this.state.loading) return;
    this.setState({ loading: true });
    
    try {
      await axios.post(`${API}/diagnostic`, { responses: this.state.responses });
      toast.success('Diagnostic complété avec succès!');
      
      // Force complete reload to refresh diagnostic status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'envoi du diagnostic');
      this.setState({ loading: false });
    }
  }

  render() {
    const { currentStep, responses, loading } = this.state;
    const currentQuestion = QUESTIONS[currentStep];
    const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fffef9] to-[#fff9e6]">
        <div className="w-full max-w-3xl">
          <div className="glass-morphism rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <img src="/logo.jpg" alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-xl shadow-md object-cover" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Diagnostic vendeur avancé</h1>
              <p className="text-gray-600">Découvre ton profil de vendeur en moins de 10 minutes</p>
            </div>

            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Question {currentStep + 1} sur {QUESTIONS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#ffd871] h-3 rounded-full"
                  style={{ width: `${progress}%`, transition: 'width 0.3s' }}
                />
              </div>
            </div>

            <div className="mb-6">
              <span className="inline-block px-4 py-2 bg-[#ffd871] bg-opacity-20 rounded-full text-sm font-medium text-gray-800">
                {currentQuestion.theme}
              </span>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {currentQuestion.question}
              </h2>

              {currentQuestion.type === 'choice' ? (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = responses[currentQuestion.id] === option;
                    return (
                      <div
                        key={index}
                        onClick={() => this.handleAnswer(option)}
                        className={`w-full text-left p-4 rounded-xl border-2 cursor-pointer ${
                          isSelected
                            ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                            : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-50'
                        }`}
                      >
                        <p className="text-gray-800">{option}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={responses[currentQuestion.id] || ''}
                  onChange={(e) => this.handleAnswer(e.target.value)}
                  disabled={loading}
                  placeholder="Écris ta réponse ici..."
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none disabled:bg-gray-50"
                />
              )}
            </div>

            <div className="flex justify-between gap-4">
              <div
                onClick={this.handleBack}
                className={`px-6 py-3 bg-white text-gray-700 rounded-full font-medium shadow-md border border-gray-200 flex items-center gap-2 ${
                  currentStep === 0 || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                }`}
              >
                <span>←</span>
                Précédent
              </div>

              <div
                onClick={this.handleNext}
                className={`px-6 py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold shadow-lg flex items-center gap-2 ${
                  !responses[currentQuestion.id] || responses[currentQuestion.id].trim() === '' || loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:shadow-xl hover:scale-105'
                }`}
              >
                {loading ? (
                  'Analyse en cours...'
                ) : currentStep === QUESTIONS.length - 1 ? (
                  'Terminer'
                ) : (
                  <>
                    Suivant
                    <span>→</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default function DiagnosticFormWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <DiagnosticFormClass />
    </ErrorBoundary>
  );
}
