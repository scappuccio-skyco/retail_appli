import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { toast } from 'sonner';
import { Building2, Users, Mail, User, MessageSquare, Sparkles, ArrowRight, Check } from 'lucide-react';
import Logo from '../components/shared/Logo';

export default function EarlyAccess() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    enseigne: '',
    nombreVendeurs: '',
    defiPrincipal: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.fullName || !formData.email || !formData.enseigne || !formData.nombreVendeurs || !formData.defiPrincipal) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    setLoading(true);

    try {
      // Envoyer les données par email via l'API
      await api.post('/early-access/qualify', {
        full_name: formData.fullName,
        email: formData.email,
        enseigne: formData.enseigne,
        nombre_vendeurs: Number.Number.parseInt(formData.nombreVendeurs) || 0,
        defi_principal: formData.defiPrincipal
      });

      toast.success('Candidature envoyée avec succès !');
      
      // Stocker dans localStorage pour la redirection après signup et la page de succès
      localStorage.setItem('early_adopter_candidate', JSON.stringify({
        email: formData.email,
        fullName: formData.fullName,
        enseigne: formData.enseigne,
        nombreVendeurs: Number.Number.parseInt(formData.nombreVendeurs) || 0
      }));

      // Rediriger vers la page de succès immédiatement
      setTimeout(() => {
        navigate('/early-access-success');
      }, 500);
    } catch (error) {
      logger.error('Error submitting early access form:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi de votre candidature');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F1F5F9]">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Logo variant="header" size="md" />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Formulaire */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Programme Pilote</h1>
                <p className="text-gray-600">Rejoignez les pionniers du Retail IA</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nom Complet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom Complet *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
                    placeholder="Jean Dupont"
                  />
                </div>
              </div>

              {/* Email Pro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Professionnel *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
                    placeholder="jean.dupont@monenseigne.com"
                  />
                </div>
              </div>

              {/* Enseigne */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de votre Enseigne *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="enseigne"
                    value={formData.enseigne}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
                    placeholder="Ma Boutique"
                  />
                </div>
              </div>

              {/* Nombre de Vendeurs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de Vendeurs *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="nombreVendeurs"
                    value={formData.nombreVendeurs}
                    onChange={handleChange}
                    required
                    min="1"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all"
                    placeholder="5"
                  />
                </div>
              </div>

              {/* Défi Principal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quel est votre défi n°1 en management actuel ? *
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="defiPrincipal"
                    value={formData.defiPrincipal}
                    onChange={handleChange}
                    required
                    rows="4"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition-all resize-none"
                    placeholder="Ex: Motiver mon équipe, suivre les performances, former les nouveaux vendeurs..."
                  />
                </div>
              </div>

              {/* Bouton Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Postuler au Programme Pilote
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                En soumettant ce formulaire, vous acceptez d'être contacté par notre équipe.
              </p>
            </form>
          </div>

          {/* Argumentaire */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-4">🚀 Rejoignez 5 Magasins Pionniers</h2>
              <p className="text-lg mb-6 opacity-95">
                Co-construisez l'IA de performance Retail de demain avec nous.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Accompagnement VIP</h3>
                    <p className="text-sm opacity-90">Séance de configuration personnalisée de 15 min</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Tarif Fondateur à 19€/vendeur</h3>
                    <p className="text-sm opacity-90">Bloqué à vie, jamais d'augmentation</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Audit DISC & Profil Métier</h3>
                    <p className="text-sm opacity-90">Inclus pour Manager et Vendeurs</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Influence Directe sur le Produit</h3>
                    <p className="text-sm opacity-90">Vos retours façonnent les fonctionnalités</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">💡 Pourquoi ce Programme ?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Nous cherchons 5 magasins pilotes pour valider notre approche avant le lancement public. 
                En échange de votre engagement et de vos retours, vous bénéficiez d'un tarif préférentiel 
                à vie et d'un accompagnement personnalisé pour maximiser votre ROI.
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">⏱️ Processus</h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-semibold">1.</span>
                  <span>Vous postulez via ce formulaire</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">2.</span>
                  <span>Nous vous contactons sous 24h ouvrées</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">3.</span>
                  <span>Création de votre compte et séance de configuration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold">4.</span>
                  <span>Activation de votre Tarif Fondateur</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
