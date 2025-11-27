import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles, Loader2, Trash2, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [appContext, setAppContext] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/superadmin/ai-assistant/conversations`, { headers });
      setConversations(res.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/superadmin/ai-assistant/conversation/${convId}`, { headers });
      setMessages(res.data.messages || []);
      setConversationId(convId);
    } catch (error) {
      toast.error('Erreur lors du chargement de la conversation');
      console.error('Error loading conversation:', error);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  const deleteConversation = async (convId) => {
    if (!window.confirm('Supprimer cette conversation ?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/superadmin/ai-assistant/conversation/${convId}`, { headers });
      toast.success('Conversation supprimée');
      
      if (convId === conversationId) {
        startNewConversation();
      }
      
      fetchConversations();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.post(
        `${API}/superadmin/ai-assistant/chat`,
        {
          message: userMessage,
          conversation_id: conversationId
        },
        { headers }
      );

      // Add assistant response
      const assistantMsg = {
        role: 'assistant',
        content: res.data.message,
        timestamp: res.data.timestamp
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Update conversation ID if new
      if (!conversationId && res.data.conversation_id) {
        setConversationId(res.data.conversation_id);
        fetchConversations();
      }

      // Update context info
      if (res.data.context_used) {
        setAppContext(res.data.context_used);
      }

    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message');
      console.error('Error sending message:', error);
      
      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (actionType, targetId, params = {}) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.post(
        `${API}/superadmin/ai-assistant/execute-action`,
        {
          action_type: actionType,
          target_id: targetId,
          params: params
        },
        { headers }
      );

      toast.success(res.data.message);
      
      // Add confirmation message to chat
      const confirmMsg = {
        role: 'assistant',
        content: `✅ Action exécutée avec succès : ${res.data.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, confirmMsg]);
      
    } catch (error) {
      toast.error('Erreur lors de l\'exécution de l\'action');
      console.error('Error executing action:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Sidebar - Conversations */}
      <div className="w-64 bg-white/5 backdrop-blur-lg rounded-lg border border-white/20 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Conversations
          </h3>
          <button
            onClick={startNewConversation}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-all"
          >
            Nouveau
          </button>
        </div>

        <div className="space-y-2">
          {conversations.length === 0 ? (
            <p className="text-sm text-purple-300 text-center py-4">
              Aucune conversation
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 rounded-lg cursor-pointer transition-all group ${
                  conv.id === conversationId
                    ? 'bg-purple-600/30 border border-purple-500/50'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div
                  onClick={() => loadConversation(conv.id)}
                  className="flex-1"
                >
                  <p className="text-sm text-white font-medium truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-purple-300 mt-1">
                    {new Date(conv.updated_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
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
                <p className="text-sm text-purple-200">
                  Posez vos questions sur l'application, les logs, ou les problèmes
                </p>
              </div>
            </div>
            {appContext && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                {appContext.health_status === 'healthy' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                )}
                <span className="text-sm text-white">
                  {appContext.errors_count || 0} erreurs détectées
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Sparkles className="w-16 h-16 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Bienvenue dans l'Assistant IA
              </h3>
              <p className="text-purple-200 max-w-md mb-6">
                Je peux vous aider à diagnostiquer les problèmes, analyser les logs, 
                et gérer votre plateforme. Posez-moi vos questions !
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                <button
                  onClick={() => setInput("Pourquoi ai-je autant d'erreurs dans les logs aujourd'hui ?")}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm text-white transition-all"
                >
                  📊 Analyser les erreurs récentes
                </button>
                <button
                  onClick={() => setInput("Quels workspaces ont des problèmes actuellement ?")}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm text-white transition-all"
                >
                  🔍 Vérifier les workspaces
                </button>
                <button
                  onClick={() => setInput("Donne-moi un résumé de la santé de la plateforme")}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm text-white transition-all"
                >
                  💚 État de santé global
                </button>
                <button
                  onClick={() => setInput("Quelles sont les actions admin récentes ?")}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm text-white transition-all"
                >
                  📜 Actions administratives
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold text-purple-200 mb-3 mt-4 first:mt-0" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-purple-300 mb-2 mt-3 first:mt-0" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-base font-semibold text-purple-300 mb-2 mt-2 first:mt-0" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-white leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1 text-white" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1 text-white" {...props} />,
                          li: ({node, ...props}) => <li className="ml-2 text-white" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-purple-200" {...props} />,
                          em: ({node, ...props}) => <em className="italic text-purple-200" {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline ? (
                              <code className="px-1.5 py-0.5 bg-black/30 rounded text-purple-200 text-sm font-mono" {...props} />
                            ) : (
                              <code className="block p-2 bg-black/30 rounded text-purple-200 text-sm font-mono my-2 overflow-x-auto" {...props} />
                            ),
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-purple-500 pl-4 my-2 italic text-purple-200" {...props} />,
                          a: ({node, ...props}) => <a className="text-purple-400 hover:text-purple-300 underline" {...props} />,
                          hr: ({node, ...props}) => <hr className="my-4 border-white/20" {...props} />
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-3">
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/20 bg-white/5">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez votre question à l'assistant IA..."
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 resize-none focus:outline-none focus:border-purple-500 transition-all"
              rows="2"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
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
