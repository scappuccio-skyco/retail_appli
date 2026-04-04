import React from 'react';
import { Check, X } from 'lucide-react';

export default function ProblemSolutionSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Accroche Marketing */}
        <div className="text-center mb-12 bg-gradient-to-r from-[#1E40AF]/10 via-[#F97316]/10 to-[#1E40AF]/10 rounded-2xl p-8 border-2 border-[#F97316]/30">
          <h2 className="text-3xl md:text-4xl font-bold text-[#334155] mb-6 max-w-4xl mx-auto leading-relaxed">
            Vous avez déjà les <strong className="text-[#1E40AF]">chiffres</strong>.<br />Retail Performer AI vous donne la <strong className="text-[#F97316]">stratégie</strong>.
          </h2>
          <p className="text-xl md:text-2xl text-[#64748B] max-w-3xl mx-auto">
            Ne perdez plus de temps à attendre les remontées de vos managers. Notre IA analyse vos KPI retail en temps réel et génère les plans d&apos;action pour chaque équipe.
          </p>
        </div>

        {/* Titre section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Le Défi des Gérants Retail
          </h2>
          <p className="text-xl text-[#334155] max-w-3xl mx-auto">
            Piloter plusieurs magasins, garder le cap sur les performances et développer ses équipes à distance — sans les bons outils, c&apos;est impossible.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Problem */}
          <div className="bg-gray-100 rounded-2xl p-8 border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-[#1E40AF] mb-6">Sans Retail Performer AI</h3>
            <ul className="space-y-4">
              {[
                'Pas de visibilité sur ce qui se passe quand vous n\'êtes pas là',
                'Remontées managers incomplètes ou trop tardives',
                'Impossible de savoir pourquoi un vendeur sous-performe',
                'Coaching générique — chaque vendeur traité pareil',
                'Turnover élevé et motivation en dents de scie',
                'Bilans et évaluations chronophages et risqués juridiquement',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <X className="w-6 h-6 text-[#64748B] flex-shrink-0 mt-0.5" />
                  <span className="text-[#334155]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="bg-gradient-to-br from-[#1E40AF]/10 to-[#1E40AF]/20 rounded-2xl p-8 border-2 border-[#1E40AF]">
            <h3 className="text-2xl font-bold text-[#1E40AF] mb-6">Avec Retail Performer AI</h3>
            <ul className="space-y-4">
              {[
                'Vue consolidée de tous vos magasins en temps réel',
                'Alertes automatiques dès qu\'un vendeur décroche',
                'Diagnostic DISC : vous savez pourquoi chaque profil performe ou bloque',
                'Briefs IA personnalisés par profil — managers et vendeurs alignés',
                'Vue 360° de la progression individuelle et collective',
                'Bilans rédigés en 10 secondes, conformes aux bonnes pratiques RH',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#10B981] flex-shrink-0 mt-0.5" />
                  <span className="text-[#334155]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
