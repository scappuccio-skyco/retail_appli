import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Mail, Copy, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const FRONTEND_URL = window.location.origin;

export default function InviteModal({ onClose, onSuccess, sellerCount = 0, subscriptionInfo = null }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const textAreaRef = useRef(null);
  
  // Calculate remaining invites
  const maxSellers = subscriptionInfo?.plan_type === 'professional' ? 15 : 5;
  const remainingInvites = maxSellers - sellerCount;

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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Lien copié!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback using React ref for browsers that don't support clipboard API
      if (textAreaRef.current) {
        textAreaRef.current.value = inviteLink;
        textAreaRef.current.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          toast.success('Lien copié!');
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          toast.error('Erreur lors de la copie');
        }
      }
    }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
          {/* Remaining invites info */}
          {subscriptionInfo && (
            <div className={`mb-4 p-3 rounded-lg border-2 ${
              remainingInvites > 0 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <p className={`text-sm font-semibold ${
                remainingInvites > 0 ? 'text-green-800' : 'text-orange-800'
              }`}>
                {remainingInvites > 0 
                  ? `✅ ${remainingInvites} invitation${remainingInvites > 1 ? 's' : ''} restante${remainingInvites > 1 ? 's' : ''} (${sellerCount}/${maxSellers} vendeurs)`
                  : `⚠️ Limite atteinte (${sellerCount}/${maxSellers} vendeurs) - Passez au plan supérieur`
                }
              </p>
            </div>
          )}
          
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
                    disabled={remainingInvites <= 0}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                disabled={loading || remainingInvites <= 0}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Création...' : remainingInvites <= 0 ? 'Limite atteinte' : 'Créer l\'invitation'}
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
      {/* Hidden textarea for fallback clipboard copy - React-managed element */}
      <textarea
        ref={textAreaRef}
        style={{
          position: 'fixed',
          left: '-999999px',
          opacity: 0,
          pointerEvents: 'none'
        }}
        readOnly
        aria-hidden="true"
      />
    </div>
  );
}
