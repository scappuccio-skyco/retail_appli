import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import questions from './diagnosticForm/questions';
import DiagnosticHeader from './diagnosticForm/DiagnosticHeader';

const totalQuestions = questions.reduce((sum, section) => sum + section.items.length, 0);

export default function DiagnosticFormScrollable({ onComplete, onClose, isModal = false }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const contentRef = useRef(null);

  const section = questions[currentSection];
  const isLastSection = currentSection === questions.length - 1;
  const sectionAnswered = section.items.every(q => responses[q.id] !== undefined);
  const answeredCount = Object.keys(responses).length;

  const scrollTop = () => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  const handleAnswer = (questionId, answer) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (!sectionAnswered) return;
    setCurrentSection(s => s + 1);
    scrollTop();
  };

  const handlePrev = () => {
    setCurrentSection(s => s - 1);
    scrollTop();
  };

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) {
      toast.error('Merci de répondre à toutes les questions');
      return;
    }

    setLoading(true);
    try {
      const responsesList = [];
      questions.forEach(sec => {
        sec.items.forEach(question => {
          const answer = responses[question.id];
          if (answer !== undefined && answer !== null) {
            responsesList.push({
              question_id: Number(question.id),
              question: question.text,
              answer: String(answer ?? "")
            });
          }
        });
      });

      const aiResponse = await api.post('/ai/diagnostic', responsesList);

      const responsesDict = {};
      questions.forEach(sec => {
        sec.items.forEach(question => {
          const answerText = responses[question.id];
          if (answerText !== undefined && answerText !== null) {
            const idx = question.options.indexOf(answerText);
            responsesDict[question.id] = idx >= 0 ? idx : answerText;
          }
        });
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

  const containerContent = (
    <>
      <DiagnosticHeader isModal={isModal} onClose={onClose} />

      {/* Progress bar */}
      <div className="px-6 pt-5 pb-2 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Étape {currentSection + 1} / {questions.length}
          </span>
          <span className="text-xs text-gray-400">{answeredCount} / {totalQuestions} réponses</span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, idx) => {
            const sectionDone = questions[idx].items.every(q => responses[q.id] !== undefined);
            return (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  idx < currentSection || sectionDone
                    ? 'bg-[#1E40AF]'
                    : idx === currentSection
                    ? 'bg-blue-300'
                    : 'bg-gray-200'
                }`}
              />
            );
          })}
        </div>
        <p className="mt-3 text-sm font-semibold text-gray-700">{section.section}</p>
      </div>

      {/* Questions */}
      <div ref={contentRef} className={`p-6 ${isModal ? 'overflow-y-auto flex-1' : ''}`}>
        <div className="space-y-5">
          {section.items.map((question) => (
            <div key={question.id} className="bg-gray-50 rounded-xl p-5">
              <p className="text-gray-800 font-medium mb-4">
                {question.text}
              </p>
              <div className="space-y-2">
                {question.options.map((option, optionIdx) => {
                  const isSelected = responses[question.id] === option;
                  return (
                    <button
                      key={optionIdx}
                      onClick={() => handleAnswer(question.id, option)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-[#1E40AF] bg-blue-50 font-medium'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-100'
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
      </div>

      {/* Navigation */}
      <div className="p-5 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-3">
        <button
          onClick={handlePrev}
          disabled={currentSection === 0}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>

        {isLastSection ? (
          <button
            onClick={handleSubmit}
            disabled={loading || !sectionAnswered}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyse en cours...' : '🔍 Analyser mon profil'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!sectionAnswered}
            className="flex items-center gap-1 px-6 py-2 text-sm font-semibold bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {containerContent}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg">
      {containerContent}
    </div>
  );
}
