import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

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

export default function DiagnosticFormScrollable({ onComplete }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAnswer = (questionId, answer) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
  };

  const isComplete = () => {
    return QUESTIONS.every(q => {
      const answer = responses[q.id];
      return answer && answer.toString().trim() !== '';
    });
  };

  const handleSubmit = async () => {
    if (loading || !isComplete()) return;
    
    setLoading(true);
    console.log('🎯 Starting diagnostic submission with responses:', responses);
    
    try {
      const response = await axios.post(`${API}/diagnostic`, { responses });
      console.log('✅ Diagnostic submission successful:', response.data);
      toast.success('Diagnostic complété avec succès!');
      
      // Wait for toast then call onComplete
      setTimeout(() => {
        console.log('🎯 Calling onComplete callback...');
        if (onComplete) {
          onComplete(response.data);
        } else {
          console.error('❌ No onComplete callback provided');
          window.location.href = '/';
        }
      }, 1500);
      
    } catch (err) {
      console.error('❌ Diagnostic submission error:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'envoi du diagnostic');
      setLoading(false);
    }
  };

  const answeredCount = Object.keys(responses).filter(k => responses[k] && responses[k].toString().trim() !== '').length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-[#fffef9] to-[#fff9e6]">
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="glass-morphism rounded-3xl shadow-2xl p-8 mb-6 sticky top-4 z-10">
          <div className="text-center mb-4">
            <img src="/logo.jpg" alt="Logo" className="w-16 h-16 mx-auto mb-3 rounded-xl shadow-md object-cover" />
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Diagnostic vendeur avancé</h1>
            <p className="text-gray-600 text-sm">Réponds à toutes les questions ci-dessous</p>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{answeredCount} / {QUESTIONS.length} questions répondues</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#ffd871] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isComplete() || loading}
            className={`w-full py-3 rounded-full font-semibold shadow-lg transition-all ${
              isComplete() && !loading
                ? 'bg-[#ffd871] text-gray-800 hover:shadow-xl hover:scale-105 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
            }`}
          >
            {loading ? 'Analyse en cours...' : isComplete() ? 'Terminer le diagnostic' : `Réponds aux ${QUESTIONS.length - answeredCount} questions restantes`}
          </button>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {QUESTIONS.map((question, index) => (
            <div key={question.id} className="glass-morphism rounded-2xl p-6 shadow-lg">
              {/* Question Header */}
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-[#ffd871] bg-opacity-20 rounded-full text-xs font-medium text-gray-800 mb-2">
                  {question.theme}
                </span>
                <h3 className="text-lg font-semibold text-gray-800">
                  {index + 1}. {question.question}
                </h3>
              </div>

              {/* Answer Options */}
              {question.type === 'choice' ? (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => {
                    const isSelected = responses[question.id] === option;
                    return (
                      <div
                        key={optIndex}
                        onClick={() => handleAnswer(question.id, option)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                            : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-50'
                        }`}
                      >
                        <p className="text-gray-800 text-sm">{option}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={responses[question.id] || ''}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  placeholder="Écris ta réponse ici..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
