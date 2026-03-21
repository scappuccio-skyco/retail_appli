import React from 'react';
import { ArrowLeft, X, TrendingUp, Award, MessageSquare, BarChart3, Calendar, StickyNote } from 'lucide-react';
import ConflictResolutionForm from './ConflictResolutionForm';
import CompetencesTab from './sellerDetail/CompetencesTab';
import KpiTab from './sellerDetail/KpiTab';
import DebriefsTab from './sellerDetail/DebriefsTab';
import NotesTab from './sellerDetail/NotesTab';
import useSellerDetail from './sellerDetail/useSellerDetail';

export default function SellerDetailView({ seller, onBack, onClose, storeIdParam = null }) {
  const {
    diagnostic, debriefs, loading,
    activeTab, setActiveTab,
    expandedDebriefs, showAllDebriefs, setShowAllDebriefs,
    debriefFilter, setDebriefFilter,
    kpiEntries, kpiMetrics, kpiFilter, setKpiFilter,
    visibleCharts, setVisibleCharts,
    sharedNotes, notesLoading,
    replyingTo, setReplyingTo, replyText, setReplyText,
    sendingReply,
    toggleDebrief, handleSendReply,
    currentCompetences, radarData, hasAnyScore, evolutionData,
    availableCharts, isTrack, kpiStats,
  } = useSellerDetail(seller, storeIdParam);

  if (loading) {
    return (
      <div className="flex flex-col h-full max-h-[95vh] items-center justify-center bg-white rounded-2xl">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mb-3" />
        <p className="text-sm text-gray-400 font-medium">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-xl">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-slate-900 px-5 pt-4 pb-0 rounded-t-2xl">
        <div className="flex items-center gap-3 pb-3">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-white/20">
            {seller.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate leading-tight">{seller.name}</h1>
            <p className="text-xs text-slate-400 truncate">{seller.email}</p>
          </div>
          {diagnostic && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-indigo-200 bg-indigo-500/30 border border-indigo-400/30 px-2 py-0.5 rounded-full">
              {diagnostic.profile === 'communicant_naturel' ? 'Comm. Naturel' :
               diagnostic.profile === 'excellence_commerciale' ? 'Excellence' :
               diagnostic.profile === 'potentiel_developper' ? 'Potentiel' :
               diagnostic.profile === 'equilibre' ? 'Équilibré' :
               diagnostic.style || '—'}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-red-500/40 text-white rounded-lg transition-colors ml-1"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick stats row */}
        <div className="flex border-t border-slate-700/50 divide-x divide-slate-700/50">
          <div className="flex-1 py-2.5 text-center">
            <p className="text-base font-bold text-white">{kpiStats.totalEvaluations}</p>
            <p className="text-[10px] text-slate-400">Analyses</p>
          </div>
          {isTrack('ventes') && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">{kpiStats.totalVentes}</p>
              <p className="text-[10px] text-slate-400">Ventes 7j</p>
            </div>
          )}
          {isTrack('ca') && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">
                {kpiStats.totalCA >= 1000
                  ? `${(kpiStats.totalCA / 1000).toFixed(1)}k€`
                  : `${kpiStats.totalCA.toFixed(0)}€`}
              </p>
              <p className="text-[10px] text-slate-400">CA 7j</p>
            </div>
          )}
          {diagnostic?.score != null && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">
                {Number(diagnostic.score).toFixed(1)}<span className="text-xs text-slate-400">/10</span>
              </p>
              <p className="text-[10px] text-slate-400">Score</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100">
        <div className="flex px-2">
          {[
            { id: 'competences', Icon: Award,        label: 'Compétences' },
            { id: 'kpi',         Icon: BarChart3,     label: 'KPI'         },
            { id: 'debriefs',    Icon: MessageSquare, label: 'Analyses'    },
            { id: 'notes',       Icon: StickyNote,    label: 'Notes'       },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-all flex-1 justify-center ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">

        {activeTab === 'competences' && (
          <CompetencesTab
            diagnostic={diagnostic}
            seller={seller}
            radarData={radarData}
            hasAnyScore={hasAnyScore}
            currentCompetences={currentCompetences}
            evolutionData={evolutionData}
          />
        )}

        {activeTab === 'kpi' && (
          <KpiTab
            kpiEntries={kpiEntries}
            kpiMetrics={kpiMetrics}
            kpiFilter={kpiFilter}
            setKpiFilter={setKpiFilter}
            visibleCharts={visibleCharts}
            setVisibleCharts={setVisibleCharts}
            availableCharts={availableCharts}
            isTrack={isTrack}
          />
        )}

        {activeTab === 'debriefs' && (
          <DebriefsTab
            debriefs={debriefs}
            debriefFilter={debriefFilter}
            setDebriefFilter={setDebriefFilter}
            expandedDebriefs={expandedDebriefs}
            toggleDebrief={toggleDebrief}
            showAllDebriefs={showAllDebriefs}
            setShowAllDebriefs={setShowAllDebriefs}
          />
        )}

        {activeTab === 'conflit' && (
          <ConflictResolutionForm sellerId={seller.id} sellerName={seller.name} />
        )}

        {activeTab === 'notes' && (
          <NotesTab
            seller={seller}
            sharedNotes={sharedNotes}
            notesLoading={notesLoading}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            replyText={replyText}
            setReplyText={setReplyText}
            sendingReply={sendingReply}
            handleSendReply={handleSendReply}
          />
        )}

      </div>
    </div>
  );
}
