import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';

export default function useAIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [appContext, setAppContext] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/superadmin/ai-assistant/conversations');
      setConversations(res.data.conversations || []);
    } catch (error) {
      logger.error('Error fetching conversations:', error);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const res = await api.get(`/superadmin/ai-assistant/conversation/${convId}`);
      setMessages(res.data.messages || []);
      setConversationId(convId);
    } catch (error) {
      toast.error('Erreur lors du chargement de la conversation');
      logger.error('Error loading conversation:', error);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  const deleteConversation = async (convId) => {
    if (!globalThis.confirm('Supprimer cette conversation ?')) return;
    try {
      await api.delete(`/superadmin/ai-assistant/conversation/${convId}`);
      toast.success('Conversation supprimée');
      if (convId === conversationId) startNewConversation();
      fetchConversations();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      logger.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }]);
    try {
      const res = await api.post('/superadmin/ai-assistant/chat', { message: userMessage, conversation_id: conversationId });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response || res.data.message,
        timestamp: res.data.timestamp || new Date().toISOString(),
      }]);
      if (!conversationId && res.data.conversation_id) {
        setConversationId(res.data.conversation_id);
        fetchConversations();
      }
      if (res.data.context_used) setAppContext(res.data.context_used);
    } catch (error) {
      toast.error("Erreur lors de l'envoi du message");
      logger.error('Error sending message:', error);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return {
    messages, input, setInput, loading, conversationId,
    conversations, appContext, messagesEndRef,
    loadConversation, startNewConversation, deleteConversation,
    sendMessage, handleKeyPress,
  };
}
