import React from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import FormPanel from './evaluationGenerator/FormPanel';
import GuideContent from './evaluationGenerator/GuideContent';
import useEvaluationGenerator from './evaluationGenerator/useEvaluationGenerator';

export default function EvaluationGenerator({ isOpen, onClose, employeeId, employeeName, role }) {
  const {
    startDate, setStartDate, endDate, setEndDate,
    comments, setComments, loading, guideData, stats,
    copied, error, exportingPDF, interviewNotes, loadingNotes,
    guideContentRef,
    handleGenerate, handleCopy, exportToPDF, handleClose, handleReset,
  } = useEvaluationGenerator({ isOpen, employeeId, employeeName, role, onClose });

  if (!isOpen) return null;

  const modalTitle = role === 'seller'
    ? '🎯 Préparer Mon Entretien Annuel'
    : `📋 Préparer l'Entretien - ${employeeName}`;

  const generateButtonText = role === 'seller'
    ? '✨ Générer Ma Fiche de Préparation'
    : "✨ Générer le Guide d'Évaluation";

  const commentsPlaceholder = role === 'seller'
    ? "Notes supplémentaires (optionnel) - Tes notes du bloc-notes seront automatiquement incluses dans la synthèse"
    : "Ajoutez vos observations spécifiques (ex: 'Très bon sur l'accueil, mais retards fréquents', 'A progressé sur le closing')...";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-4 sm:p-6 rounded-t-2xl relative">
          <button onClick={handleClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-gray-200 transition-colors">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">{modalTitle}</h2>
              <p className="text-white/80 text-sm">
                {role === 'seller' ? "Prépare tes arguments avec l'aide de l'IA" : "Guide d'entretien généré par l'IA"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!guideData && !loading && (
            <FormPanel
              role={role}
              startDate={startDate}
              endDate={endDate}
              comments={comments}
              loading={loading}
              loadingNotes={loadingNotes}
              interviewNotes={interviewNotes}
              commentsPlaceholder={commentsPlaceholder}
              generateButtonText={generateButtonText}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onCommentsChange={setComments}
              onGenerate={handleGenerate}
            />
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#1E40AF] animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Génération en cours...</p>
              <p className="text-gray-400 text-sm mt-1">L'IA analyse les données de performance</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 font-medium">❌ {error}</p>
            </div>
          )}

          {stats && !stats.no_data && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border-2 border-blue-100">
              <h3 className="text-sm font-semibold text-[#1E40AF] mb-3">📊 Données utilisées</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { value: `${stats.total_ca?.toLocaleString('fr-FR')} €`, label: 'CA Total', color: 'text-[#1E40AF]' },
                  { value: stats.total_ventes, label: 'Ventes', color: 'text-[#F97316]' },
                  { value: `${stats.avg_panier?.toLocaleString('fr-FR')} €`, label: 'Panier Moyen', color: 'text-green-600' },
                  { value: stats.days_worked, label: 'Jours travaillés', color: 'text-purple-600' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="bg-white rounded-lg p-2">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {guideData && (
            <GuideContent
              ref={guideContentRef}
              guideData={guideData}
              role={role}
              copied={copied}
              exportingPDF={exportingPDF}
              onCopy={handleCopy}
              onExportPDF={exportToPDF}
              onReset={handleReset}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button onClick={handleClose} className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-all">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
