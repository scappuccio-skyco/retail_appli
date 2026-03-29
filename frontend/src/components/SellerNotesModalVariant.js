/**
 * SellerNotesModalVariant — STAGING UNIQUEMENT
 *
 * Dupliqué depuis EvaluationNotesNotebook.js — mêmes fonctionnalités, présentation différente.
 *
 * variant='B' → Layout Empilé : liste compacte en haut (scroll horizontal), éditeur large en bas
 * variant='C' → Layout Inversé : éditeur à gauche (2/3), liste des notes à droite (1/3)
 */
import React from 'react';
import { X, FileText, Sparkles, Save, Eye, PenLine, BookOpen } from 'lucide-react';
import useEvaluationNotesNotebook from './evaluationNotesNotebook/useEvaluationNotesNotebook';
import NoteItem from './evaluationNotesNotebook/NoteItem';

/* ══════════════════════════════════════
   STYLE B — Layout Empilé
   Liste des notes en haut (compact), éditeur grand en bas
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, onGenerateSynthesis }) {
  const s = useEvaluationNotesNotebook({ isOpen });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
              <PenLine className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Mon Bloc-notes d'Entretien</h2>
              <p className="text-xs text-gray-500">Prends des notes quotidiennes pour préparer ton entretien</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-semibold border border-pink-100">Style B</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1 — Liste des notes en scroll horizontal compact */}
        <div className="border-b border-gray-100 flex-shrink-0 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-600">Mes notes ({s.notes.length})</h3>
          </div>
          {s.loading ? (
            <p className="text-xs text-gray-400 py-2">Chargement...</p>
          ) : s.sortedNotes.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">Aucune note — commence à écrire ci-dessous !</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {s.sortedNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => s.handleDateChange(note.date || s.selectedDate)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-xs transition-all text-left min-w-[120px] max-w-[160px] ${
                    s.selectedDate === (note.date || s.selectedDate) && s.currentNote?.id === note.id
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-pink-300 hover:bg-pink-50'
                  }`}
                >
                  <p className="font-semibold truncate">
                    {note.date ? new Date(note.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Note'}
                  </p>
                  <p className="text-[10px] opacity-70 truncate mt-0.5">{note.content?.substring(0, 40) || '...'}</p>
                  {note.shared_with_manager && <Eye className="w-3 h-3 mt-1 opacity-60" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 2 — Éditeur principal (grand, prend tout l'espace restant) */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Sélecteur de date */}
          <div className="px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de la note</label>
              <input
                type="date"
                value={s.selectedDate}
                onChange={(e) => s.handleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
              />
            </div>
            {s.notes.length > 0 && (
              <p className="text-xs text-gray-400 mt-4">{s.notes.length} note{s.notes.length > 1 ? 's' : ''} enregistrée{s.notes.length > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Textarea grande */}
          <div className="flex-1 min-h-0 flex flex-col px-5 py-4 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              {s.currentNote ? 'Modifier la note' : 'Nouvelle note'}
            </label>
            <textarea
              value={s.noteContent}
              onChange={(e) => s.setNoteContent(e.target.value)}
              placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
              className="flex-1 min-h-[200px] w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-400 resize-none text-gray-800 placeholder-gray-400 bg-white shadow-sm"
            />

            {s.currentNote?.manager_reply && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.currentNote.manager_reply}</p>
              </div>
            )}

            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>Notes régulières → synthèse IA · <Eye className="w-3 h-3 inline mx-0.5" /> = partager avec le manager</span>
              </div>
              <div className="flex items-center gap-2">
                {s.editingNote && (
                  <button onClick={s.handleCancelEdit} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
                    Annuler
                  </button>
                )}
                <button
                  onClick={s.editingNote ? s.handleUpdateNote : s.handleSaveNote}
                  disabled={s.saving || !s.noteContent.trim()}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                >
                  {s.saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                    : <><Save className="w-4 h-4" />{s.editingNote ? 'Mettre à jour' : 'Enregistrer'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
            Fermer
          </button>
          {onGenerateSynthesis && s.notes.length > 0 && (
            <button
              onClick={() => { onClose(); onGenerateSynthesis(); }}
              className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-lg hover:from-pink-700 hover:to-rose-700 transition-all flex items-center gap-2 text-sm shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Générer la synthèse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Layout Inversé
   Éditeur à gauche (2/3) + Liste des notes à droite (1/3)
   Inverse du layout original (gauche=liste, droite=éditeur)
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, onGenerateSynthesis }) {
  const s = useEvaluationNotesNotebook({ isOpen });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100">

        {/* Header dégradé */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mon Bloc-notes d'Entretien</h2>
              <p className="text-sm text-pink-200">Prépare ton bilan annuel pas à pas</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">Style C</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Mobile : layout empilé (éditeur full width + liste en bas) */}
        <div className="sm:hidden flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Date */}
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de la note</label>
            <input type="date" value={s.selectedDate} onChange={(e) => s.handleDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent" />
          </div>
          {/* Éditeur */}
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
            <label className="block text-sm font-medium text-gray-700">{s.currentNote ? 'Modifier la note' : 'Nouvelle note'}</label>
            <textarea value={s.noteContent} onChange={(e) => s.setNoteContent(e.target.value)}
              placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
              className="w-full min-h-[160px] px-4 py-3 border-2 border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-400 resize-none text-gray-800 placeholder-gray-400 bg-white shadow-sm" />
            {s.currentNote?.manager_reply && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.currentNote.manager_reply}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{s.currentNote ? `Créée le ${new Date(s.currentNote.created_at).toLocaleDateString('fr-FR')}` : `Note pour le ${new Date(s.selectedDate).toLocaleDateString('fr-FR')}`}</p>
              <div className="flex gap-2">
                {s.editingNote && <button onClick={s.handleCancelEdit} className="px-3 py-2 text-gray-500 text-sm">Annuler</button>}
                <button onClick={s.editingNote ? s.handleUpdateNote : s.handleSaveNote}
                  disabled={s.saving || !s.noteContent.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 text-sm shadow">
                  {s.saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</> : <><Save className="w-4 h-4" />{s.editingNote ? 'Mettre à jour' : 'Enregistrer'}</>}
                </button>
              </div>
            </div>
          </div>
          {/* Liste compacte */}
          {s.sortedNotes.length > 0 && (
            <div className="border-t border-gray-100 p-4 flex-shrink-0">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Mes notes ({s.notes.length})</h3>
              <div className="space-y-1.5">
                {s.sortedNotes.map((note) => (
                  <NoteItem key={note.id} note={note} selectedDate={s.selectedDate}
                    toggling={s.toggling} deleting={s.deleting}
                    onSelect={s.handleDateChange} onEdit={s.handleEditNote}
                    onToggleVisibility={s.handleToggleVisibility} onDelete={s.handleDeleteNote} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop : éditeur gauche (2/3) + liste droite (1/3) */}
        <div className="hidden sm:flex flex-1 overflow-hidden min-h-0">

          {/* Panneau gauche — Éditeur (2/3) */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
            {/* Sélecteur date */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de la note</label>
              <input
                type="date"
                value={s.selectedDate}
                onChange={(e) => s.handleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Zone d'écriture */}
            <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
              <label className="block text-sm font-medium text-gray-700">
                {s.currentNote ? 'Modifier la note' : 'Nouvelle note'}
              </label>
              <textarea
                value={s.noteContent}
                onChange={(e) => s.setNoteContent(e.target.value)}
                placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
                className="flex-1 min-h-[180px] w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-400 resize-none text-gray-800 placeholder-gray-400 bg-white shadow-sm"
              />

              {s.currentNote?.manager_reply && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.currentNote.manager_reply}</p>
                </div>
              )}

              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-xs text-gray-400">
                  {s.currentNote
                    ? <span>Créée le {new Date(s.currentNote.created_at).toLocaleDateString('fr-FR')}</span>
                    : <span>Note pour le {new Date(s.selectedDate).toLocaleDateString('fr-FR')}</span>
                  }
                </div>
                <div className="flex gap-2">
                  {s.editingNote && (
                    <button onClick={s.handleCancelEdit} className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={s.editingNote ? s.handleUpdateNote : s.handleSaveNote}
                    disabled={s.saving || !s.noteContent.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow"
                  >
                    {s.saving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                      : <><Save className="w-4 h-4" />{s.editingNote ? 'Mettre à jour' : 'Enregistrer'}</>
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Hint IA */}
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-700 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>Notes régulières → synthèse IA pour ton entretien. <Eye className="w-3 h-3 inline mx-0.5" /> Œil = partager avec le manager.</span>
            </div>
          </div>

          {/* Panneau droit — Liste des notes (1/3) */}
          <div className="w-64 xl:w-72 flex-shrink-0 border-l border-gray-100 overflow-y-auto bg-gray-50">
            <div className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Mes notes ({s.notes.length})</h3>
              {s.loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
              ) : s.sortedNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune note pour le moment</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {s.sortedNotes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      selectedDate={s.selectedDate}
                      toggling={s.toggling}
                      deleting={s.deleting}
                      onSelect={s.handleDateChange}
                      onEdit={s.handleEditNote}
                      onToggleVisibility={s.handleToggleVisibility}
                      onDelete={s.handleDeleteNote}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
          <div className="text-sm text-gray-500">
            {s.notes.length > 0 && (
              <span>{s.notes.length} note{s.notes.length > 1 ? 's' : ''} enregistrée{s.notes.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm">
              Fermer
            </button>
            {onGenerateSynthesis && s.notes.length > 0 && (
              <button
                onClick={() => { onClose(); onGenerateSynthesis(); }}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all flex items-center gap-2 text-sm shadow"
              >
                <Sparkles className="w-4 h-4" />
                Générer la synthèse
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
