import React from 'react';

export default function DiagnosticFooter({ answeredCount, totalCount, loading, onSubmit }) {
  const allAnswered = answeredCount >= totalCount;

  return (
    <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center">
      <p className="text-sm text-gray-600">
        {answeredCount} / {totalCount} questions répondues
      </p>
      <button
        onClick={onSubmit}
        disabled={loading || !allAnswered}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Analyse en cours...' : 'Découvrir mon profil'}
      </button>
    </div>
  );
}
