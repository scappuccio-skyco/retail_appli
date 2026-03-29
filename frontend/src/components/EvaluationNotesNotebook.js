import React from 'react';
import { X, FileText, Sparkles, Save, Eye } from 'lucide-react';
import useEvaluationNotesNotebook from './evaluationNotesNotebook/useEvaluationNotesNotebook';
import NoteItem from './evaluationNotesNotebook/NoteItem';

export default function EvaluationNotesNotebook({ isOpen, onClose, onGenerateSynthesis }) {
  const {
    notes, loading, sortedNotes, currentNote,
    selectedDate, noteContent, setNoteContent,
    editingNote, saving, deleting, toggling,
    handleDateChange, handleEditNote, handleSaveNote,
    handleUpdateNote, handleToggleVisibility, handleDeleteNote, handleCancelEdit,
  } = useEvaluationNotesNotebook({ isOpen });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">📝 Mon Bloc-notes d'Entretien</h2>
              <p className="text-sm text-gray-600">Prends des notes quotidiennes pour préparer ton entretien</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content — Mobile : empilé, Desktop : côte à côte */}

        {/* MOBILE : éditeur en haut, liste en bas */}
        <div className="sm:hidden flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* Éditeur */}
          <div className="flex flex-col">
            <div className="p-3 border-b border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de la note</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col p-3 gap-2">
              <label className="block text-sm font-medium text-gray-700">
                {currentNote ? 'Modifier la note' : 'Nouvelle note'}
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
                rows={5}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-400 resize-none text-gray-800 placeholder-gray-400 bg-white shadow-sm"
              />
              {currentNote?.manager_reply && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentNote.manager_reply}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {currentNote ? (
                    <span>Créée le {new Date(currentNote.created_at).toLocaleDateString('fr-FR')}</span>
                  ) : (
                    <span>Note du {new Date(selectedDate).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {editingNote && (
                    <button onClick={handleCancelEdit} className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm">
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={editingNote ? handleUpdateNote : handleSaveNote}
                    disabled={saving || !noteContent.trim()}
                    className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
                  >
                    {saving ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Enreg...</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" />{editingNote ? 'Mettre à jour' : 'Enregistrer'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-3 py-2 bg-blue-50 border-y border-blue-100 flex items-center gap-2 text-xs text-blue-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span>Notes régulières → synthèse IA pour ton entretien. <Eye className="w-3 h-3 inline mx-0.5" />Icône œil = partager avec le manager.</span>
            </div>
          </div>
          {/* Liste des notes */}
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-2 text-sm">Mes notes ({notes.length})</h3>
            {loading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Chargement...</div>
            ) : sortedNotes.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucune note pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    selectedDate={selectedDate}
                    toggling={toggling}
                    deleting={deleting}
                    onSelect={handleDateChange}
                    onEdit={handleEditNote}
                    onToggleVisibility={handleToggleVisibility}
                    onDelete={handleDeleteNote}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP : liste gauche 1/3 + éditeur droite */}
        <div className="hidden sm:flex flex-1 overflow-hidden">
          {/* Left Panel — Liste des notes */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto bg-gray-50">
            <div className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Mes notes ({notes.length})</h3>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : sortedNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucune note pour le moment</p>
                  <p className="text-xs text-gray-400 mt-1">Commence à prendre des notes !</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedNotes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      selectedDate={selectedDate}
                      toggling={toggling}
                      deleting={deleting}
                      onSelect={handleDateChange}
                      onEdit={handleEditNote}
                      onToggleVisibility={handleToggleVisibility}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Édition */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de la note</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
              <label className="block text-sm font-medium text-gray-700">
                {currentNote ? 'Modifier la note' : 'Nouvelle note'}
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Écris tes notes ici… Réussites, défis, souhaits, questions pour l'entretien…"
                className="flex-1 min-h-[180px] w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-400 resize-none text-gray-800 placeholder-gray-400 bg-white shadow-sm"
              />

              {currentNote?.manager_reply && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[11px] font-semibold text-blue-600 mb-1">💬 Réponse de votre manager :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentNote.manager_reply}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {currentNote ? (
                    <span>Note créée le {new Date(currentNote.created_at).toLocaleDateString('fr-FR')}</span>
                  ) : (
                    <span>Note pour le {new Date(selectedDate).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {editingNote && (
                    <button onClick={handleCancelEdit} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={editingNote ? handleUpdateNote : handleSaveNote}
                    disabled={saving || !noteContent.trim()}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                    ) : (
                      <><Save className="w-4 h-4" />{editingNote ? 'Mettre à jour' : 'Enregistrer'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-700">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>
                Notes régulières → synthèse IA pour ton entretien.{' '}
                <Eye className="w-3 h-3 inline mx-0.5" />
                Icône œil = partager avec le manager.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {notes.length > 0 && (
              <span>{notes.length} note{notes.length > 1 ? 's' : ''} enregistrée{notes.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
              Fermer
            </button>
            {onGenerateSynthesis && notes.length > 0 && (
              <button
                onClick={() => { onClose(); onGenerateSynthesis(); }}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-lg hover:from-pink-700 hover:to-rose-700 transition-all flex items-center gap-2 shadow-md"
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
