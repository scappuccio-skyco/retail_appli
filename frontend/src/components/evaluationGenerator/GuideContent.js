import React from 'react';
import {
  Sparkles, Copy, Check, FileText, Loader2,
  CheckCircle, AlertTriangle, Target, MessageSquare, Star, Download,
} from 'lucide-react';

/**
 * GuideContent - Renders the AI-generated evaluation guide as colored cards.
 * Receives a forwarded ref (guideContentRef) so the parent can snapshot the
 * DOM for PDF export.
 */
const GuideContent = React.forwardRef(function GuideContent(
  { guideData, role, copied, exportingPDF, onCopy, onExportPDF, onReset },
  ref
) {
  return (
    <div ref={ref} className="space-y-4">
      {/* Header row: title + action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">
          {role === 'seller' ? '📝 Ta Fiche de Préparation' : "📋 Guide d'Évaluation"}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              copied
                ? 'bg-green-100 text-green-700 border-2 border-green-200'
                : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
          <button
            onClick={onExportPDF}
            disabled={exportingPDF}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#1E40AF] text-white hover:bg-[#1E3A8A] transition-all disabled:opacity-50"
          >
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportingPDF ? 'Export...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Blue card — Synthèse */}
      {guideData.synthese && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-blue-800">Synthèse &amp; Contexte</h4>
          </div>
          <p className="text-gray-700 leading-relaxed">{guideData.synthese}</p>
        </div>
      )}

      {/* Green card — Victoires */}
      {guideData.victoires?.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-green-800">
              {role === 'seller' ? 'Tes Victoires 🏆' : 'Points Forts / Victoires'}
            </h4>
          </div>
          <ul className="space-y-2">
            {guideData.victoires.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Orange card — Axes de Progrès */}
      {guideData.axes_progres?.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-orange-800">
              {role === 'seller' ? 'Tes Axes de Progrès 📈' : 'Axes de Progrès'}
            </h4>
          </div>
          <ul className="space-y-2">
            {guideData.axes_progres.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Purple card — Objectifs (manager only) */}
      {role !== 'seller' && guideData.objectifs?.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 border-2 border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-purple-800">Objectifs &amp; Recommandations 🎯</h4>
          </div>
          <ul className="space-y-2">
            {guideData.objectifs.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <Target className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Yellow card — Souhaits (seller only) */}
      {role === 'seller' && guideData.souhaits?.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-yellow-800">Mes Souhaits &amp; Demandes ⭐</h4>
          </div>
          <ul className="space-y-2">
            {guideData.souhaits.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pink card — Questions (coaching / à poser) */}
      {(guideData.questions_coaching?.length > 0 || guideData.questions_manager?.length > 0) && (
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border-2 border-pink-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-base font-bold text-pink-800">
              {role === 'seller' ? 'Questions à Poser 💬' : 'Questions de Coaching'}
            </h4>
          </div>
          <ul className="space-y-2">
            {(guideData.questions_coaching || guideData.questions_manager || []).map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regenerate button */}
      <button
        onClick={onReset}
        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Modifier les paramètres et régénérer
      </button>
    </div>
  );
});

export default GuideContent;
