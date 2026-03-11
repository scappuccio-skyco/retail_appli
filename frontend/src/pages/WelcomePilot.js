import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import { CheckCircle, Calendar, Sparkles, ArrowRight } from 'lucide-react';
import Logo from '../components/shared/Logo';

export default function WelcomePilot() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Récupérer le nom de l'utilisateur depuis localStorage ou l'API
    const earlyAdopterData = localStorage.getItem('early_adopter_candidate');
    if (earlyAdopterData) {
      try {
        const data = JSON.parse(earlyAdopterData);
        setUserName(data.fullName || '');
      } catch (e) {
        logger.error('Error parsing early adopter data:', e);
      }
    }

  }, []);

  const handleCalendlyClick = () => {
    const calendlyUrl = 'https://calendly.com/s-cappuccio-skyco/configuration-programme-pilote-retail-performer-ai';
    globalThis.open(calendlyUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F1F5F9] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo variant="header" size="lg" />
        </div>

        {/* Card de Bienvenue */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-12">
          {/* Icône de succès */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Titre */}
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-4">
            Bienvenue parmi nos Pionniers{userName ? `, ${userName}` : ''} ! ✨
          </h1>

          {/* Message principal */}
          <div className="space-y-6 mb-8">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              Votre espace est créé. Pour activer votre <strong className="text-[#F97316]">Tarif Fondateur à 19€/vendeur</strong> et configurer vos diagnostics 
              (Profil Manager & Profil Vendeur), réservons votre séance de configuration de 15 min.
            </p>

            {/* Points clés */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Tarif Fondateur bloqué à vie</p>
                    <p className="text-sm text-gray-600">19€/vendeur, jamais d'augmentation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Diagnostics inclus</p>
                    <p className="text-sm text-gray-600">Profil Manager & Profil Vendeur (DISC)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Accompagnement VIP</p>
                    <p className="text-sm text-gray-600">Configuration personnalisée et support prioritaire</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bouton Calendly */}
          <div className="text-center mb-6">
            <button
              onClick={handleCalendlyClick}
              className="px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <Calendar className="w-5 h-5" />
              Réserver mon créneau (Calendly)
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Mention de suivi */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-800 text-center">
              <strong>💬 Je reviendrai vers vous personnellement sous 24h ouvrées</strong> pour valider votre accès et répondre à toutes vos questions.
            </p>
          </div>

          {/* Bouton Accéder au Dashboard (optionnel) */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                localStorage.removeItem('early_adopter_candidate');
                globalThis.location.href = '/dashboard';
              }}
              className="text-[#F97316] hover:text-[#EA580C] font-medium transition-colors"
            >
              Accéder à mon espace →
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Questions ? Contactez-nous à <a href="mailto:hello@retailperformerai.com" className="text-[#F97316] hover:underline">hello@retailperformerai.com</a>
        </p>
      </div>
    </div>
  );
}
