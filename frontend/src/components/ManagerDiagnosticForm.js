import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const questions = [
  {
    section: "🟡 Ton style de management",
    items: [
      {
        id: 1,
        text: "Quand ton équipe rencontre une difficulté, ta première réaction est de :",
        options: [
          "Chercher à comprendre individuellement ce qui bloque",
          "Trouver une solution rapide et passer à l'action",
          "Encourager tout le monde pour garder le moral",
          "Vérifier les indicateurs pour objectiver le problème",
          "Recadrer pour remettre de la rigueur"
        ]
      },
      {
        id: 2,
        text: "En briefing, tu es plutôt du genre à :",
        options: [
          "Dynamiser et créer de l'énergie dans le groupe",
          "Délivrer un message clair, précis et orienté résultats",
          "Poser des questions et impliquer chacun dans la réflexion",
          "Cadrer les priorités et rappeler les process",
          "Mettre en avant les réussites de ton équipe"
        ]
      },
      {
        id: 3,
        text: "Quand un collaborateur n'atteint pas ses objectifs, tu :",
        options: [
          "Cherches à comprendre le \"pourquoi\" avant de juger",
          "Fixes un plan d'action concret et mesurable",
          "Encourages et motives pour qu'il retrouve confiance",
          "Reformules la méthode pour qu'il suive les bonnes étapes",
          "Rappelles l'importance du cadre et des attentes"
        ]
      }
    ]
  },
  {
    section: "🟡 Ta posture de performance",
    items: [
      {
        id: 4,
        text: "Tu te sens le plus efficace quand :",
        options: [
          "Ton équipe est engagée et autonome",
          "Les chiffres progressent et les objectifs sont clairs",
          "L'ambiance est positive et tout le monde se parle",
          "Les process tournent bien sans que tu aies à intervenir",
          "Tu formes et accompagnes un collaborateur à réussir"
        ]
      },
      {
        id: 5,
        text: "Quand tu prépares un brief ou un coaching, tu penses d'abord à :",
        options: [
          "Ce que tu veux faire ressentir",
          "Les résultats à atteindre",
          "Les comportements à améliorer",
          "La méthode à transmettre",
          "Le message clé à faire passer"
        ]
      },
      {
        id: 6,
        text: "Ce que tu regardes le plus souvent pour piloter ton équipe :",
        options: [
          "Le moral et la cohésion du groupe",
          "Les ventes, taux de transfo, panier moyen",
          "Les comportements observés en boutique",
          "Le respect du cadre (planning, procédures, standards)",
          "Les progressions individuelles"
        ]
      }
    ]
  },
  {
    section: "🟡 Ta motivation managériale",
    items: [
      {
        id: 7,
        text: "Ce qui te motive le plus dans ton rôle de manager :",
        options: [
          "Voir ton équipe s'épanouir et progresser",
          "Atteindre les objectifs et performer",
          "Créer une belle dynamique collective",
          "Faire respecter une organisation fluide et efficace",
          "Transmettre ton expérience"
        ]
      },
      {
        id: 8,
        text: "Quand tout va bien, ton réflexe est de :",
        options: [
          "Féliciter et célébrer les réussites",
          "Fixer un nouveau challenge",
          "Renforcer la cohésion du groupe",
          "Capitaliser pour formaliser la méthode",
          "Former sur ce qui a bien fonctionné"
        ]
      },
      {
        id: 9,
        text: "Et quand ça va moins bien, tu :",
        options: [
          "Écoutes et accompagnes avec empathie",
          "Rappelles les priorités et recentres l'énergie",
          "Boostes l'équipe avec une communication positive",
          "Cherches la cause racine pour corriger durablement",
          "Soutiens et reformules pour aider à retrouver confiance"
        ]
      },
      {
        id: 10,
        text: "Si tu devais résumer ta mission de manager en une phrase, ce serait :",
        options: [
          "Faire grandir les autres",
          "Atteindre les objectifs",
          "Créer de la motivation collective",
          "Garantir la rigueur et l'efficacité",
          "Transmettre une méthode gagnante"
        ]
      }
    ]
  }
];

export default function ManagerDiagnosticForm({ onClose, onSuccess }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSelectOption = (questionId, option) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: option
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
      await axios.post(`${API}/manager-diagnostic`, { responses });
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
            <h2 className="text-2xl font-bold text-gray-800">Identifier mon profil de management</h2>
          </div>
          <p className="text-gray-700">Découvre ton style de management dominant et reçois un coaching personnalisé.</p>
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
                    {question.options.map((option, optionIdx) => (
                      <button
                        key={optionIdx}
                        onClick={() => handleSelectOption(question.id, option)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          responses[question.id] === option
                            ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-20 font-medium'
                            : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-100'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
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
