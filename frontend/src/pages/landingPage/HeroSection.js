import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Zap } from 'lucide-react';

export default function HeroSection({ scrollToSection }) {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">

      {/* Background — photo boutique plein écran */}
      <div className="absolute inset-0">
        <img
          src="/hero-retail-boutique.png"
          alt="Boutique retail moderne"
          className="w-full h-full object-cover"
        />
        {/* Overlay sombre pour lisibilité */}
        <div className="absolute inset-0 bg-black/55" />
        {/* Gradient gauche pour accentuer la zone texte */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
      </div>

      {/* Contenu */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Colonne gauche — panneau verre frosté */}
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl">

            {/* Badge IA */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 border border-white/30 rounded-full mb-6">
              <Zap className="w-4 h-4 text-[#F97316]" />
              <span className="text-sm font-semibold text-white">Propulsé par l'Intelligence Artificielle</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4 text-white">
              Transformez vos vendeurs en{' '}
              <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                experts
              </span>
            </h1>

            <p className="text-lg font-semibold text-[#F97316] mb-3">
              Objectif : Boostez vos ventes jusqu'à +30%
            </p>

            <p className="text-sm sm:text-base text-white/80 mb-8 leading-relaxed">
              L'Assistant Intelligent qui coache vos vendeurs et rédige vos bilans RH,
              tout en sécurisant votre management.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <button
                onClick={() => navigate('/early-access')}
                className="px-7 py-3.5 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-base font-semibold rounded-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                Essai Gratuit 14 Jours
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="px-7 py-3.5 bg-white/15 backdrop-blur-sm text-white text-base font-semibold rounded-xl border border-white/40 hover:bg-white/25 transition-all"
              >
                Demander une Démo
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981]" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#10B981]" />
                <span>Résiliation à tout moment</span>
              </div>
            </div>
          </div>

          {/* Colonne droite — mockup dashboard flottant */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              {/* Halo lumineux derrière */}
              <div className="absolute -inset-4 bg-[#1E40AF]/30 rounded-3xl blur-2xl" />

              {/* Cadre verre du dashboard */}
              <div className="relative backdrop-blur-sm bg-white/10 border border-white/30 rounded-2xl p-2 shadow-2xl">
                <div className="rounded-xl overflow-hidden">
                  <img
                    src="/dashboard-manager.png"
                    alt="Dashboard Manager Retail Performer AI"
                    className="w-full max-w-md rounded-xl"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Badge flottant KPI */}
              <div className="absolute -bottom-5 -left-6 bg-white rounded-2xl shadow-2xl px-5 py-3 border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  +30%
                </div>
                <div>
                  <p className="text-xs text-gray-500">Objectif ventes</p>
                  <p className="text-sm font-bold text-[#1E40AF]">Atteint en 3 mois</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
