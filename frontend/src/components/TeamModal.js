import React from 'react';
import { useAuth } from '../contexts';
import { toast } from 'sonner';
import { X, Users, TrendingUp, RefreshCw, Coffee } from 'lucide-react';
import ManagerAIAnalysisDisplay from './ManagerAIAnalysisDisplay';
import EvaluationGenerator from './EvaluationGenerator';
import MorningBriefModal from './MorningBriefModal';
import SellersTableSection from './teamModal/SellersTableSection';
import ChartsSection from './teamModal/ChartsSection';
import useTeamModal from './teamModal/useTeamModal';
import { formatNumber } from './teamModal/CustomTooltip';

export default function TeamModal({ sellers, storeIdParam, onClose, onViewSellerDetail, onDataUpdate, storeName, managerName, userRole }) {
  const { user } = useAuth();
  const {
    teamData, loading,
    showMorningBriefModal, setShowMorningBriefModal,
    aiAnalysis, aiGenerating, aiSectionRef,
    periodFilter, setPeriodFilter,
    showNiveauTooltip, setShowNiveauTooltip,
    customDateRange, setCustomDateRange,
    showCustomDatePicker, setShowCustomDatePicker,
    chartData,
    visibleMetrics, setVisibleMetrics,
    visibleSellers, setVisibleSellers,
    isUpdatingCharts, setIsUpdatingCharts,
    isUpdating, setIsUpdating,
    searchQuery, setSearchQuery,
    displayedSellerCount, setDisplayedSellerCount,
    hiddenSellerIds, setHiddenSellerIds,
    showEvaluationModal, setShowEvaluationModal,
    selectedSellerForEval, setSelectedSellerForEval,
    isGerantWithoutStore,
    teamTotalCA, teamTotalVentes,
    fetchTeamData, refreshSellersData, prepareChartData, generateTeamAnalysis,
  } = useTeamModal({ sellers, storeIdParam, userRole, storeName, managerName, onClose, user });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Mon Équipe</h2>
                <p className="text-sm opacity-90">Vue d'ensemble managériale</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600" />
              <p className="text-gray-600 mt-4">Chargement des données...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex justify-between items-center border-b border-gray-200 mb-6">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Vendeurs actifs</h3>
                </div>
                <button
                  onClick={async () => { setIsUpdating(true); await fetchTeamData(sellers); setIsUpdating(false); toast.success('Données actualisées !'); }}
                  disabled={isUpdating}
                  className="px-3 py-1.5 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>
              </div>

              {/* Period Filter */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">📅 <span className="hidden md:inline">Période :</span></span>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: '7', label: '7 jours' }, { value: '30', label: '30 jours' }, { value: '90', label: '3 mois' }, { value: 'all', label: 'Année' }].map(opt => (
                        <button key={opt.value} onClick={() => { setPeriodFilter(opt.value); setShowCustomDatePicker(false); }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${periodFilter === opt.value ? 'bg-[#1E40AF] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {opt.label}
                        </button>
                      ))}
                      <button onClick={() => { setShowCustomDatePicker(!showCustomDatePicker); if (!showCustomDatePicker) setPeriodFilter('custom'); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${periodFilter === 'custom' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        📆 Personnalisée
                      </button>
                    </div>
                  </div>
                  {showCustomDatePicker && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {[{ key: 'start', label: 'Date de début' }, { key: 'end', label: 'Date de fin' }].map(({ key, label }) => (
                          <div key={key} className="flex-1">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
                            <input type="date" value={customDateRange[key]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomDateRange(prev => ({ ...prev, [key]: val }));
                                if ((key === 'start' && val && customDateRange.end) || (key === 'end' && customDateRange.start && val)) setPeriodFilter('custom');
                              }}
                              onFocus={(e) => { try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch (_) {} }}
                              className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                      {periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
                        <p className="text-xs text-purple-700 mt-2">
                          ✅ Période active : du {new Date(customDateRange.start).toLocaleDateString('fr-FR')} au {new Date(customDateRange.end).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Équipe</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {teamData.filter(s => !hiddenSellerIds.includes(s.id) && (!s.status || s.status === 'active')).length}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    vendeur{teamData.filter(s => !hiddenSellerIds.includes(s.id) && (!s.status || s.status === 'active')).length > 1 ? 's' : ''} actif{teamData.filter(s => !hiddenSellerIds.includes(s.id) && (!s.status || s.status === 'active')).length > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-[#10B981]" />
                    <span className="text-sm font-semibold text-gray-700">Performance Globale</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{formatNumber(teamTotalCA)} €</div>
                  <div className="text-xs text-[#10B981] mt-1">
                    {formatNumber(teamTotalVentes)} ventes sur {
                      periodFilter === '7' ? '7 jours' : periodFilter === '30' ? '30 jours' :
                      periodFilter === '90' ? '3 mois' :
                      periodFilter === 'custom' && customDateRange.start && customDateRange.end ? 'période personnalisée' :
                      periodFilter === 'all' ? "l'année" : 'la période sélectionnée'
                    }
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 flex flex-col items-center justify-center gap-3">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button onClick={() => setShowMorningBriefModal(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2">
                      <Coffee className="w-4 h-4" /> ☕ Brief du Matin
                    </button>
                    <button onClick={generateTeamAnalysis} disabled={aiGenerating || teamData.length === 0}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {aiGenerating ? '⏳ Analyse en cours...' : '🤖 Analyse IA de l\'équipe'}
                    </button>
                  </div>
                </div>
              </div>

              <SellersTableSection
                teamData={teamData} sellers={sellers}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                displayedSellerCount={displayedSellerCount} setDisplayedSellerCount={setDisplayedSellerCount}
                hiddenSellerIds={hiddenSellerIds} setHiddenSellerIds={setHiddenSellerIds}
                isUpdating={isUpdating} periodFilter={periodFilter} customDateRange={customDateRange}
                userRole={userRole} storeIdParam={storeIdParam} user={user}
                showNiveauTooltip={showNiveauTooltip} setShowNiveauTooltip={setShowNiveauTooltip}
                onViewSellerDetail={onViewSellerDetail}
                setShowEvaluationModal={setShowEvaluationModal}
                setSelectedSellerForEval={setSelectedSellerForEval}
                refreshSellersData={refreshSellersData}
                fetchTeamData={fetchTeamData}
                isGerantWithoutStore={isGerantWithoutStore}
              />

              <ChartsSection
                chartData={chartData}
                visibleMetrics={visibleMetrics} setVisibleMetrics={setVisibleMetrics}
                visibleSellers={visibleSellers} setVisibleSellers={setVisibleSellers}
                sellers={sellers} teamData={teamData}
                isUpdatingCharts={isUpdatingCharts} setIsUpdatingCharts={setIsUpdatingCharts}
                periodFilter={periodFilter} setPeriodFilter={setPeriodFilter}
                customDateRange={customDateRange} setCustomDateRange={setCustomDateRange}
                showCustomDatePicker={showCustomDatePicker} setShowCustomDatePicker={setShowCustomDatePicker}
                hiddenSellerIds={hiddenSellerIds}
                prepareChartData={prepareChartData}
              />

              {/* IA Analysis Section */}
              <div ref={aiSectionRef} className="mt-6">
                {!aiAnalysis && !aiGenerating && (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <span className="text-4xl mb-3 block">🤖</span>
                    <p className="text-gray-600 mb-4">Aucune analyse IA pour cette période</p>
                    <button onClick={generateTeamAnalysis} disabled={teamData.length === 0}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                      ✨ Générer l'analyse IA
                    </button>
                  </div>
                )}
                {aiGenerating && (
                  <div className="bg-white rounded-2xl p-8 text-center shadow border-2 border-blue-200">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-2xl">✨</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
                {aiAnalysis && !aiGenerating && (
                  <ManagerAIAnalysisDisplay analysis={aiAnalysis} onRegenerate={generateTeamAnalysis} title="Analyse IA — Équipe" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEvaluationModal && selectedSellerForEval && (
        <EvaluationGenerator
          isOpen={showEvaluationModal}
          onClose={() => { setShowEvaluationModal(false); setSelectedSellerForEval(null); }}
          employeeId={selectedSellerForEval.id}
          employeeName={selectedSellerForEval.name}
          role="manager"
        />
      )}

      <MorningBriefModal
        isOpen={showMorningBriefModal}
        onClose={() => setShowMorningBriefModal(false)}
        storeName={storeName}
        managerName={managerName}
        storeId={storeIdParam}
      />
    </div>
  );
}
