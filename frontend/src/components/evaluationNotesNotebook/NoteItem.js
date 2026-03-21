import React from 'react';
import { Calendar, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';

export default function NoteItem({ note, selectedDate, toggling, deleting, onSelect, onEdit, onToggleVisibility, onDelete }) {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        selectedDate === note.date
          ? 'bg-pink-50 border-pink-300 shadow-sm'
          : 'bg-white border-gray-200 hover:border-pink-200'
      }`}
      onClick={() => onSelect(note.date)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-600">
              {new Date(note.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <p className="text-sm text-gray-700 line-clamp-2">{note.content}</p>
          {note.manager_reply && (
            <p className="text-[10px] text-blue-500 font-semibold mt-1">💬 Réponse du manager</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(note); }}
            disabled={toggling === note.id}
            className={`p-1 transition-colors disabled:opacity-50 ${
              note.shared_with_manager ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-blue-500'
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
            onClick={(e) => { e.stopPropagation(); onEdit(note); }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Modifier"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(note.id, note.date); }}
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
  );
}
