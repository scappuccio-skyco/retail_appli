import React from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import questions from './managerDiagnosticForm/questions';
import DiagnosticFormBase from './DiagnosticFormBase';

export default function ManagerDiagnosticForm({ onClose, onSuccess }) {
  const handleSubmit = async ({ responses, allQuestions }) => {
    try {
      const richResponses = {};
      allQuestions.forEach(q => {
        const answerIdx = responses[q.id];
        if (answerIdx !== undefined && answerIdx !== null) {
          richResponses[q.id] = { q: q.text, a: q.options[answerIdx], idx: answerIdx };
        }
      });
      const res = await api.post('/manager-diagnostic', { responses: richResponses });
      toast.success('Ton profil manager est prêt ! 🔥');
      onSuccess(res.data?.diagnostic || null);
      onClose();
    } catch (err) {
      logger.error('Error submitting diagnostic:', err);
      toast.error("Erreur lors de l'analyse du profil");
      throw err;
    }
  };

  return (
    <DiagnosticFormBase
      questions={questions}
      title="Identifier mon profil de management"
      onSubmit={handleSubmit}
      onClose={onClose}
      isModal
    />
  );
}
