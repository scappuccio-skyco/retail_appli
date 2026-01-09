import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Calendar, Sparkles, ArrowRight, Mail } from 'lucide-react';
import Logo from '../components/shared/Logo';

export default function EarlyAccessSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [candidateData, setCandidateData] = useState(null);

  useEffect(() => {
    // Récupérer les données du candidat depuis localStorage
    const earlyAdopterData = localStorage.getItem('early_adopter_candidate');
    if (earlyAdopterData) {
      try {
        const data = JSON.parse(earlyAdopterData);
        setCandidateData(data);
      } catch (e) {
        console.error('Error parsing early adopter data:', e);
      }
    } else {
      // Si pas de données, rediriger vers early-access
      navigate('/early-access');
    }
  }, [navigate]);

  const handleCalendlyClick = () => {
    const calendlyUrl = 'https://calendly.com/s-cappuccio-skyco/configuration-programme-pilote-retail-performer-ai';
    window.open(calendlyUrl, '_blank');
  };

  const handleCreateAccount = () => {
    // Rediriger vers la page de signup avec le flag early_access
    navigate('/login?register=true&early_access=true');
  };

  if (!candidateData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F1F5F9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F1F5F9] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo variant="header" size="lg" />
        </div>

        {/* Card de Succès */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-12">
          {/* Icône de succès */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Titre */}
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-4">
            Candidature Enregistrée ! 🎉
          </h1>

          {/* Message principal */}
          <div className="space-y-6 mb-8">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              Merci <strong className="text-[#F97316]">{candidateData.fullName || 'cher candidat'}</strong> ! 
              Votre candidature pour <strong>{candidateData.enseigne || 'votre enseigne'}</strong> a bien été reçue.
            </p>

            {/* Points clés */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Email de confirmation envoyé</p>
                    <p className="text-sm text-gray-600">Vérifiez votre boîte mail à <strong>{candidateData.email}</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Validation en cours</p>
                    <p className="text-sm text-gray-600">Votre profil est en cours de validation pour le tarif fondateur à 19€/vendeur</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-[#F97316] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Accompagnement VIP</p>
                    <p className="text-sm text-gray-600">Séance de configuration personnalisée de 15 min avec le fondateur</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="space-y-4 mb-6">
            {/* Bouton Calendly */}
            <button
              onClick={handleCalendlyClick}
              className="w-full px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              Réserver mon créneau (Calendly)
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Bouton Créer Compte */}
            <button
              onClick={handleCreateAccount}
              className="w-full px-8 py-4 bg-white text-[#F97316] font-semibold rounded-xl border-2 border-[#F97316] hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
            >
              Créer mon compte gérant maintenant
              <span className="text-sm text-gray-600">(14 jours gratuits)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Mention de suivi */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-800 text-center">
              <strong>💬 Je reviendrai vers vous personnellement sous 24h ouvrées</strong> pour valider votre accès et répondre à toutes vos questions.
            </p>
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
