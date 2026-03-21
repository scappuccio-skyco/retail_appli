import React from 'react';
import { Send, Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import useAIAssistant from './aiAssistant/useAIAssistant';
import ConversationSidebar from './aiAssistant/ConversationSidebar';
import MessageList from './aiAssistant/MessageList';

export default function AIAssistant() {
  const {
    messages, input, setInput, loading, conversationId,
    conversations, appContext, messagesEndRef,
    loadConversation, startNewConversation, deleteConversation,
    sendMessage, handleKeyPress,
  } = useAIAssistant();

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      <ConversationSidebar
        conversations={conversations}
        conversationId={conversationId}
        onLoad={loadConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
      />

      <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-lg rounded-lg border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/20 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Assistant IA SuperAdmin</h2>
                <p className="text-sm text-purple-200">Posez vos questions sur l'application, les logs, ou les problèmes</p>
              </div>
            </div>
            {appContext && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                {appContext.health_status === 'healthy'
                  ? <CheckCircle className="w-5 h-5 text-green-400" />
                  : <AlertCircle className="w-5 h-5 text-orange-400" />}
                <span className="text-sm text-white">{appContext.errors_count || 0} erreurs détectées</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <MessageList
            messages={messages}
            loading={loading}
            messagesEndRef={messagesEndRef}
            onQuickPrompt={setInput}
          />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/20 bg-white/5">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez votre question à l'assistant IA..."
              rows="2"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 resize-none focus:outline-none focus:border-purple-500 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-purple-300 mt-2">
            💡 Appuyez sur Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne
          </p>
        </div>
      </div>
    </div>
  );
}
