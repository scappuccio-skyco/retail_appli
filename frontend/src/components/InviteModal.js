import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Mail, Copy, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const FRONTEND_URL = window.location.origin;

export default function InviteModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${API}/manager/invite`, { email });
      const token = res.data.token;
      const link = `${FRONTEND_URL}/login?invite=${token}`;
      setInviteLink(link);
      toast.success('Invitation créée avec succès!');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Lien copié!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div data-testid="invite-modal" className="bg-white rounded-3xl shadow-2xl max-w-lg w-full">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Inviter un Vendeur</h2>
          <button
            data-testid="close-invite-modal"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          {!inviteLink ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email du vendeur
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    data-testid="invite-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                    placeholder="vendeur@example.com"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Le vendeur recevra un lien d'inscription unique valable 7 jours
                </p>
              </div>

              <button
                data-testid="send-invite-button"
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Création...' : 'Créer l\'invitation'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800 mb-2">
                  ✓ Invitation créée avec succès!
                </p>
                <p className="text-xs text-green-700">
                  Partagez ce lien avec le vendeur pour qu'il puisse s'inscrire.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lien d'invitation
                </label>
                <div className="flex gap-2">
                  <input
                    data-testid="invite-link-input"
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm"
                  />
                  <button
                    data-testid="copy-invite-link"
                    onClick={copyToClipboard}
                    className="px-4 py-3 bg-[#ffd871] text-gray-800 rounded-xl hover:bg-[#ffc940] transition-colors flex items-center gap-2 font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                data-testid="close-invite-success"
                onClick={onClose}
                className="w-full btn-secondary"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
