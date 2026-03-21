import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Zap, TrendingUp } from 'lucide-react';

export default function HeroSection({ scrollToSection }) {
  const navigate = useNavigate();

  return (
    <section className="pt-40 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-full shadow-sm mb-4 sm:mb-6 border-2 border-[#1E40AF]/20">
              <Zap className="w-4 h-4 text-[#F97316]" />
              <span className="text-xs sm:text-sm font-semibold text-[#1E40AF]">Propulsé par l'Intelligence Artificielle</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 sm:mb-6">
              <span className="text-[#1E40AF]">Transformez Vos Vendeurs en</span>{' '}
              <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                Experts
              </span>
            </h1>

            {/* Sous-titre avec preuve - Taille réduite */}
            <p className="text-base sm:text-lg font-semibold text-[#F97316] mb-3 sm:mb-4 leading-relaxed">
              Objectif : Boostez vos ventes jusqu'à +30%
            </p>

            <p className="text-sm sm:text-base text-[#334155] mb-6 sm:mb-8 leading-relaxed">
              Rejoignez notre programme Pilote pour co-construire l'avenir du management Retail et bénéficiez d'un tarif fondateur exclusif.
              <span className="hidden sm:inline"><br />L'Assistant Intelligent qui coache vos vendeurs et rédige vos bilans RH, tout en sécurisant votre management.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={() => navigate('/early-access')}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-base sm:text-lg font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
            >
              Essai Gratuit 14 Jours
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-[#1E40AF] text-base sm:text-lg font-semibold rounded-xl border-2 border-[#1E40AF] hover:bg-blue-50 transition-all"
              >
                Demander une Démo
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#334155]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" />
                <span>Résiliation à tout moment</span>
              </div>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white max-h-[500px]">
              <img
                src="/hero-retail-boutique.png"
                alt="Vendeuse professionnelle en boutique moderne"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Floating Badge */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6 border-2 border-[#1E40AF]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1E40AF]">+30%</p>
                  <p className="text-sm text-[#334155]">Objectif ventes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
