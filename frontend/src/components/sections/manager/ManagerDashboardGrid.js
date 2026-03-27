import React from 'react';
import { toast } from 'sonner';
import { BarChart3, Users, Target, TrendingUp, ArrowRight, Zap, ShoppingBag } from 'lucide-react';

/* ─────────────────────────────────────────────
   VARIANTES DE STYLE — STAGING UNIQUEMENT
   Trois designs différents pour "Mon Magasin"
   afin de choisir la direction visuelle.
   Toutes ouvrent la même modale StoreKPI.
───────────────────────────────────────────── */

/** Style A — Dark Premium : fond sombre, glow orange, chiffres blancs */
function KpiCardStyleA({ onClick, isSubscriptionExpired }) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 h-56 ${isSubscriptionExpired ? 'opacity-80' : ''}`}
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)' }}
    >
      {/* Glow orange en fond */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 group-hover:opacity-30 transition-opacity blur-3xl"
        style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }} />
      {/* Ligne accent top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

      <div className="relative z-10 p-6 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">Mon Magasin</span>
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-orange-400" />
          </div>
        </div>

        <div>
          <p className="text-white/50 text-xs mb-1">Performance du point de vente</p>
          <p className="text-white text-2xl font-bold leading-tight">Tableau de bord</p>
          <p className="text-white/40 text-xs mt-1">KPIs · Analyses IA · Vendeurs</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">CA</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/50 border border-white/10">Ventes</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/50 border border-white/10">Transfo</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center group-hover:bg-orange-500/40 transition-colors">
            <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Style B — Modern Light : blanc épuré, typo forte, accent coloré */
function KpiCardStyleB({ onClick, isSubscriptionExpired }) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 h-56 bg-white border border-gray-100 hover:shadow-2xl hover:border-orange-200 ${isSubscriptionExpired ? 'opacity-80' : ''}`}
    >
      {/* Barre accent gauche */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600 rounded-l-2xl" />

      <div className="p-6 pl-7 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium tracking-wide uppercase mb-1">Mon Magasin</p>
            <h3 className="text-gray-900 text-xl font-bold">Performances</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
            <BarChart3 className="w-6 h-6 text-orange-500" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-sm text-gray-600">Chiffre d'affaires & ventes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm text-gray-600">Taux de transformation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-sm text-gray-600">Analyse IA équipe</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Voir les détails</span>
          <div className="flex items-center gap-1 text-orange-500 group-hover:gap-2 transition-all">
            <span className="text-xs font-semibold">Ouvrir</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Style C — Gradient Bold : dégradé bleu profond, stats visibles, premium */
function KpiCardStyleC({ onClick, isSubscriptionExpired }) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 h-56 ${isSubscriptionExpired ? 'opacity-80' : ''}`}
      style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #312E81 50%, #1E1B4B 100%)' }}
    >
      {/* Cercle déco en fond */}
      <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full border border-white/10 group-hover:border-white/20 transition-colors" />
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full border border-white/10 group-hover:border-white/20 transition-colors" />
      {/* Particule lumineuse */}
      <div className="absolute top-4 right-4 w-16 h-16 rounded-full opacity-10 blur-xl bg-cyan-400 group-hover:opacity-20 transition-opacity" />

      <div className="relative z-10 p-6 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-white/80 text-sm font-semibold">Mon Magasin</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/70 border border-white/20">
            {isSubscriptionExpired ? '🔒 Lecture' : 'Live'}
          </span>
        </div>

        <div>
          <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Tableau de bord</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
              <p className="text-white text-xs font-bold">CA</p>
              <p className="text-white/50 text-xs">Réalisé</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
              <p className="text-white text-xs font-bold">Ventes</p>
              <p className="text-white/50 text-xs">Nb total</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
              <p className="text-white text-xs font-bold">Transfo</p>
              <p className="text-white/50 text-xs">Taux</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-white/60 text-xs">Analyse IA disponible</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

      {/* ── STAGING ONLY : comparaison de styles pour "Mon Magasin" ── */}
      {dashboardFilters.showKPI && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 uppercase tracking-wide">
              🎨 Staging — Comparaison de styles
            </span>
            <p className="text-sm text-gray-500">Cliquez sur chaque carte pour tester — même modale, même fonctionnalités</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Style A — Dark Premium</p>
              <KpiCardStyleA onClick={() => onOpenKPI()} isSubscriptionExpired={isSubscriptionExpired} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Style B — Modern Light</p>
              <KpiCardStyleB onClick={() => onOpenKPI()} isSubscriptionExpired={isSubscriptionExpired} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Style C — Gradient Bold</p>
              <KpiCardStyleC onClick={() => onOpenKPI()} isSubscriptionExpired={isSubscriptionExpired} />
            </div>
          </div>
          <hr className="mt-8 border-gray-200" />
          <p className="text-xs text-gray-400 mt-3 text-center">↓ Style actuel (pour comparaison)</p>
        </div>
      )}
      {/* ── FIN STAGING ── */}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {sectionOrder.map(id => cards[id] ?? null)}
      </div>
    </div>
  );
}
