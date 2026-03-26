import React, { useState } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import questions from './managerDiagnosticForm/questions';

// Flatten all questions into a single ordered list, keeping section info
const allQuestions = questions.flatMap((section) =>
  section.items.map(q => ({ ...q, section: section.section }))
);
const totalQuestions = allQuestions.length;

export default function ManagerDiagnosticForm({ onClose, onSuccess }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const question = allQuestions[currentIdx];
  const isLastQuestion = currentIdx === totalQuestions - 1;
  const currentAnswer = responses[question.id];
  const progress = (currentIdx / totalQuestions) * 100;

  const handleSelectOption = (optionIndex) => {
    const updated = { ...responses, [question.id]: optionIndex };
    setResponses(updated);

    if (!isLastQuestion) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIdx(i => i + 1);
        setAnimating(false);
      }, 300);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) setCurrentIdx(i => i + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const richResponses = {};
      allQuestions.forEach(q => {
        const answerIdx = responses[q.id];
        if (answerIdx !== undefined && answerIdx !== null) {
          richResponses[q.id] = { q: q.text, a: q.options[answerIdx], idx: answerIdx };
        }
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
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[85vh] max-h-[680px] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] px-6 py-4 rounded-t-2xl relative flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-base">Identifier mon profil de management</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5 mt-2">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white text-opacity-80 text-xs">{question.section}</span>
            <span className="text-white text-opacity-70 text-xs">{currentIdx + 1} / {totalQuestions}</span>
          </div>
        </div>

        {/* Question */}
        <div className={`flex-1 p-6 flex flex-col justify-center transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-gray-800 font-semibold text-lg mb-6 leading-relaxed">
            {question.text}
          </p>

          <div className="space-y-3">
            {question.options.map((option, optionIdx) => {
              const isSelected = currentAnswer === optionIdx;
              return (
                <button
                  key={optionIdx}
                  onClick={() => handleSelectOption(optionIdx)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm font-medium ${
                    isSelected
                      ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>

          {isLastQuestion && currentAnswer !== undefined ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6"
            >
              {loading ? 'Analyse en cours...' : '🔍 Analyser mon profil'}
            </button>
          ) : currentAnswer !== undefined ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-xs text-gray-400">Sélectionne une réponse</span>
          )}
        </div>
      </div>
    </div>
  );
}
