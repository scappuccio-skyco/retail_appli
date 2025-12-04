import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email });
      setEmailSent(true);
      toast.success('Email envoyé !');
    } catch (error) {
      // L'API retourne toujours un succès pour éviter l'énumération d'emails
      setEmailSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Mail className="w-8 h-8 text-[#1E40AF]" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Mot de passe oublié ?
            </h1>
            <p className="text-gray-600">
              Pas de souci, nous allons vous envoyer un lien de réinitialisation.
            </p>
          </div>

          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent transition-all"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </form>
          ) : (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Email envoyé !
                </h2>
                <p className="text-gray-600">
                  Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un email avec un lien de réinitialisation dans quelques instants.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-medium mb-1">⏱️ Le lien expire dans 10 minutes</p>
                <p>Vérifiez également vos spams si vous ne voyez pas l'email.</p>
              </div>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 text-[#1E40AF] hover:text-[#1E3A8A] font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
