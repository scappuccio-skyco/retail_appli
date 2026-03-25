import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';

export default function ConversationSidebar({ conversations, conversationId, onLoad, onNew, onDelete }) {
  return (
    <div className="w-64 bg-white rounded-lg border border-gray-200 shadow-sm p-4 overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-500" />
          Conversations
        </h3>
        <button
          onClick={onNew}
          className="px-3 py-1 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded text-sm transition-all"
        >
          Nouveau
        </button>
      </div>

      <div className="space-y-2">
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune conversation</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded-lg transition-all group relative ${
                conv.id === conversationId
                  ? 'bg-blue-50 border border-blue-300'
                  : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <div onClick={() => onLoad(conv.id)} className="cursor-pointer pr-8">
                <p className={`text-sm font-medium truncate ${conv.id === conversationId ? 'text-[#1E40AF]' : 'text-gray-800'}`}>
                  {conv.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
