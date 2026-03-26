import React, { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import questions from './diagnosticForm/questions';
import DiagnosticHeader from './diagnosticForm/DiagnosticHeader';
import DiagnosticQuestions from './diagnosticForm/DiagnosticQuestions';
import DiagnosticFooter from './diagnosticForm/DiagnosticFooter';

const totalQuestions = questions.reduce((sum, section) => sum + section.items.length, 0);

export default function DiagnosticFormScrollable({ onComplete, onClose, isModal = false }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAnswer = (questionId, answer) => {
    setResponses(prev => {
      const updated = { ...prev, [questionId]: answer };
      logger.log('Updated responses:', updated);
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
      // Convert responses object to list format expected by backend
      // Backend expects: List[Dict] with { question_id: Number, answer: String, question?: String }
      const responsesList = [];
      questions.forEach(section => {
        section.items.forEach(question => {
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

      // Backend expects the list directly, not wrapped in { responses: [...] }
      const aiResponse = await api.post('/ai/diagnostic', responsesList);

      // Save the diagnostic to database with the AI results
      // Backend scoring functions expect 0-based option INDEX (not text) for competence + DISC calculation
      const responsesDict = {};
      questions.forEach(section => {
        section.items.forEach(question => {
          const answerText = responses[question.id];
          if (answerText !== undefined && answerText !== null) {
            const idx = question.options.indexOf(answerText);
            responsesDict[question.id] = idx >= 0 ? idx : answerText;
          }
        });
      });

      // Save diagnostic with AI results included
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
        // Continue anyway - the AI analysis was successful
      }

      toast.success('Ton profil vendeur est prêt ! 🔥');
      if (onComplete) {
        onComplete(aiResponse.data);
      }
    } catch (err) {
      logger.error('Error submitting diagnostic:', err);
      logger.error('Error status:', err.response?.status);
      logger.error('Error data:', err.response?.data);
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'analyse du profil');
    } finally {
      setLoading(false);
    }
  };

  const containerContent = (
    <>
      <DiagnosticHeader isModal={isModal} onClose={onClose} />
      <DiagnosticQuestions
        questions={questions}
        responses={responses}
        onAnswer={handleAnswer}
        isModal={isModal}
      />
      <DiagnosticFooter
        answeredCount={Object.keys(responses).length}
        totalCount={totalQuestions}
        loading={loading}
        onSubmit={handleSubmit}
      />
    </>
  );

  if (isModal) {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget && onClose) { onClose(); } }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
          {containerContent}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {containerContent}
      </div>
    </div>
  );
}
