import React from 'react';
import { Award, BarChart3, Sparkles, FileText } from 'lucide-react';

/**
 * Grille des 4 cartes du dashboard vendeur.
 * Ordre et visibilité contrôlés par dashboardFilters et finalOrder.
 */
export default function SellerDashboardGrid({
  finalOrder,
  dashboardFilters,
  activeObjectives,
  activeChallenges,
  onOpenPerformance,
  onOpenObjectives,
  onOpenCoaching,
  onOpenNotes,
}) {
  const filterKeyById = {
    performances: 'showPerformances',
    objectives:   'showObjectives',
    coaching:     'showCoaching',
    preparation:  'showPreparation',
  };

  const cards = {
    performances: (
      <div
        key="performances"
        onClick={onOpenPerformance}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-400"
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?w=800&h=400&fit=crop"
            alt="Mes Performances"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/80 via-orange-600/80 to-orange-500/80 group-hover:from-orange-500/70 group-hover:via-orange-600/70 group-hover:to-orange-500/70 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">📊 Mes Performances</h2>
              <p className="text-sm mt-2 opacity-90">Mon Bilan • Mes KPI →</p>
            </div>
          </div>
        </div>
      </div>
    ),

    objectives: (
      <div
        key="objectives"
        onClick={onOpenObjectives}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1753161617988-c5f43e441621?w=800&h=400&fit=crop"
            alt="Objectifs et Challenges"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 via-teal-800/70 to-green-800/70 group-hover:from-blue-900/60 group-hover:via-teal-800/60 group-hover:to-green-800/60 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">🎯 Objectifs et Challenges</h2>
              {(activeObjectives.length > 0 || activeChallenges.length > 0) ? (
                <p className="text-sm mt-2 opacity-90">
                  {activeObjectives.length} objectifs • {activeChallenges.length} challenges
                </p>
              ) : (
                <p className="text-sm mt-2 opacity-90">Aucun objectif actif pour le moment</p>
              )}
            </div>
          </div>
        </div>
      </div>
    ),

    coaching: (
      <div
        key="coaching"
        onClick={onOpenCoaching}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-400"
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop"
            alt="Mon coach IA"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/70 via-indigo-800/70 to-teal-800/70 group-hover:from-purple-900/60 group-hover:via-indigo-800/60 group-hover:to-teal-800/60 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">🤖 Mon coach IA</h2>
              <p className="text-sm mt-2 opacity-90">Créer mes défis & Analyser mes ventes →</p>
            </div>
          </div>
        </div>
      </div>
    ),

    preparation: (
      <div
        key="preparation"
        onClick={onOpenNotes}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-pink-400"
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=400&fit=crop"
            alt="Préparer mon Entretien Annuel"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-pink-700/70 via-rose-600/70 to-red-600/70 group-hover:from-pink-700/60 group-hover:via-rose-600/60 group-hover:to-red-600/60 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">🎯 Préparer mon Entretien</h2>
              <p className="text-sm mt-2 opacity-90">Bloc-notes et synthèse IA pour ton bilan annuel →</p>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {finalOrder.map((sectionId) => {
        const filterKey = filterKeyById[sectionId];
        if (filterKey && dashboardFilters[filterKey] === false) return null;
        return cards[sectionId] ?? null;
      })}
    </div>
  );
}
