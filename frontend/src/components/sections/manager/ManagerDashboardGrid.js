import React from 'react';
import { toast } from 'sonner';
import { BarChart3, Users, Target } from 'lucide-react';

/**
 * Grille des 5 cartes du dashboard manager.
 * Ordre et visibilité contrôlés par sectionOrder et dashboardFilters.
 */
export default function ManagerDashboardGrid({
  sectionOrder,
  dashboardFilters,
  sellers,
  isSubscriptionExpired,
  onOpenKPI,
  onOpenTeam,
  onOpenObjectives,
  onOpenRelationship,
}) {
  const activeSellers = sellers.filter(s => s.status === 'active').length;

  const cards = {
    kpi: dashboardFilters.showKPI && (
      <div
        key="kpi"
        onClick={() => onOpenKPI()}
        className={`glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-400 ${isSubscriptionExpired ? 'opacity-80' : ''}`}
      >
        <div className="relative h-56 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop"
            alt="Mon Magasin"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/80 via-orange-600/80 to-orange-500/80 group-hover:from-orange-500/70 group-hover:via-orange-600/70 group-hover:to-orange-500/70 transition-all" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-2">🏪 Mon Magasin</h3>
            <p className="text-sm text-white opacity-90 text-center">Performances globales du point de vente</p>
            <p className="text-xs text-white opacity-80 mt-3">
              {isSubscriptionExpired ? '🔒 Lecture seule' : 'Cliquer pour voir les détails →'}
            </p>
          </div>
        </div>
      </div>
    ),

    team: dashboardFilters.showTeam && (
      <div
        key="team"
        onClick={() => onOpenTeam()}
        className={`glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-cyan-400 ${isSubscriptionExpired ? 'opacity-80' : ''}`}
      >
        <div className="relative h-56 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=800&h=400&fit=crop"
            alt="Mon Équipe"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-cyan-900/80 to-blue-900/80 group-hover:from-blue-900/70 group-hover:via-cyan-900/70 group-hover:to-blue-900/70 transition-all" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-2 flex items-center justify-center gap-2">
              <Users className="w-7 h-7 text-yellow-400" />
              Mon Équipe
            </h3>
            <p className="text-sm text-white opacity-90 text-center">
              {activeSellers} vendeur{activeSellers > 1 ? 's' : ''} actif{activeSellers > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-white opacity-80 mt-3">Vue d'ensemble de l'équipe →</p>
          </div>
        </div>
      </div>
    ),

    objectives: dashboardFilters.showObjectives && (
      <div
        key="objectives"
        onClick={onOpenObjectives}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-400"
      >
        <div className="relative h-56 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop"
            alt="Objectifs"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/80 to-blue-900/80 group-hover:from-blue-900/70 group-hover:via-blue-800/70 group-hover:to-blue-900/70 transition-all" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
              <Target className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-2">🎯 Objectifs</h3>
            <p className="text-sm text-white opacity-90 text-center">Définir et suivre des objectifs collectifs et/ou individuels</p>
            <p className="text-xs text-white opacity-80 mt-3">Gérer les objectifs →</p>
          </div>
        </div>
      </div>
    ),

    relationship: dashboardFilters.showRelationship !== false && (
      <div
        key="relationship"
        onClick={onOpenRelationship}
        className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-400"
      >
        <div className="relative h-56 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&h=400&fit=crop"
            alt="Gestion relationnelle"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80 group-hover:from-purple-900/70 group-hover:via-indigo-900/70 group-hover:to-purple-900/70 transition-all" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-2">🤝 Gestion relationnelle</h3>
            <p className="text-sm text-white opacity-90 text-center">Conseils IA pour situations &amp; conflits</p>
            <p className="text-xs text-white opacity-80 mt-3">Obtenir des recommandations →</p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {sectionOrder.map(id => cards[id] ?? null)}
      </div>
    </div>
  );
}
