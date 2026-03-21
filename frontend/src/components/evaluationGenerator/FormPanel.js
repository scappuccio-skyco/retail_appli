import React from 'react';
import { Sparkles, FileText, Calendar, Loader2, MessageSquare } from 'lucide-react';

/**
 * FormPanel - Pre-generation form: date range, interview notes preview,
 * optional comments textarea, and the generate button.
 */
export default function FormPanel({
  role,
  startDate,
  endDate,
  comments,
  loading,
  loadingNotes,
  interviewNotes,
  commentsPlaceholder,
  generateButtonText,
  onStartDateChange,
  onEndDateChange,
  onCommentsChange,
  onGenerate,
}) {
  // Force the native date picker to open on click (Chrome/Edge)
  const handleDateClick = (e) => {
    if (e.target.showPicker) e.target.showPicker();
  };

  return (
    <>
      {/* Date Selection */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Période d&apos;analyse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              onClick={handleDateClick}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm cursor-pointer hover:border-gray-300 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              onClick={handleDateClick}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm cursor-pointer hover:border-gray-300 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Interview Notes */}
      <div className="bg-pink-50 rounded-xl p-4 mb-4 border-2 border-pink-100">
        <h3 className="text-sm font-semibold text-pink-800 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {role === 'manager' ? 'Notes partagées par le vendeur' : 'Notes du bloc-notes'}
        </h3>
        {loadingNotes ? (
          <p className="text-sm text-pink-600">Chargement des notes...</p>
        ) : interviewNotes.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-pink-700">
              ✅ {interviewNotes.length} note{interviewNotes.length > 1 ? 's' : ''} dans cette période
              {role === 'manager' && ' — partagées par le vendeur'}
            </p>
            {role === 'manager' && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {interviewNotes.map((note, i) => (
                  <div key={i} className="bg-white rounded-lg p-2 border border-pink-200">
                    <p className="text-xs text-pink-500 mb-0.5">
                      {new Date(note.date + 'T12:00:00').toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className="text-sm text-gray-700">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
            {role === 'seller' && (
              <p className="text-xs text-pink-600">
                💡 Ces notes seront incluses dans ta synthèse. Les notes marquées 👁️ seront aussi visibles dans le guide de ton manager.
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-pink-700 mb-1">
              {role === 'manager'
                ? '📝 Aucune note partagée par le vendeur pour cette période'
                : '📝 Aucune note dans cette période'}
            </p>
            <p className="text-xs text-pink-600">
              {role === 'manager'
                ? "💡 Le vendeur peut partager ses notes via l'icône 👁️ dans son bloc-notes."
                : "💡 Utilise le bloc-notes pour prendre des notes quotidiennes. Choisis lesquelles partager avec ton manager via l'icône 👁️."}
            </p>
          </div>
        )}
      </div>

      {/* Optional Comments */}
      <div className="bg-purple-50 rounded-xl p-4 mb-4 border-2 border-purple-100">
        <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {role === 'seller' ? 'Notes supplémentaires (optionnel)' : 'Vos observations (optionnel)'}
        </h3>
        <textarea
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
          placeholder={commentsPlaceholder}
          rows={3}
          className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-1 focus:ring-purple-400 text-sm resize-none placeholder:text-purple-300"
        />
        <p className="text-xs text-purple-600 mt-1">
          {role === 'seller'
            ? '💡 Ces notes supplémentaires seront ajoutées aux notes de ton bloc-notes'
            : "💡 L'IA prendra en compte ces informations pour personnaliser le guide"}
        </p>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
      >
        <Sparkles className="w-5 h-5" />
        {generateButtonText}
      </button>
    </>
  );
}
