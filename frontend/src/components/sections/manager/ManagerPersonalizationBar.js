import React from 'react';

const SECTION_NAMES = {
  kpi: '📊 KPI',
  team: '👥 Équipe',
  objectives: '🎯 Objectifs',
  relationship: '🤝 Gestion rel.',
};

const FILTER_CARDS = [
  { key: 'showKPI',          label: 'KPI Magasin',          emoji: '📊' },
  { key: 'showTeam',         label: 'Mon Équipe',           emoji: '👥' },
  { key: 'showObjectives',   label: 'Objectifs',            emoji: '🎯' },
  { key: 'showRelationship', label: 'Gestion relationnelle', emoji: '🤝' },
];

/**
 * Panneau de personnalisation du dashboard manager.
 */
export default function ManagerPersonalizationBar({
  show,
  dashboardFilters,
  toggleFilter,
  sectionOrder,
  moveSectionUp,
  moveSectionDown,
  onClose,
}) {
  if (!show) return null;

  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="glass-morphism rounded-2xl p-6 border-2 border-purple-200">

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            Personnalisation du Dashboard
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toggles affichage */}
        <div className="mb-8">
          <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            Afficher/Masquer les cartes
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {FILTER_CARDS.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                  dashboardFilters[key] !== false
                    ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                    : 'bg-gray-50 border-gray-300 text-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Réorganisation */}
        <div className="pt-6 border-t-2 border-purple-100">
          <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            Réorganiser l'ordre des cartes
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {sectionOrder.map((sectionId, index) => {
              if (!SECTION_NAMES[sectionId]) return null;
              return (
                <div
                  key={sectionId}
                  className="inline-flex items-center gap-2 bg-white rounded-lg px-3 py-2 border-2 border-gray-200 hover:border-purple-300 transition-all shadow-sm"
                >
                  <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  <span className="text-sm font-semibold text-gray-800">{SECTION_NAMES[sectionId]}</span>
                  <div className="flex gap-1 ml-1">
                    <button
                      onClick={() => moveSectionUp(sectionId)}
                      disabled={index === 0}
                      className={`p-1 rounded transition-all ${
                        index === 0
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                      }`}
                      title="Monter"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveSectionDown(sectionId)}
                      disabled={index === sectionOrder.length - 1}
                      className={`p-1 rounded transition-all ${
                        index === sectionOrder.length - 1
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                      }`}
                      title="Descendre"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
