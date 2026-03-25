import React from 'react';
import { Calendar, Clock, Coffee, Sparkles, Copy, Check, RefreshCw, Download } from 'lucide-react';
import { renderBriefContent } from './briefRenderers';
import AIDataSources from '../shared/AIDataSources';

const NewBriefTab = ({
  // Store info
  storeName,
  managerName,
  // Form state
  objectiveDaily,
  setObjectiveDaily,
  comments,
  setComments,
  // Loading / brief state
  isLoading,
  brief,
  // Actions
  handleGenerate,
  handleRegenerate,
  handleCopy,
  handleClose,
  exportBriefToPDF,
  // Copy state
  copied,
  exportingPDF,
  // Ref for PDF
  briefContentRef,
}) => {
  return (
    <>
      {/* TAB: Nouveau Brief - Input form */}
      {!brief && !isLoading && (
        <div className="space-y-6">
          {/* Info magasin */}
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="font-semibold">Magasin :</span>
                <span>{storeName || 'Mon Magasin'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Coffee className="w-4 h-4" />
                <span className="font-semibold">Manager :</span>
                <span>{managerName || 'Manager'}</span>
              </div>
            </div>
          </div>

          {/* Objectif CA du jour */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💰 Objectif CA du jour (€)
            </label>
            <input
              type="number"
              value={objectiveDaily}
              onChange={(e) => setObjectiveDaily(e.target.value)}
              placeholder="Ex: 1200"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
            />
            <p className="text-xs text-gray-400 mt-1">Montant en euros (optionnel)</p>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🎯 Une consigne particulière pour ce matin ?
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ex: Insister sur la vente des chaussettes, féliciter Julie pour hier..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{comments.length}/500</p>
          </div>

          {/* Exemples */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">💡 EXEMPLES :</p>
            <div className="flex flex-wrap gap-2">
              {["Focus nouvelle collection", "Féliciter l'équipe", "Rappel ponctualité", "Objectif panier +10%"].map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => setComments(ex)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Bouton */}
          <div className="text-center py-4">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-gray-600 mb-6">Générez un brief matinal personnalisé</p>
            <button
              onClick={handleGenerate}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              Générer le Brief
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                <Coffee className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Préparation du brief...</h3>
              <p className="text-gray-600">L&apos;IA prépare votre brief matinal</p>
            </div>
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-progress-slide"></div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">⏱️ ~30-60 secondes</p>
          </div>
        </div>
      )}

      {/* Brief généré */}
      {brief && !isLoading && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold">Date :</span>
                  <span>{brief.date}</span>
                </div>
                {brief.data_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="font-semibold">Données :</span>
                    <span>{brief.data_date}</span>
                  </div>
                )}
              </div>
              {brief.has_context && (
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">✓ Consigne intégrée</span>
              )}
            </div>
          </div>

          <div
            ref={briefContentRef}
            className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4"
          >
            {renderBriefContent(brief)}
            <AIDataSources sources={[
              'KPIs de la veille (J-1)',
              'Objectif CA du jour',
              ...(brief?.has_context ? ['Consigne manager'] : []),
            ]} />
          </div>

          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={handleRegenerate} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Regénérer
            </button>
            <button onClick={() => handleCopy()} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <button
              onClick={() => exportBriefToPDF(brief)}
              disabled={exportingPDF}
              className="px-4 py-2 bg-[#1E40AF] text-white font-medium rounded-lg hover:bg-[#1E3A8A] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {exportingPDF ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPDF ? 'Export...' : 'PDF'}
            </button>
            <button onClick={handleClose} className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors">
              Fermer
            </button>
          </div>

          <div className="text-xs text-gray-400 text-center">
            Généré le {new Date(brief.generated_at).toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </>
  );
};

export default NewBriefTab;
