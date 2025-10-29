import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, Lock, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Login({ onLogin }) {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [isRegister, setIsRegister] = useState(!!inviteToken);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'seller',
    invitation_token: inviteToken || ''
  });
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);

  useEffect(() => {
    if (inviteToken) {
      verifyInvitation(inviteToken);
    }
  }, [inviteToken]);

  const verifyInvitation = async (token) => {
    try {
      const res = await axios.get(`${API}/invitations/verify/${token}`);
      setInviteInfo(res.data);
      setFormData(prev => ({ ...prev, email: res.data.email, invitation_token: token }));
      toast.success(`Invitation de ${res.data.manager_name}`);
    } catch (err) {
      toast.error('Invitation invalide ou expirée');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let endpoint, payload;
      
      if (inviteToken && isRegister) {
        // Registration with invitation
        endpoint = '/auth/register-with-invite';
        payload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          invitation_token: inviteToken
        };
      } else if (isRegister) {
        // Normal registration
        endpoint = '/auth/register';
        payload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        };
      } else {
        // Login
        endpoint = '/auth/login';
        payload = { email: formData.email, password: formData.password };
      }
      
      const res = await axios.post(`${API}${endpoint}`, payload);
      toast.success(isRegister ? 'Compte créé avec succès!' : 'Connexion réussie!');
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-morphism rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <img 
              src="/logo.jpg" 
              alt="Skyco Formation" 
              className="w-32 h-32 mx-auto mb-4 rounded-2xl shadow-lg object-cover"
            />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Retail Coach 2.0
            </h1>
            {inviteInfo ? (
              <p className="text-gray-600">
                Rejoignez l'équipe de {inviteInfo.manager_name}
              </p>
            ) : (
              <p className="text-gray-600">
                {isRegister ? 'Créez votre compte' : 'Connectez-vous'}
              </p>
            )}
          </div>

          <form data-testid="auth-form" onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    data-testid="name-input"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent transition-all"
                    placeholder="Votre nom"
                  />
                </div>
              </div>
            )}

            {isRegister && !inviteToken && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle
                </label>
                <select
                  data-testid="role-select"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent transition-all"
                >
                  <option value="seller">Vendeur</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  data-testid="email-input"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!inviteInfo}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent transition-all disabled:bg-gray-100"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  data-testid="password-input"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              data-testid="submit-button"
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Chargement...' : isRegister ? "S'inscrire" : 'Se connecter'}
            </button>
          </form>

          {!inviteToken && (
            <div className="mt-6 text-center">
              <button
                data-testid="toggle-auth-mode"
                onClick={() => setIsRegister(!isRegister)}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                {isRegister ? 'Déjà un compte? Se connecter' : "Pas de compte? S'inscrire"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
