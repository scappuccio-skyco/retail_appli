/**
 * TeamModalVariant — Variantes B et C de TeamModal
 * Même données via useTeamModal, présentations différentes.
 *
 * B — "Performance Board" : header sombre, stats hero en bande,
 *     vendeurs en leaderboard, IA affichée en carte amber en haut.
 *
 * C — "Insights Focus" : header blanc minimaliste, stats en pills,
 *     sections dans l'ordre IA→Vendeurs→Graphiques, chip-toggles pour les sections.
 */
import React, { useState } from 'react';
import { X, Users, TrendingUp, RefreshCw, Coffee, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts';
import CompatibiliteModal from './CompatibiliteModal';
import ManagerAIAnalysisDisplay from './ManagerAIAnalysisDisplay';
import EvaluationGenerator from './EvaluationGenerator';
import MorningBriefModal from './MorningBriefModal';
import SellersTableSection from './teamModal/SellersTableSection';
import ChartsSection from './teamModal/ChartsSection';
import useTeamModal from './teamModal/useTeamModal';
import { formatNumber } from './teamModal/CustomTooltip';
import SellerPassportModal from './gerant/SellerPassportModal';

/* ─── Sélecteur de période partagé ─── */
function PeriodSelector({ periodFilter, setPeriodFilter, showCustomDatePicker, setShowCustomDatePicker, customDateRange, setCustomDateRange, compact = false }) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'items-center'}`}>
      {!compact && <span className="text-xs font-semibold text-gray-500 self-center mr-1">Période :</span>}
      {[{ value: '7', label: '7j' }, { value: '30', label: '30j' }, { value: '90', label: '3m' }, { value: 'all', label: 'Année' }].map(opt => (
        <button key={opt.value} onClick={() => { setPeriodFilter(opt.value); setShowCustomDatePicker(false); }}
          className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${periodFilter === opt.value ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {opt.label}
        </button>
      ))}
      <button onClick={() => { setShowCustomDatePicker(!showCustomDatePicker); if (!showCustomDatePicker) setPeriodFilter('custom'); }}
        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${periodFilter === 'custom' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        📆 Perso
      </button>
      {showCustomDatePicker && (
        <div className="w-full flex flex-col sm:flex-row gap-2 mt-1 p-3 bg-purple-50 rounded-xl border border-purple-200">
          {[{ key: 'start', label: 'Début' }, { key: 'end', label: 'Fin' }].map(({ key, label }) => (
            <div key={key} className="flex-1">
              <label className="block text-xs font-medium text-purple-700 mb-1">{label}</label>
              <input type="date" value={customDateRange[key]}
                onChange={(e) => { const val = e.target.value; setCustomDateRange(prev => ({ ...prev, [key]: val })); if ((key === 'start' && val && customDateRange.end) || (key === 'end' && customDateRange.start && val)) setPeriodFilter('custom'); }}
                className="w-full px-2 py-1.5 text-xs border border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE B — Performance Board
══════════════════════════════════════ */
function ModalVariantB({ sellers, storeIdParam, onClose, storeName, managerName, userRole }) {
  const { user } = useAuth();
  const [passportSeller, setPassportSeller] = useState(null);
  const [showCompatibilite, setShowCompatibilite] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const s = useTeamModal({ sellers, storeIdParam, userRole, storeName, managerName, onClose, user });

  const periodLabel = s.periodFilter === '7' ? '7 jours' : s.periodFilter === '30' ? '30 jours' :
    s.periodFilter === '90' ? '3 mois' : s.periodFilter === 'custom' ? 'période perso' : "l'année";

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header sombre */}
        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mon Équipe</h2>
              <p className="text-xs text-gray-400">{s.teamData.filter(sel => !sel.status || sel.status === 'active').length} vendeurs actifs · {periodLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCompatibilite(true)} className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors">
              <Heart className="w-4 h-4 text-purple-400" />
            </button>
            <button onClick={async () => { s.setIsUpdating(true); await s.fetchTeamData(sellers); s.setIsUpdating(false); }} disabled={s.isUpdating} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-gray-300 ${s.isUpdating ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
              <X className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Stats hero row */}
        <div className="bg-gray-900 border-t border-gray-700 px-6 pb-4 flex gap-6 flex-shrink-0">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">CA Équipe</p>
            <p className="text-2xl font-bold text-white">{formatNumber(s.teamTotalCA)} €</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Ventes</p>
            <p className="text-2xl font-bold text-white">{formatNumber(s.teamTotalVentes)}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Panier moyen</p>
            <p className="text-2xl font-bold text-white">
              {s.teamTotalVentes > 0 ? `${(s.teamTotalCA / s.teamTotalVentes).toFixed(0)} €` : '—'}
            </p>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <PeriodSelector
              periodFilter={s.periodFilter} setPeriodFilter={s.setPeriodFilter}
              showCustomDatePicker={s.showCustomDatePicker} setShowCustomDatePicker={s.setShowCustomDatePicker}
              customDateRange={s.customDateRange} setCustomDateRange={s.setCustomDateRange}
              compact
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {s.loading ? (
            <div className="text-center py-16"><div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" /></div>
          ) : (
            <>
              {/* IA — amber card */}
              <div ref={s.aiSectionRef}>
                {!s.aiAnalysis && !s.aiGenerating && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <p className="text-sm font-medium text-amber-800">Analyse IA disponible pour cette période</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => s.setShowMorningBriefModal(true)} className="text-xs px-3 py-1.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors flex items-center gap-1">
                        <Coffee className="w-3 h-3" /> Brief
                      </button>
                      <button onClick={s.generateTeamAnalysis} disabled={s.aiGenerating || s.teamData.length === 0} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
                        ✨ Analyser
                      </button>
                    </div>
                  </div>
                )}
                {s.aiGenerating && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                    <p className="text-sm font-medium text-amber-800">Analyse en cours...</p>
                  </div>
                )}
                {s.aiAnalysis && !s.aiGenerating && (
                  <ManagerAIAnalysisDisplay
                    analysis={s.aiAnalysis}
                    onRegenerate={s.generateTeamAnalysis}
                    title="Analyse IA — Équipe"
                    sources={['Effectif présent', 'CA équipe', 'Ventes équipe', 'Panier moyen', 'Taux de transformation', 'Compétences (5 axes)']}
                  />
                )}
              </div>

              {/* Vendeurs */}
              <SellersTableSection
                teamData={s.teamData} sellers={sellers}
                searchQuery={s.searchQuery} setSearchQuery={s.setSearchQuery}
                hiddenSellerIds={s.hiddenSellerIds} setHiddenSellerIds={s.setHiddenSellerIds}
                isUpdating={s.isUpdating} periodFilter={s.periodFilter} customDateRange={s.customDateRange}
                userRole={userRole} storeIdParam={storeIdParam} user={user}
                showNiveauTooltip={s.showNiveauTooltip} setShowNiveauTooltip={s.setShowNiveauTooltip}
                onViewSellerDetail={() => {}}
                onPassport={setPassportSeller}
                setShowEvaluationModal={s.setShowEvaluationModal}
                setSelectedSellerForEval={s.setSelectedSellerForEval}
                refreshSellersData={s.refreshSellersData}
                fetchTeamData={s.fetchTeamData}
                isGerantWithoutStore={s.isGerantWithoutStore}
              />

              {/* Graphiques — collapsible */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => setShowCharts(v => !v)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <span>📊 Graphiques de performance</span>
                  {showCharts ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showCharts && (
                  <div className="border-t border-gray-100 p-4">
                    <ChartsSection
                      chartData={s.chartData}
                      visibleMetrics={s.visibleMetrics} setVisibleMetrics={s.setVisibleMetrics}
                      visibleSellers={s.visibleSellers} setVisibleSellers={s.setVisibleSellers}
                      sellers={sellers} teamData={s.teamData}
                      isUpdatingCharts={s.isUpdatingCharts} setIsUpdatingCharts={s.setIsUpdatingCharts}
                      periodFilter={s.periodFilter} setPeriodFilter={s.setPeriodFilter}
                      customDateRange={s.customDateRange} setCustomDateRange={s.setCustomDateRange}
                      showCustomDatePicker={s.showCustomDatePicker} setShowCustomDatePicker={s.setShowCustomDatePicker}
                      hiddenSellerIds={s.hiddenSellerIds}
                      prepareChartData={s.prepareChartData}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-modals */}
      {s.showEvaluationModal && s.selectedSellerForEval && (
        <EvaluationGenerator isOpen onClose={() => { s.setShowEvaluationModal(false); s.setSelectedSellerForEval(null); }}
          employeeId={s.selectedSellerForEval.id} employeeName={s.selectedSellerForEval.name} role="manager" />
      )}
      <MorningBriefModal isOpen={s.showMorningBriefModal} onClose={() => s.setShowMorningBriefModal(false)} storeName={storeName} managerName={managerName} storeId={storeIdParam} />
      {passportSeller && <SellerPassportModal seller={passportSeller} apiPath={userRole === 'manager' ? `/manager/sellers/${passportSeller.id}/passport` : `/gerant/sellers/${passportSeller.id}/passport`} onClose={() => setPassportSeller(null)} />}
      {showCompatibilite && <CompatibiliteModal storeIdParam={storeIdParam} sellers={s.teamData} onClose={() => setShowCompatibilite(false)} />}
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Insights Focus
══════════════════════════════════════ */
function ModalVariantC({ sellers, storeIdParam, onClose, storeName, managerName, userRole }) {
  const { user } = useAuth();
  const [passportSeller, setPassportSeller] = useState(null);
  const [showCompatibilite, setShowCompatibilite] = useState(false);
  const [activeSection, setActiveSection] = useState('vendors');
  const s = useTeamModal({ sellers, storeIdParam, userRole, storeName, managerName, onClose, user });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header minimal avec accent */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-cyan-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Mon Équipe</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCompatibilite(true)} className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-50 transition-colors">
                <Heart className="w-4 h-4" />
              </button>
              <button onClick={() => s.setShowMorningBriefModal(true)} className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-50 transition-colors">
                <Coffee className="w-4 h-4" />
              </button>
              <button onClick={async () => { s.setIsUpdating(true); await s.fetchTeamData(sellers); s.setIsUpdating(false); }} disabled={s.isUpdating} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40">
                <RefreshCw className={`w-4 h-4 ${s.isUpdating ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats pills + période */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="px-3 py-1.5 bg-cyan-50 text-cyan-700 text-sm font-semibold rounded-full border border-cyan-200">
              👥 {s.teamData.filter(sel => !sel.status || sel.status === 'active').length} vendeurs
            </span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
              💰 {formatNumber(s.teamTotalCA)} €
            </span>
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full border border-blue-200">
              🛍 {formatNumber(s.teamTotalVentes)} ventes
            </span>
            <div className="ml-auto">
              <PeriodSelector
                periodFilter={s.periodFilter} setPeriodFilter={s.setPeriodFilter}
                showCustomDatePicker={s.showCustomDatePicker} setShowCustomDatePicker={s.setShowCustomDatePicker}
                customDateRange={s.customDateRange} setCustomDateRange={s.setCustomDateRange}
                compact
              />
            </div>
          </div>

          {/* Navigation par sections */}
          <div className="flex gap-1 border-b border-gray-100">
            {[
              { id: 'vendors', label: '👤 Vendeurs' },
              { id: 'charts', label: '📊 Graphiques' },
              { id: 'ai', label: '🤖 Analyse IA' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${activeSection === tab.id ? 'border-cyan-500 text-cyan-700 bg-cyan-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                {tab.label}
                {tab.id === 'ai' && s.aiAnalysis && <span className="ml-1.5 w-2 h-2 bg-emerald-500 rounded-full inline-block" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {s.loading ? (
            <div className="text-center py-16"><div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" /></div>
          ) : (
            <>
              {activeSection === 'vendors' && (
                <SellersTableSection
                  teamData={s.teamData} sellers={sellers}
                  searchQuery={s.searchQuery} setSearchQuery={s.setSearchQuery}
                  hiddenSellerIds={s.hiddenSellerIds} setHiddenSellerIds={s.setHiddenSellerIds}
                  isUpdating={s.isUpdating} periodFilter={s.periodFilter} customDateRange={s.customDateRange}
                  userRole={userRole} storeIdParam={storeIdParam} user={user}
                  showNiveauTooltip={s.showNiveauTooltip} setShowNiveauTooltip={s.setShowNiveauTooltip}
                  onViewSellerDetail={() => {}}
                  onPassport={setPassportSeller}
                  setShowEvaluationModal={s.setShowEvaluationModal}
                  setSelectedSellerForEval={s.setSelectedSellerForEval}
                  refreshSellersData={s.refreshSellersData}
                  fetchTeamData={s.fetchTeamData}
                  isGerantWithoutStore={s.isGerantWithoutStore}
                />
              )}

              {activeSection === 'charts' && (
                <ChartsSection
                  chartData={s.chartData}
                  visibleMetrics={s.visibleMetrics} setVisibleMetrics={s.setVisibleMetrics}
                  visibleSellers={s.visibleSellers} setVisibleSellers={s.setVisibleSellers}
                  sellers={sellers} teamData={s.teamData}
                  isUpdatingCharts={s.isUpdatingCharts} setIsUpdatingCharts={s.setIsUpdatingCharts}
                  periodFilter={s.periodFilter} setPeriodFilter={s.setPeriodFilter}
                  customDateRange={s.customDateRange} setCustomDateRange={s.setCustomDateRange}
                  showCustomDatePicker={s.showCustomDatePicker} setShowCustomDatePicker={s.setShowCustomDatePicker}
                  hiddenSellerIds={s.hiddenSellerIds}
                  prepareChartData={s.prepareChartData}
                />
              )}

              {activeSection === 'ai' && (
                <div ref={s.aiSectionRef}>
                  {!s.aiAnalysis && !s.aiGenerating && (
                    <div className="text-center py-16 space-y-4">
                      <span className="text-5xl block">🤖</span>
                      <p className="text-gray-500">Aucune analyse pour cette période</p>
                      <button onClick={s.generateTeamAnalysis} disabled={s.teamData.length === 0}
                        className="px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all font-semibold disabled:opacity-50">
                        ✨ Générer l'analyse IA
                      </button>
                    </div>
                  )}
                  {s.aiGenerating && (
                    <div className="text-center py-16 space-y-3">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-2xl">✨</span>
                      </div>
                      <p className="font-semibold text-gray-700">Analyse en cours...</p>
                    </div>
                  )}
                  {s.aiAnalysis && !s.aiGenerating && (
                    <ManagerAIAnalysisDisplay
                      analysis={s.aiAnalysis}
                      onRegenerate={s.generateTeamAnalysis}
                      title="Analyse IA — Équipe"
                      sources={['Effectif présent', 'CA équipe', 'Ventes équipe', 'Panier moyen', 'Taux de transformation', 'Compétences (5 axes)']}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {s.showEvaluationModal && s.selectedSellerForEval && (
        <EvaluationGenerator isOpen onClose={() => { s.setShowEvaluationModal(false); s.setSelectedSellerForEval(null); }}
          employeeId={s.selectedSellerForEval.id} employeeName={s.selectedSellerForEval.name} role="manager" />
      )}
      <MorningBriefModal isOpen={s.showMorningBriefModal} onClose={() => s.setShowMorningBriefModal(false)} storeName={storeName} managerName={managerName} storeId={storeIdParam} />
      {passportSeller && <SellerPassportModal seller={passportSeller} apiPath={userRole === 'manager' ? `/manager/sellers/${passportSeller.id}/passport` : `/gerant/sellers/${passportSeller.id}/passport`} onClose={() => setPassportSeller(null)} />}
      {showCompatibilite && <CompatibiliteModal storeIdParam={storeIdParam} sellers={s.teamData} onClose={() => setShowCompatibilite(false)} />}
    </div>
  );
}

/* ─── Export ─── */
export default function TeamModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
