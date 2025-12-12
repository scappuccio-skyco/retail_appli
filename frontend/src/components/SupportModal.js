import React, { useState } from 'react';
import { X, Send, Headphones, MessageSquare, Bug, Lightbulb, CreditCard, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: 'general', label: 'Question générale', icon: MessageSquare, color: 'blue' },
  { id: 'bug', label: 'Bug / Problème', icon: Bug, color: 'red' },
  { id: 'feature', label: 'Suggestion', icon: Lightbulb, color: 'yellow' },
  { id: 'billing', label: 'Facturation', icon: CreditCard, color: 'green' }
];

const SupportModal = ({ isOpen, onClose }) => {
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // null, 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const resetForm = () => {
    setCategory('general');
    setSubject('');
    setMessage('');
    setStatus(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      setErrorMessage('Veuillez remplir tous les champs');
      return;
    }

    setSending(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/gerant/support/contact`,
        { subject, message, category },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setStatus('success');
      // Auto-close after 3 seconds on success
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error) {
      console.error('Error sending support message:', error);
      setStatus('error');
      setErrorMessage(error.response?.data?.detail || 'Une erreur est survenue lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Contacter le support</h2>
              <p className="text-emerald-100 text-sm">Nous vous répondrons rapidement</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Message envoyé !</h3>
              <p className="text-gray-600">
                Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Catégorie
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? cat.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                              cat.color === 'red' ? 'border-red-500 bg-red-50 text-red-700' :
                              cat.color === 'yellow' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' :
                              'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sujet *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Question sur les statistiques..."
                  maxLength={100}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Décrivez votre demande en détail..."
                  rows={5}
                  maxLength={5000}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {message.length}/5000 caractères
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{errorMessage}</span>
                </div>
              )}

              {/* Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p>💡 Vos informations de compte (email, enseigne) seront automatiquement incluses pour faciliter le traitement de votre demande.</p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {status !== 'success' && (
          <div className="border-t border-gray-100 p-4 bg-gray-50 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending || !subject.trim() || !message.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportModal;
