import React from 'react';
import { Check, X } from 'lucide-react';

export default function ProblemSolutionSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Accroche Marketing - Bannière Stratégie */}
        <div className="text-center mb-12 bg-gradient-to-r from-[#1E40AF]/10 via-[#F97316]/10 to-[#1E40AF]/10 rounded-2xl p-8 border-2 border-[#F97316]/30">
          <h2 className="text-3xl md:text-4xl font-bold text-[#334155] mb-6 max-w-4xl mx-auto leading-relaxed">
            Vous avez déjà les <strong className="text-[#1E40AF]">chiffres</strong>.<br />Retail Performer AI vous donne la <strong className="text-[#F97316]">stratégie</strong>.
          </h2>
          <p className="text-xl md:text-2xl text-[#64748B] max-w-3xl mx-auto">
            Ne perdez plus de temps à interpréter des tableaux complexes. Notre IA analyse vos KPI en temps réel et génère les plans d&apos;action pour vos équipes.
          </p>
        </div>

        {/* Titre section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Le Défi des Managers Retail
          </h2>
          <p className="text-xl text-[#334155] max-w-3xl mx-auto">
            Former, motiver et suivre vos vendeurs demande du temps et des outils adaptés.
            Retail Performer AI simplifie tout.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Problem */}
          <div className="bg-gray-100 rounded-2xl p-8 border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-[#1E40AF] mb-6">Sans Retail Performer AI</h3>
            <ul className="space-y-4">
              {[
                'Suivi manuel des performances sur Excel',
                'Difficile d\'identifier les axes d\'amélioration',
                'Coaching générique et peu personnalisé',
                'Pas de vue d\'ensemble sur l\'équipe',
                'Démotivation et turnover élevé'
              ].map((item, idx) => (
                <li key={`problem-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-3">
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
                'Dashboard automatisé en temps réel',
                'IA qui identifie points forts et faiblesses',
                'Coaching personnalisé adapté au profil DISC',
                'Vue 360° de la performance d\'équipe',
                'Sécurité Juridique : Une IA formée pour respecter les bonnes pratiques RH',
                'Gain de temps Admin : Vos reportings et bilans rédigés en 10 secondes'
              ].map((item, idx) => (
                <li key={`solution-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-3">
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
