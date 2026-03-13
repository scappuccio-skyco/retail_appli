import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Edit2, Save, FileText, Sparkles, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';

/**
 * EvaluationNotesNotebook - Bloc-notes pour préparer l'entretien annuel
 * 
 * Permet au vendeur de :
 * - Prendre des notes quotidiennes
 * - Voir toutes ses notes
 * - Modifier/supprimer des notes
 * - Générer une synthèse IA basée sur les notes et les chiffres
 */
export default function EvaluationNotesNotebook({ isOpen, onClose, sellerId, sellerName, onGenerateSynthesis }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);

  // Charger les notes au montage
  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/seller/interview-notes');
      setNotes(response.data.notes || []);
    } catch (error) {
      logger.error('Error fetching notes:', error);
      toast.error('Erreur lors du chargement des notes');
    } finally {
      setLoading(false);
    }
  };

  // Trouver la note pour la date sélectionnée
  const getNoteForDate = (date) => {
    return notes.find(note => note.date === date);
  };

  const currentNote = getNoteForDate(selectedDate);

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    try {
      setSaving(true);
      await api.post('/seller/interview-notes', {
        date: selectedDate,
        content: noteContent.trim()
      });

      toast.success('Note enregistrée avec succès');
      setNoteContent('');
      setEditingNote(null);
      await fetchNotes();
    } catch (error) {
      logger.error('Error saving note:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = (note) => {
    setSelectedDate(note.date);
    setNoteContent(note.content);
    setEditingNote(note.id);
  };

  const handleUpdateNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/seller/interview-notes/${editingNote}`, {
        content: noteContent.trim()
      });

      toast.success('Note mise à jour avec succès');
      setNoteContent('');
      setEditingNote(null);
      await fetchNotes();
    } catch (error) {
      logger.error('Error updating note:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (note) => {
    try {
      setToggling(note.id);
      const newShared = !note.shared_with_manager;
      await api.patch(`/seller/interview-notes/${note.id}/visibility`, {
        shared_with_manager: newShared
      });
      setNotes(prev => prev.map(n =>
        n.id === note.id ? { ...n, shared_with_manager: newShared } : n
      ));
      toast.success(newShared ? '✅ Note partagée avec le manager' : '🔒 Note masquée au manager');
    } catch (error) {
      logger.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setToggling(null);
    }
  };

  const handleDeleteNote = async (noteId, date) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
      return;
    }

    try {
      setDeleting(noteId);
      await api.delete(`/seller/interview-notes/${noteId}`);

      toast.success('Note supprimée avec succès');
      await fetchNotes();
      
      // Si on supprimait la note de la date sélectionnée, réinitialiser
      if (date === selectedDate) {
        setNoteContent('');
        setEditingNote(null);
      }
    } catch (error) {
      logger.error('Error deleting note:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    const note = getNoteForDate(date);
    if (note) {
      setNoteContent(note.content);
      setEditingNote(note.id);
    } else {
      setNoteContent('');
      setEditingNote(null);
    }
  };

  // Trier les notes par date (plus récentes en premier)
  const sortedNotes = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Liste des notes */}
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
                    <div
                      key={note.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedDate === note.date
                          ? 'bg-pink-50 border-pink-300 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-pink-200'
                      }`}
                      onClick={() => handleDateChange(note.date)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-600">
                              {new Date(note.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {note.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleVisibility(note);
                            }}
                            disabled={toggling === note.id}
                            className={`p-1 transition-colors disabled:opacity-50 ${
                              note.shared_with_manager
                                ? 'text-blue-500 hover:text-blue-700'
                                : 'text-gray-400 hover:text-blue-500'
                            }`}
                            title={note.shared_with_manager ? 'Masquer au manager' : 'Partager avec le manager'}
                          >
                            {toggling === note.id ? (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : note.shared_with_manager ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditNote(note);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id, note.date);
                            }}
                            disabled={deleting === note.id}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            {deleting === note.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Édition */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Date selector */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de la note
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Note editor */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {currentNote ? 'Modifier la note' : 'Nouvelle note'}
              </label>
              
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Écris tes notes ici... Réfléchis à tes réussites, tes défis, tes souhaits, tes questions pour l'entretien..."
                className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                rows={10}
              />

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-500">
                  {currentNote ? (
                    <span>Note créée le {new Date(currentNote.created_at).toLocaleDateString('fr-FR')}</span>
                  ) : (
                    <span>Note pour le {new Date(selectedDate).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {editingNote && (
                    <button
                      onClick={() => {
                        setNoteContent('');
                        setEditingNote(null);
                        const note = getNoteForDate(selectedDate);
                        if (note) {
                          setNoteContent(note.content);
                        }
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={editingNote ? handleUpdateNote : handleSaveNote}
                    disabled={saving || !noteContent.trim()}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {editingNote ? 'Mettre à jour' : 'Enregistrer'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 bg-blue-50 border-t border-blue-200">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">💡 Astuce</p>
                  <p className="text-blue-700">
                    Prends des notes régulièrement sur tes réussites, défis, formations souhaitées, etc.
                    L'IA créera une synthèse claire basée sur tes notes et tes chiffres pour ton entretien.
                  </p>
                  <p className="text-blue-600 mt-1">
                    <Eye className="w-3 h-3 inline mr-1" />
                    Clique sur l'icône œil pour choisir quelles notes ton manager peut voir dans son guide.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {notes.length > 0 && (
              <span>
                {notes.length} note{notes.length > 1 ? 's' : ''} enregistrée{notes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Fermer
            </button>
            {onGenerateSynthesis && notes.length > 0 && (
              <button
                onClick={() => {
                  onClose();
                  onGenerateSynthesis();
                }}
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
