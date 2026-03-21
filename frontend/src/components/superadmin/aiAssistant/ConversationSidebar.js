import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';

export default function ConversationSidebar({ conversations, conversationId, onLoad, onNew, onDelete }) {
  return (
    <div className="w-64 bg-white/5 backdrop-blur-lg rounded-lg border border-white/20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Conversations
        </h3>
        <button
          onClick={onNew}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-all"
        >
          Nouveau
        </button>
      </div>

      <div className="space-y-2">
        {conversations.length === 0 ? (
          <p className="text-sm text-purple-300 text-center py-4">Aucune conversation</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded-lg transition-all group relative ${
                conv.id === conversationId
                  ? 'bg-purple-600/30 border border-purple-500/50'
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              }`}
            >
              <div onClick={() => onLoad(conv.id)} className="cursor-pointer pr-8">
                <p className="text-sm text-white font-medium truncate">{conv.title}</p>
                <p className="text-xs text-purple-300 mt-1">
                  {new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
