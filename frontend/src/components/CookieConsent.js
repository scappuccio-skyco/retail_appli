import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, Check, Settings } from 'lucide-react';

/**
 * Cookie Consent Banner - RGPD Compliant
 * Affiche un bandeau de consentement aux cookies conforme au RGPD
 */
export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Toujours activé
    functional: false,
    analytics: false,
  });

  useEffect(() => {
    // Vérifier si le consentement a déjà été donné
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Délai pour afficher le bandeau après le chargement de la page
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const consentData = {
      necessary: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consentData));
    setShowBanner(false);
  };

  const handleAcceptNecessary = () => {
    const consentData = {
      necessary: true,
      functional: false,
      analytics: false,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consentData));
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    const consentData = {
      ...preferences,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consentData));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-[9998]" />
      
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-slide-up">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Main content */}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Cookie icon */}
              <div className="hidden sm:flex items-center justify-center w-12 h-12 bg-[#F97316]/10 rounded-full flex-shrink-0">
                <Cookie className="w-6 h-6 text-[#F97316]" />
              </div>
              
              {/* Text */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#1E40AF] mb-2 flex items-center gap-2">
                  <Cookie className="w-5 h-5 sm:hidden text-[#F97316]" />
                  Nous respectons votre vie privée
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Nous utilisons des cookies pour assurer le bon fonctionnement de notre site et améliorer votre expérience. 
                  Les cookies essentiels sont nécessaires au fonctionnement du site. Vous pouvez choisir d&apos;accepter 
                  ou de refuser les cookies optionnels.
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  En savoir plus dans notre{' '}
                  <Link to="/privacy" className="text-[#F97316] hover:underline" onClick={() => setShowBanner(false)}>
                    Politique de Confidentialité
                  </Link>
                </p>
              </div>
            </div>

            {/* Detailed preferences */}
            {showDetails && (
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                {/* Necessary cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800">Cookies essentiels</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Nécessaires au fonctionnement du site (authentification, sécurité)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium">Toujours actifs</span>
                    <div className="w-10 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                      <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>
                </div>

                {/* Functional cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800">Cookies fonctionnels</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Mémorisation de vos préférences (langue, thème)
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences(p => ({ ...p, functional: !p.functional }))}
                    className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                      preferences.functional ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                  </button>
                </div>

                {/* Analytics cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800">Cookies analytiques</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Statistiques anonymes d&apos;utilisation pour améliorer le service
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                    className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                      preferences.analytics ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                  </button>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {!showDetails ? (
                <>
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Tout accepter
                  </button>
                  <button
                    onClick={handleAcceptNecessary}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Refuser les optionnels
                  </button>
                  <button
                    onClick={() => setShowDetails(true)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-xl hover:border-[#1E40AF] hover:text-[#1E40AF] transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Personnaliser
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSavePreferences}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Enregistrer mes choix
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                  >
                    Tout accepter
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-xl hover:border-gray-400 transition-colors"
                  >
                    Retour
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </>
  );
}
