import React from 'react';
import { X, Calendar, Lock } from 'lucide-react';
import { useSyncMode } from '../hooks/useSyncMode';
import useKPIEntryModal from './kpiEntryModal/useKPIEntryModal';
import KPIInputField from './kpiEntryModal/KPIInputField';
import WarningModal from './kpiEntryModal/WarningModal';

export default function KPIEntryModal({ onClose, onSuccess, editEntry = null }) {
  const { isReadOnly } = useSyncMode();
  const s = useKPIEntryModal({ onClose, onSuccess, editEntry });

  const backdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  if (s.loading) {
    return (
      <div onClick={backdrop} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!s.enabled) {
    return (
      <div onClick={backdrop} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-4">
            <p className="text-gray-600">Les KPI quotidiens ne sont pas activés.</p>
            <p className="text-sm text-gray-500 mt-2">Contactez votre manager.</p>
          </div>
          <button onClick={onClose} className="w-full py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={backdrop} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 flex justify-between items-center rounded-t-3xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">
              {editEntry ? 'Modifier mes chiffres' : 'Mes chiffres du jour'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={s.date}
              onChange={(e) => s.setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 Remplissez les données demandées. Les KPI dérivés seront calculés automatiquement.
            </p>
          </div>

          {s.isEntryLocked && (
            <div className="mb-4 bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <p className="text-sm text-orange-800">
                🔒 Ces données ont été certifiées par le Siège/ERP et ne peuvent pas être modifiées.
              </p>
            </div>
          )}
          {isReadOnly && !s.isEntryLocked && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Ces données sont synchronisées automatiquement depuis votre ERP. Consultation uniquement.
              </p>
            </div>
          )}

          {/* KPI Inputs */}
          <div className="space-y-4 mb-6">
            {s.kpiConfig?.track_ca && (
              <KPIInputField
                emoji="💰" label="Chiffre d'affaires"
                value={s.caJournalier} onChange={s.setCaJournalier}
                unit="€" step="0.01"
                isReadOnly={isReadOnly} isEntryLocked={s.isEntryLocked}
              />
            )}
            {s.kpiConfig?.track_ventes && (
              <KPIInputField
                emoji="🛍️" label="Nombre de ventes"
                value={s.nbVentes} onChange={s.setNbVentes}
                unit="ventes"
                isReadOnly={isReadOnly} isEntryLocked={s.isEntryLocked}
              />
            )}
            {s.kpiConfig?.track_articles && (
              <KPIInputField
                emoji="📦" label="Nombre d'articles vendus"
                value={s.nbArticles} onChange={s.setNbArticles}
                unit="articles"
                isReadOnly={isReadOnly} isEntryLocked={s.isEntryLocked}
              />
            )}
            {s.kpiConfig?.track_prospects && (
              <KPIInputField
                emoji="🚶" label="Nombre de prospects"
                value={s.nbProspects} onChange={s.setNbProspects}
                unit="prospects"
                isReadOnly={isReadOnly} isEntryLocked={s.isEntryLocked}
              />
            )}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
            <textarea
              value={s.comment}
              onChange={(e) => s.setComment(e.target.value)}
              placeholder="Notes sur votre journée..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50">
              {(isReadOnly || s.isEntryLocked) ? 'Fermer' : 'Annuler'}
            </button>
            {!isReadOnly && !s.isEntryLocked && (
              <button
                onClick={s.handleSubmit}
                disabled={s.saving}
                className="flex-1 py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg disabled:opacity-50"
              >
                {s.saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {s.showWarningModal && (
        <WarningModal
          warnings={s.warnings}
          saving={s.saving}
          onDismiss={s.dismissWarning}
          onConfirm={s.confirmWarning}
        />
      )}
    </div>
  );
}
