/**
 * SellerNotesModalVariant — STAGING UNIQUEMENT
 *
 * B — "Journal Sombre" : header dark slate/rose, panneau gauche sombre,
 *     zone d'édition sur fond légèrement teinté.
 *
 * C — "Carnet Clair" : header dégradé rose-pink lumineux, layout identique
 *     mais tons chauds et espacement généreux.
 */
import React from 'react';
import { X, FileText, Sparkles, Save, Eye, BookOpen, PenLine } from 'lucide-react';
import useEvaluationNotesNotebook from './evaluationNotesNotebook/useEvaluationNotesNotebook';
import NoteItem from './evaluationNotesNotebook/NoteItem';

function NotesContent({ s, onClose, onGenerateSynthesis, leftBg, leftTitle, textareaClass, saveBtnClass }) {
  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Panneau gauche */}
      <div className={`w-1/3 border-r border-gray-200 overflow-y-auto ${leftBg}`}>
        <div className="p-4">
          <h3 className={`font-semibold mb-3 ${leftTitle}`}>Mes notes ({s.notes.length})</h3>
          {s.loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : s.sortedNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune note pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {s.sortedNotes.map((note) => (
                <NoteItem key={note.id} note={note} selectedDate={s.selectedDate}
                  toggling={s.toggling} deleting={s.deleting}
                  onSelect={s.handleDateChange} onEdit={s.handleEditNote}
                  onToggleVisibility={s.handleToggleVisibility} onDelete={s.handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date de la note</label>
          <input type="date" value={s.selectedDate}
            onChange={(e) => s.handleDateChange(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
          <label className="block text-sm font-medium text-gray-700">
            {s.currentNote ? 'Modifier la note' : 'Nouvelle note'}
          </label>
          <textarea value={s.noteContent} onChange={(e) => s.setNoteContent(e.target.value)}
            placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
            className={`flex-1 min-h-[180px] w-full px-4 py-3 border-2 rounded-xl resize-none text-gray-800 placeholder-gray-400 shadow-sm ${textareaClass}`}
          />
          {s.currentNote?.manager_reply && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.currentNote.manager_reply}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {s.currentNote
                ? <span>Note créée le {new Date(s.currentNote.created_at).toLocaleDateString('fr-FR')}</span>
                : <span>Note pour le {new Date(s.selectedDate).toLocaleDateString('fr-FR')}</span>
              }
            </div>
            <div className="flex gap-2">
              {s.editingNote && (
                <button onClick={s.handleCancelEdit} className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">Annuler</button>
              )}
              <button onClick={s.editingNote ? s.handleUpdateNote : s.handleSaveNote}
                disabled={s.saving || !s.noteContent.trim()}
                className={`px-4 py-2 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 text-sm ${saveBtnClass}`}>
                {s.saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                  : <><Save className="w-4 h-4" />{s.editingNote ? 'Mettre à jour' : 'Enregistrer'}</>
                }
              </button>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-600">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>Notes régulières → synthèse IA pour l'entretien. <Eye className="w-3 h-3 inline mx-0.5" /> Œil = partager avec le manager.</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE B — Journal Sombre
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, onGenerateSynthesis }) {
  const s = useEvaluationNotesNotebook({ isOpen });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-800">

        {/* Header sombre */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
              <PenLine className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mon Bloc-notes d'Entretien</h2>
              <p className="text-xs text-slate-400">Notes quotidiennes pour préparer ton bilan annuel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Content fond légèrement clair pour lisibilité */}
        <div className="flex-1 overflow-hidden flex bg-white">
          <NotesContent s={s} onClose={onClose} onGenerateSynthesis={onGenerateSynthesis}
            leftBg="bg-slate-50" leftTitle="text-slate-700"
            textareaClass="border-rose-200 focus:ring-rose-400 focus:border-rose-400 bg-rose-50/30"
            saveBtnClass="bg-rose-600 hover:bg-rose-700"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-400">
            {s.notes.length > 0 ? `${s.notes.length} note${s.notes.length > 1 ? 's' : ''} enregistrée${s.notes.length > 1 ? 's' : ''}` : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">Fermer</button>
            {onGenerateSynthesis && s.notes.length > 0 && (
              <button onClick={() => { onClose(); onGenerateSynthesis(); }}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg hover:from-rose-700 hover:to-pink-700 transition-all flex items-center gap-2 text-sm shadow-md">
                <Sparkles className="w-4 h-4" />Générer la synthèse
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Carnet Clair
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, onGenerateSynthesis }) {
  const s = useEvaluationNotesNotebook({ isOpen });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100">

        {/* Header dégradé rose-pink */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-5 flex items-center justify-between flex-shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Mon Bloc-notes d'Entretien</h2>
              <p className="text-sm text-pink-200">Prépare ton bilan annuel pas à pas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          <NotesContent s={s} onClose={onClose} onGenerateSynthesis={onGenerateSynthesis}
            leftBg="bg-pink-50/50" leftTitle="text-pink-700"
            textareaClass="border-pink-200 focus:ring-pink-400 focus:border-pink-400 bg-white"
            saveBtnClass="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0 rounded-b-3xl">
          <span className="text-xs text-gray-400">
            {s.notes.length > 0 ? `${s.notes.length} note${s.notes.length > 1 ? 's' : ''} enregistrée${s.notes.length > 1 ? 's' : ''}` : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">Fermer</button>
            {onGenerateSynthesis && s.notes.length > 0 && (
              <button onClick={() => { onClose(); onGenerateSynthesis(); }}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all flex items-center gap-2 text-sm shadow">
                <Sparkles className="w-4 h-4" />Générer la synthèse
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SellerNotesModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
