import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Users } from 'lucide-react';

export default function PricingSection({ isAnnual, setIsAnnual, scrollToSection }) {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Tarifs Simples et Transparents
          </h2>
          <p className="text-xl text-[#334155] mb-4">
            Choisissez la formule qui correspond à votre équipe
          </p>

          {/* Toggle Mensuel/Annuel */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={`text-lg font-semibold ${!isAnnual ? 'text-[#334155]' : 'text-slate-400'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
                isAnnual ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  isAnnual ? 'transform translate-x-8' : ''
                }`}
              />
            </button>
            <span className={`text-lg font-semibold ${isAnnual ? 'text-[#334155]' : 'text-slate-400'}`}>
              Annuel
            </span>
            {isAnnual && (
              <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                Économisez 20%
              </span>
            )}
          </div>

          <div className="inline-flex items-center gap-3 bg-orange-50 border-2 border-[#F97316] rounded-full px-6 py-3">
            <Users className="w-5 h-5 text-[#EA580C]" />
            <p className="text-sm font-semibold text-[#334155]">
              Espace Gérant & Manager inclus
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Small Team */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#10B981]">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-[#10B981] mb-2">Small Team</h3>
              <p className="text-[#334155] mb-4">Petites boutiques</p>
              {!isAnnual ? (
                <div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-3xl font-bold text-gray-400 line-through">29€</span>
                    <span className="text-5xl font-bold text-[#334155]">19€</span>
                    <span className="text-[#334155]">/vendeur/mois</span>
                  </div>
                  <p className="text-xs text-[#F97316] font-semibold mt-1">Tarif Fondateur</p>
                  <p className="text-xs text-gray-500 mt-1">TTC</p>
                  <p className="text-sm text-green-600 font-semibold mt-2">
                    1 à 5 espaces vendeur
                  </p>
                  <p className="text-xs text-gray-600 mt-1">+ Espace Gérant & Manager inclus</p>
                  <p className="text-xs text-[#F97316] font-medium mt-2 italic">
                    Tarif bloqué à vie pour les 5 prochains magasins partenaires.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-[#334155]">278€</span>
                    <span className="text-[#334155]">/vendeur/an</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">TTC</p>
                  <p className="text-sm text-green-600 font-semibold mt-2">
                    1 à 5 espaces vendeur
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Au lieu de 348€ • Économisez 70€/vendeur/an • Espace Gérant & Manager inclus</p>
                </div>
              )}
            </div>

            <ul className="space-y-3 mb-4">
              {[
                'Dashboard Gérant, Manager & Vendeur',
                'Diagnostic Profil Manager',
                'Diagnostic Profil Vendeur',
                'Coaching IA & Briefs Matinaux',
                'Préparation des Évaluations',
                'Suivi KPI, Objectifs & Challenges',
                'Connexion API (Tous logiciels)'
              ].map((item, idx) => (
                <li key={`starter-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-[#334155]">{item}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#10B981]/30 my-4 pt-4">
              <p className="text-sm font-semibold text-[#10B981] mb-3">Spécificités :</p>
              <ul className="space-y-3 mb-4">
                {[
                  '1 à 5 vendeurs',
                  'Analyses IA illimitées',
                  'Support email sous 48h'
                ].map((item, idx) => (
                  <li key={`starter-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155] font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => navigate('/early-access')}
              className="w-full py-3 bg-[#10B981] text-white font-semibold rounded-xl hover:bg-[#059669] transition-colors"
            >
              Postuler au Programme Pilote
            </button>
          </div>

          {/* Medium Team */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#F97316]">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-[#F97316] mb-2">Medium Team</h3>
              <p className="text-[#334155] mb-4">Magasins moyens</p>
              {!isAnnual ? (
                <div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-3xl font-bold text-gray-400 line-through">25€</span>
                    <span className="text-5xl font-bold text-[#334155]">15€</span>
                    <span className="text-[#334155]">/vendeur/mois</span>
                  </div>
                  <p className="text-xs text-[#F97316] font-semibold mt-1">Tarif Fondateur</p>
                  <p className="text-xs text-gray-500 mt-1">TTC</p>
                  <p className="text-sm text-green-600 font-semibold mt-2">
                    6 à 15 espaces vendeur
                  </p>
                  <p className="text-xs text-gray-600 mt-1">+ Espace Gérant & Manager inclus</p>
                  <p className="text-xs text-[#F97316] font-medium mt-2 italic">
                    Tarif bloqué à vie pour les 5 prochains magasins partenaires.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-[#334155]">240€</span>
                    <span className="text-[#334155]">/vendeur/an</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">TTC</p>
                  <p className="text-sm text-green-600 font-semibold mt-2">
                    6 à 15 espaces vendeur
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Au lieu de 300€ • Économisez 60€/vendeur/an</p>
                </div>
              )}
            </div>

            <ul className="space-y-3 mb-4">
              {[
                'Dashboard Gérant, Manager & Vendeur',
                'Diagnostic Profil Manager',
                'Diagnostic Profil Vendeur',
                'Coaching IA & Briefs Matinaux',
                'Préparation des Évaluations',
                'Suivi KPI, Objectifs & Challenges',
                'Connexion API (Tous logiciels)'
              ].map((item, idx) => (
                <li key={`pro-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-[#334155]">{item}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#F97316]/30 my-4 pt-4">
              <p className="text-sm font-semibold text-[#F97316] mb-3">Spécificités :</p>
              <ul className="space-y-3 mb-4">
                {[
                  '6 à 15 vendeurs',
                  'Analyses IA illimitées',
                  'Support email sous 48h'
                ].map((item, idx) => (
                  <li key={`pro-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155] font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => navigate('/early-access')}
              className="w-full py-3 bg-[#F97316] text-white font-semibold rounded-xl hover:bg-[#EA580C] transition-colors"
            >
              Postuler au Programme Pilote
            </button>
          </div>

          {/* Large Team */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Large Team</h3>
              <p className="text-[#334155] mb-4">Pour réseaux & enseignes</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-3xl font-bold text-[#1E40AF]">Sur devis</span>
              </div>
              <p className="text-sm text-green-600 font-semibold mt-2">16+ espaces vendeur</p>
              <p className="text-xs text-gray-600 mt-1">+ Espace Gérant & Manager inclus</p>
            </div>

            <ul className="space-y-3 mb-4">
              {[
                'Dashboard Gérant, Manager & Vendeur',
                'Diagnostic Profil Manager',
                'Diagnostic Profil Vendeur',
                'Coaching IA & Briefs Matinaux',
                'Préparation des Évaluations',
                'Suivi KPI, Objectifs & Challenges',
                'Connexion API (Tous logiciels)'
              ].map((item, idx) => (
                <li key={`enterprise-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-[#334155]">{item}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#1E40AF]/30 my-4 pt-4">
              <p className="text-sm font-semibold text-[#1E40AF] mb-3">Spécificités :</p>
              <ul className="space-y-3 mb-4">
                {[
                  '16+ vendeurs',
                  'Analyses IA illimitées',
                  'Support prioritaire dédié'
                ].map((item, idx) => (
                  <li key={`enterprise-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155] font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => scrollToSection('contact')}
              className="w-full py-3 bg-[#1E40AF] text-white font-semibold rounded-xl hover:bg-[#1E3A8A] transition-colors"
            >
              Nous Contacter
            </button>
          </div>
        </div>

        {/* Pricing Footer */}
        <div className="text-center mt-12">
          {isAnnual && (
            <div className="inline-block mb-6 px-6 py-3 bg-green-50 border-2 border-green-200 rounded-xl">
              <p className="text-green-800 font-bold text-lg">
                🎉 Vous économisez jusqu'à 20% avec le paiement annuel !
              </p>
            </div>
          )}
          <div className="flex items-center justify-center gap-6 text-sm text-[#334155] flex-wrap">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span>14 jours d'essai gratuit</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span>Sans carte bancaire</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span>Résiliation à tout moment</span>
            </div>
            {isAnnual && (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#10B981]" />
                <span className="font-semibold">Facturation annuelle</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
