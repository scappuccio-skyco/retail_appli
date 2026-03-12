import React from 'react';

/**
 * Panneau de personnalisation du dashboard vendeur.
 * Permet de masquer/afficher les cartes et de réorganiser leur ordre.
 */
export default function SellerPersonalizationBar({
  show,
  dashboardFilters,
  toggleFilter,
  finalOrder,
  sectionNames,
  moveSectionUp,
  moveSectionDown,
  onClose,
}) {
  if (!show) return null;

  const FILTER_CARDS = [
    { key: 'showPerformances', label: 'Mes Performances', emoji: '📈' },
    { key: 'showObjectives',   label: 'Objectifs & Challenges', emoji: '🎯' },
    { key: 'showCoaching',     label: 'Mon coach IA', emoji: '🤖' },
    { key: 'showPreparation',  label: 'Préparer mon Entretien', emoji: '📝' },
  ];

  const activeCount = FILTER_CARDS.filter(({ key }) => dashboardFilters[key] !== false).length;

  return (
    <div className="max-w-7xl mx-auto mb-6 animate-fadeIn">
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg">

        {/* En-tête */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Personnalisation du Dashboard</h3>
              <p className="text-sm text-gray-600">Adaptez votre espace à vos besoins</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-purple-200">
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">{activeCount} cartes actives</span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              <span>Fermer</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
            {finalOrder.map((sectionId, index) => (
              <div
                key={sectionId}
                className="inline-flex items-center gap-2 bg-white rounded-lg px-3 py-2 border-2 border-gray-200 hover:border-purple-300 transition-all shadow-sm"
              >
                <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                <span className="text-sm font-semibold text-gray-800">{sectionNames[sectionId]}</span>
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
                    disabled={index === finalOrder.length - 1}
                    className={`p-1 rounded transition-all ${
                      index === finalOrder.length - 1
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
