import React from 'react';
import { Briefcase, TrendingUp, Zap } from 'lucide-react';

export default function SocialProofSection() {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-50 to-slate-50 border-y border-[#1E40AF]/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <p className="text-lg sm:text-xl font-semibold text-[#334155] mb-8">
            Une solution conçue par des experts terrain, pour les gérants, managers et équipes retail
          </p>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* Carte 1 - L'Expertise */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
              <div className="flex items-center justify-center w-12 h-12 bg-[#1E40AF]/10 rounded-full mb-4 mx-auto">
                <Briefcase className="w-6 h-6 text-[#1E40AF]" />
              </div>
              <h3 className="text-lg font-bold text-[#1E40AF] mb-3">ADN 100% Retail</h3>
              <p className="text-[#334155] text-sm leading-relaxed">
                Pas de théorie, que du terrain. Outil conçu par des Experts de la Vente et du Management cumulant plus de 20 ans d'expérience opérationnelle.
              </p>
              <p className="text-xs text-[#64748B] mt-4 font-medium">L'Équipe Fondatrice</p>
            </div>

            {/* Carte 2 - La Méthode */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
              <div className="flex items-center justify-center w-12 h-12 bg-[#F97316]/10 rounded-full mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-[#F97316]" />
              </div>
              <h3 className="text-lg font-bold text-[#1E40AF] mb-3">Méthodologie Éprouvée</h3>
              <p className="text-[#334155] text-sm leading-relaxed">
                Basé sur les piliers de l'excellence Retail : Cérémonial de Vente, Vente Complémentaire et Coaching Situationnel.
              </p>
              <p className="text-xs text-[#64748B] mt-4 font-medium">Best Practices Retail</p>
            </div>

            {/* Carte 3 - L'Innovation */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-[#1E40AF] mb-3">Une Suite Complète</h3>
              <p className="text-[#334155] text-sm leading-relaxed">
                Coaching IA, Analyse des Ventes, Préparation des Évaluations, Suivi des Objectifs & Challenges et Analyse d'Équipe. Tout ce qu'il faut pour piloter la performance.
              </p>
              <p className="text-xs text-[#64748B] mt-4 font-medium">Fonctionnalités Clés</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
