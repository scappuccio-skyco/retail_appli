import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

export default function useEvaluationNotesNotebook({ isOpen }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    if (isOpen) fetchNotes();
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

  const getNoteForDate = (date) => notes.find(note => note.date === date);
  const currentNote = getNoteForDate(selectedDate);
  const sortedNotes = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleDateChange = (date) => {
    setSelectedDate(date);
    const note = getNoteForDate(date);
    if (note) { setNoteContent(note.content); setEditingNote(note.id); }
    else { setNoteContent(''); setEditingNote(null); }
  };

  const handleEditNote = (note) => {
    setSelectedDate(note.date);
    setNoteContent(note.content);
    setEditingNote(note.id);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) { toast.error('Veuillez saisir une note'); return; }
    try {
      setSaving(true);
      await api.post('/seller/interview-notes', { date: selectedDate, content: noteContent.trim() });
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

  const handleUpdateNote = async () => {
    if (!noteContent.trim()) { toast.error('Veuillez saisir une note'); return; }
    try {
      setSaving(true);
      await api.put(`/seller/interview-notes/${editingNote}`, { content: noteContent.trim() });
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
      await api.patch(`/seller/interview-notes/${note.id}/visibility`, { shared_with_manager: newShared });
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, shared_with_manager: newShared } : n));
      toast.success(newShared ? '✅ Note partagée avec le manager' : '🔒 Note masquée au manager');
    } catch (error) {
      logger.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setToggling(null);
    }
  };

  const handleDeleteNote = async (noteId, date) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) return;
    try {
      setDeleting(noteId);
      await api.delete(`/seller/interview-notes/${noteId}`);
      toast.success('Note supprimée avec succès');
      await fetchNotes();
      if (date === selectedDate) { setNoteContent(''); setEditingNote(null); }
    } catch (error) {
      logger.error('Error deleting note:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleCancelEdit = () => {
    setNoteContent('');
    setEditingNote(null);
    const note = getNoteForDate(selectedDate);
    if (note) setNoteContent(note.content);
  };

  return {
    notes, loading, sortedNotes, currentNote,
    selectedDate, noteContent, setNoteContent,
    editingNote, saving, deleting, toggling,
    handleDateChange, handleEditNote, handleSaveNote,
    handleUpdateNote, handleToggleVisibility, handleDeleteNote, handleCancelEdit,
  };
}
