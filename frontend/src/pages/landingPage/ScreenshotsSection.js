import React from 'react';
import { Check, Building2, Users, BarChart3 } from 'lucide-react';

export default function ScreenshotsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
            Une Interface Moderne et Intuitive
          </h2>
          <p className="text-xl text-[#334155]">
            Découvrez la puissance de Retail Performer AI
          </p>
        </div>

        <div className="space-y-12">
          {/* Screenshot 1 */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Manager</h3>
              <p className="text-lg text-[#334155] mb-6">
                Visualisez la performance de votre équipe en un coup d'œil.
                KPI, comparaisons, graphiques et alertes intelligentes.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Repérez un vendeur en difficulté avant que les KPI chutent',
                  'Comparez vos équipes en un clic',
                  'Recevez des alertes intelligentes sur les performances',
                  'Exportez vos rapports pour votre hiérarchie'
                ].map((item, idx) => (
                  <li key={`manager-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-gradient-to-r from-[#F97316]/10 to-[#EA580C]/5 border-l-4 border-[#F97316] p-4 rounded-r-lg">
                <p className="text-sm font-semibold text-[#F97316] mb-2">🤝 Gestion de Conflit Manager-Vendeur</p>
                <p className="text-sm text-[#334155]">
                  Gérez les situations délicates avec des recommandations IA basées sur les profils DISC, les performances et l'historique de chaque vendeur.
                </p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1E40AF]/20">
              <img
                src="/dashboard-manager.png"
                alt="Dashboard Manager - Vue d'ensemble KPI"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>

          {/* Screenshot 2 */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="md:order-2">
              <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Vendeur</h3>
              <p className="text-lg text-[#334155] mb-6">
                Interface personnalisée pour chaque vendeur avec coach IA, défis quotidiens et suivi de performance.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Objectifs clairs chaque jour',
                  'Conseils personnalisés par l\'IA en temps réel',
                  'Analyse de progression semaine après semaine',
                  'Visualisation des compétences à développer'
                ].map((item, idx) => (
                  <li key={`seller-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-gradient-to-r from-[#1E40AF]/10 to-[#1E40AF]/5 border-l-4 border-[#1E40AF] p-4 rounded-r-lg">
                <p className="text-sm font-semibold text-[#1E40AF] mb-2">💡 Analyses des Ventes Intelligentes</p>
                <p className="text-sm text-[#334155]">
                  Après chaque vente, analyse en quelques clics. L'IA analyse la situation et génère des recommandations personnalisées instantanées.
                </p>
              </div>
            </div>
            <div className="md:order-1 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1E40AF]/20">
              <img
                src="/dashboard-vendeur.png"
                alt="Dashboard Vendeur - Mon Bilan Individuel"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>

          {/* Screenshot 3 - Dashboard Gérant */}
          <div className="grid md:grid-cols-2 gap-8 items-center pt-8 border-t border-gray-200">
            <div>
              <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Gérant Multi-Magasins</h3>
              <p className="text-lg text-[#334155] mb-6">
                Pilotez l'ensemble de votre réseau depuis une interface centralisée.
                Vision 360° de tous vos magasins, managers et vendeurs.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Vue consolidée du CA et des KPI de tous vos points de vente',
                  'Gestion centralisée des magasins (création, modification, équipes)',
                  'Suivi de tous vos managers et vendeurs en temps réel',
                  'Comparaison de performance entre magasins',
                  'Intégrations API pour synchroniser vos données existantes'
                ].map((item, idx) => (
                  <li key={`gerant-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <Building2 className="w-6 h-6 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-600">∞</p>
                  <p className="text-xs text-gray-600">Magasins</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-600">∞</p>
                  <p className="text-xs text-gray-600">Managers</p>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-600">100%</p>
                  <p className="text-xs text-gray-600">Visibilité</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <p className="text-sm font-semibold text-purple-700 mb-2">🏢 Fonctionnalités Gérant Exclusives</p>
                <p className="text-sm text-[#334155]">
                  Invitez vos managers par email, gérez les permissions, configurez vos intégrations API et accédez à des rapports consolidés pour votre direction.
                </p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-200">
              <img
                src="/dashboard-gerant.png"
                alt="Dashboard Gérant - Vue Multi-Magasins"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
