import React from 'react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import questions from './diagnosticForm/questions';
import DiagnosticFormBase from './DiagnosticFormBase';

export default function DiagnosticFormScrollable({ onComplete, onClose, isModal = false }) {
  const handleSubmit = async ({ responses, allQuestions }) => {
    try {
      // Pour l'IA : texte de la réponse (depuis l'index original stocké)
      const responsesList = allQuestions.map(q => ({
        question_id: Number(q.id),
        question: q.text,
        answer: q.options[responses[q.id]] ?? ""
      }));

      const aiResponse = await api.post('/ai/diagnostic', responsesList);

      // Pour le backend DISC : index original directement (plus de indexOf fragile)
      const responsesDict = {};
      allQuestions.forEach(q => {
        const idx = responses[q.id];
        if (idx !== undefined && idx !== null) {
          responsesDict[q.id] = idx;
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
      throw err;
    }
  };

  return (
    <DiagnosticFormBase
      questions={questions}
      title="Identifier mon profil vendeur"
      onSubmit={handleSubmit}
      onClose={onClose}
      isModal={isModal}
    />
  );
}
