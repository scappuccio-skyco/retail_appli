import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import questions from './diagnosticForm/questions';

// Flatten all questions into a single ordered list, keeping section info
const allQuestions = questions.flatMap((section, sectionIdx) =>
  section.items.map(q => ({ ...q, section: section.section, sectionIdx }))
);
const totalQuestions = allQuestions.length;

export default function DiagnosticFormScrollable({ onComplete, onClose, isModal = false }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const question = allQuestions[currentIdx];
  const isLastQuestion = currentIdx === totalQuestions - 1;
  const currentAnswer = responses[question.id];
  const progress = ((currentIdx) / totalQuestions) * 100;

  // Auto-advance after selection (small delay for visual feedback)
  const handleAnswer = (answer) => {
    const updated = { ...responses, [question.id]: answer };
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
      const responsesList = allQuestions.map(q => ({
        question_id: Number(q.id),
        question: q.text,
        answer: String(responses[q.id] ?? "")
      }));

      const aiResponse = await api.post('/ai/diagnostic', responsesList);

      const responsesDict = {};
      allQuestions.forEach(q => {
        const answerText = responses[q.id];
        if (answerText !== undefined && answerText !== null) {
          const idx = q.options.indexOf(answerText);
          responsesDict[q.id] = idx >= 0 ? idx : answerText;
        }
      });

      try {
        await api.post('/seller/diagnostic', {
          responses: responsesDict,
          style: aiResponse.data?.style,
          level: aiResponse.data?.level,
          motivation: aiResponse.data?.motivation,
          strengths: aiResponse.data?.strengths,
          axes_de_developpement: aiResponse.data?.axes_de_developpement,
          ai_profile_summary: aiResponse.data?.ai_profile_summary
        });
      } catch (saveErr) {
        logger.error('Error saving diagnostic:', saveErr);
      }

      toast.success('Ton profil vendeur est prêt ! 🔥');
      if (onComplete) onComplete(aiResponse.data);
    } catch (err) {
      logger.error('Error submitting diagnostic:', err);
      toast.error(err.response?.data?.detail || "Erreur lors de l'analyse du profil");
    } finally {
      setLoading(false);
    }
  };

  const inner = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] px-6 py-4 rounded-t-2xl relative flex-shrink-0">
        {isModal && onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-base">Identifier mon profil vendeur</span>
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
          {question.options.map((option, idx) => {
            const isSelected = currentAnswer === option;
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(option)}
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

        {isLastQuestion && currentAnswer && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6"
          >
            {loading ? 'Analyse en cours...' : '🔍 Analyser mon profil'}
          </button>
        )}

        {!isLastQuestion && currentAnswer && (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {!isLastQuestion && !currentAnswer && (
          <span className="text-xs text-gray-400">Sélectionne une réponse</span>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[85vh] max-h-[680px] flex flex-col">
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg min-h-[500px] flex flex-col">
      {inner}
    </div>
  );
}
