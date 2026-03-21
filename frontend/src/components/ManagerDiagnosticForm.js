import React, { useState } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { Sparkles, X } from 'lucide-react';
import questions from './managerDiagnosticForm/questions';

const totalQuestions = questions.reduce((sum, s) => sum + s.items.length, 0);

export default function ManagerDiagnosticForm({ onClose, onSuccess }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSelectOption = (questionId, optionIndex) => {
    setResponses(prev => {
      const updated = { ...prev, [questionId]: optionIndex };
      logger.log('Updated manager responses:', updated);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(responses).length < totalQuestions) {
      toast.error('Merci de répondre à toutes les questions');
      return;
    }
    setLoading(true);
    try {
      const richResponses = {};
      questions.forEach(section => {
        section.items.forEach(question => {
          const answerIdx = responses[question.id];
          if (answerIdx !== undefined && answerIdx !== null) {
            richResponses[question.id] = { q: question.text, a: question.options[answerIdx] };
          }
        });
      });
      await api.post('/manager-diagnostic', { responses: richResponses });
      toast.success('Ton profil manager est prêt ! 🔥');
      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Error submitting diagnostic:', err);
      toast.error("Erreur lors de l'analyse du profil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
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
                  <p className="text-gray-800 font-medium mb-4">{question.id}. {question.text}</p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIdx) => (
                      <button
                        key={optionIdx}
                        onClick={() => handleSelectOption(question.id, optionIdx)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          responses[question.id] === optionIdx
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
            {Object.keys(responses).length} / {totalQuestions} questions répondues
          </p>
          <button
            onClick={handleSubmit}
            disabled={loading || Object.keys(responses).length < totalQuestions}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyse en cours...' : 'Découvrir mon profil'}
          </button>
        </div>
      </div>
    </div>
  );
}
