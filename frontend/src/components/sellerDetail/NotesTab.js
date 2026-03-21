import React from 'react';
import { StickyNote } from 'lucide-react';

const MONTHS_FR = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];
function formatNoteDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function NotesTab({
  seller,
  sharedNotes,
  notesLoading,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  sendingReply,
  handleSendReply,
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-800">Notes partagées</h3>
        </div>
        {sharedNotes.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
            {sharedNotes.length}
          </span>
        )}
      </div>

      {notesLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-amber-500 border-t-transparent" />
        </div>
      ) : sharedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <StickyNote className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-sm">Aucune note partagée</p>
            <p className="text-gray-400 text-xs mt-1">{seller.name} n'a pas encore partagé de notes avec vous.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sharedNotes.map(note => (
            <div key={note.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {formatNoteDate(note.date || note.created_at)}
              </span>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{note.content}</p>

              {note.manager_reply && replyingTo !== note.id && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-[11px] font-semibold text-blue-600 mb-1">Votre réponse :</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.manager_reply}</p>
                </div>
              )}

              {replyingTo === note.id ? (
                <div className="mt-3 pt-3 border-t border-amber-200 flex flex-col gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Votre réponse au vendeur…"
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText(''); }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleSendReply(note.id)}
                      disabled={sendingReply || !replyText.trim()}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
                    >
                      {sendingReply ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setReplyingTo(note.id); setReplyText(note.manager_reply || ''); }}
                  className="mt-2.5 text-[11px] text-blue-500 hover:text-blue-700 font-medium"
                >
                  {note.manager_reply ? '✏️ Modifier la réponse' : '💬 Répondre'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
