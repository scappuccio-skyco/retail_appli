import React, { useRef, useState, useEffect } from 'react';
import { Plus, Building2, Users, TrendingUp, BarChart3, Lock, TrendingDown, Minus, MapPin, Download, Loader2, Trash2, Settings, X, Check } from 'lucide-react';
import { exportGerantDashboardPdf } from './gerantDashboardPdfExport';
import { api } from '../../../lib/apiClient';
import { toast } from 'sonner';

/**
 * Vue principale du dashboard gérant (onglet "Vue d'ensemble").
 * Contient : stats globales, sélecteur de période, classement, grille magasins.
 */
export default function GerantDashboardView({
  globalStats,
  stores,
  storesStats,
  rankingStats,
  pendingInvitations,
  periodType,
  periodOffset,
  setPeriodType,
  setPeriodOffset,
  isReadOnly,
  onOpenCreateStore,
  onOpenInviteStaff,
  onRefresh,
}) {
  // ── Period helpers ─────────────────────────────────────────
  const getPeriodDates = (type, offset) => {
    const now = new Date();
    if (type === 'week') {
      const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff + offset * 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday };
    } else if (type === 'month') {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const start = new Date(target.getFullYear(), target.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else {
      const year = now.getFullYear() + offset;
      const start = new Date(year, 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const formatPeriod = (type, offset) => {
    const { start } = getPeriodDates(type, offset);
    const { end } = getPeriodDates(type, offset);
    const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    if (type === 'week') return offset === 0 ? `Semaine actuelle (${fmt(start)} - ${fmt(end)})` : `Semaine du ${fmt(start)} au ${fmt(end)}`;
    if (type === 'month') {
      const name = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return offset === 0 ? `Mois actuel (${name})` : name.charAt(0).toUpperCase() + name.slice(1);
    }
    const year = start.getFullYear();
    return offset === 0 ? `Année actuelle (${year})` : `Année ${year}`;
  };

  const getPeriodNumber = (type, date) => {
    if (type === 'week') {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    if (type === 'month') return date.getMonth() + 1;
    return date.getFullYear();
  };

  const contentRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = () => {
    exportGerantDashboardPdf(contentRef, formatPeriod(periodType, periodOffset), setExporting);
  };

  // ── Multi-select ───────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === rankedStores.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rankedStores.map(s => s.id)));
  };

  // ── Delete ─────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null); // array of store ids
  const [deleting, setDeleting] = useState(false);
  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await Promise.all(deleteConfirm.map(id => api.delete(`/gerant/stores/${id}`)));
      toast.success(`${deleteConfirm.length} magasin(s) supprimé(s)`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      onRefresh && onRefresh();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  // ── Business context modal ─────────────────────────────────
  const [contextModal, setContextModal] = useState(null); // { storeIds: [], title: '' }
  const [contextForm, setContextForm] = useState({});
  const [contextLoading, setContextLoading] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);

  useEffect(() => {
    if (!contextModal) return;
    setContextLoading(true);
    api.get(`/gerant/stores/${contextModal.storeIds[0]}/business-context`)
      .then(res => { if (res.data?.business_context) setContextForm(res.data.business_context); else setContextForm({}); })
      .catch(() => setContextForm({}))
      .finally(() => setContextLoading(false));
  }, [contextModal]);

  const handleContextSave = async () => {
    setContextSaving(true);
    try {
      await Promise.all(contextModal.storeIds.map(id =>
        api.put(`/gerant/stores/${id}/business-context`, { business_context: contextForm })
      ));
      toast.success(contextModal.storeIds.length > 1
        ? `Contexte appliqué à ${contextModal.storeIds.length} magasins`
        : 'Contexte enregistré');
      setContextModal(null);
      setContextForm({});
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setContextSaving(false);
    }
  };

  const toggleClientele = (val) => setContextForm(prev => ({
    ...prev,
    clientele_cible: (prev.clientele_cible || []).includes(val)
      ? (prev.clientele_cible || []).filter(v => v !== val)
      : [...(prev.clientele_cible || []), val],
  }));

  // ── Rankings ───────────────────────────────────────────────
  const rankedStores = stores.map(store => {
    const stats = rankingStats[store.id] || {};
    const periodCA = stats.period_ca || 0;
    const prevPeriodCA = stats.prev_period_ca || 0;
    const periodVentes = stats.period_ventes || 0;
    const periodProspects = stats.period_prospects || 0;
    const periodEvolution = prevPeriodCA > 0 ? ((periodCA - prevPeriodCA) / prevPeriodCA) * 100 : 0;
    const isPartialComparison = stats.is_partial_comparison || false;
    return { ...store, stats, periodCA, periodVentes, periodProspects, periodEvolution, isPartialComparison };
  }).sort((a, b) => b.periodCA - a.periodCA);

  const totalPeriodCA = rankedStores.reduce((sum, s) => sum + s.periodCA, 0);

  const getPeriodLabel = (type, offset) => {
    const { start } = getPeriodDates(type, offset);
    if (type === 'week') return offset === 0 ? 'CA Sem. en cours' : `CA Sem. ${getPeriodNumber(type, start)}`;
    if (type === 'month') return `CA ${start.toLocaleDateString('fr-FR', { month: 'short' })}`;
    return `CA ${start.getFullYear()}`;
  };

  return (
    <div ref={contentRef}>
      {/* Stats Globales */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Vue d'ensemble
        </h2>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-4">

          {/* Magasins */}
          <div className="glass-morphism rounded-xl sm:rounded-2xl p-2 sm:p-5 border border-orange-200 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-orange-100 rounded-lg sm:rounded-xl flex items-center justify-center">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-gray-900">{globalStats?.total_stores || 0}</p>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">Magasins</p>
          </div>

          {/* Managers */}
          <div className="glass-morphism rounded-xl sm:rounded-2xl p-2 sm:p-5 border border-blue-200 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-gray-900">{globalStats?.total_managers || 0}</p>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">Managers</p>
            <div className="hidden sm:flex flex-wrap justify-center gap-1">
              {pendingInvitations.managers > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">+{pendingInvitations.managers} en attente</span>
              )}
              {globalStats?.suspended_managers > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{globalStats.suspended_managers} en veille</span>
              )}
            </div>
          </div>

          {/* Vendeurs */}
          <div className="glass-morphism rounded-xl sm:rounded-2xl p-2 sm:p-5 border border-indigo-200 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-indigo-100 rounded-lg sm:rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-gray-900">{globalStats?.total_sellers || 0}</p>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">Vendeurs</p>
            <div className="hidden sm:flex flex-wrap justify-center gap-1">
              {pendingInvitations.sellers > 0 && (
                <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">+{pendingInvitations.sellers} en attente</span>
              )}
              {globalStats?.suspended_sellers > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{globalStats.suspended_sellers} en veille</span>
              )}
            </div>
          </div>

          {/* CA mois */}
          <div className="glass-morphism rounded-xl sm:rounded-2xl p-2 sm:p-5 border border-green-200 flex flex-col items-center text-center gap-1 sm:gap-2">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-gray-900">
              {totalPeriodCA > 0 ? `${Math.round(totalPeriodCA).toLocaleString('fr-FR')} €` : '0 €'}
            </p>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">
              {getPeriodLabel(periodType, periodOffset)}
            </p>
          </div>

        </div>
      </div>

      {/* Mes Magasins */}
      <div className="mb-8">
        {/* Ligne 1 : titre + boutons d'action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            Mes Magasins
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => !isReadOnly && onOpenInviteStaff()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Inviter du personnel'}
              data-pdf-ignore="true"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Inviter du</span> Personnel
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
            <button
              onClick={() => !isReadOnly && onOpenCreateStore()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Créer un nouveau magasin'}
              data-pdf-ignore="true"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau</span> Magasin
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              title="Exporter en PDF"
              data-pdf-ignore="true"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Exporter PDF</span>
            </button>
          </div>
        </div>

        {/* Ligne 2 : sélecteur de période intégré */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {/* Type */}
          <div className="flex gap-1">
            {[['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([type, label]) => (
              <button
                key={type}
                onClick={() => { setPeriodType(type); setPeriodOffset(0); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodType === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Séparateur */}
          <div className="w-px h-5 bg-gray-300 hidden sm:block" />

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPeriodOffset(periodOffset - 1)}
              className="p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg transition-all text-xs font-bold"
            >
              ◀
            </button>
            <span className="px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center">
              {formatPeriod(periodType, periodOffset)}
            </span>
            <button
              onClick={() => setPeriodOffset(periodOffset + 1)}
              disabled={periodOffset >= 0}
              className={`p-1.5 border rounded-lg transition-all text-xs font-bold ${
                periodOffset >= 0
                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
              }`}
            >
              ▶
            </button>
          </div>

          {/* Retour au présent */}
          {periodOffset !== 0 && (
            <button
              onClick={() => setPeriodOffset(0)}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline whitespace-nowrap"
            >
              ↻ Actuel
            </button>
          )}
        </div>

        {stores.length === 0 ? (
          <div className="glass-morphism rounded-xl p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Aucun magasin pour le moment</p>
            <button
              onClick={() => !isReadOnly && onOpenCreateStore()}
              disabled={isReadOnly}
              className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
              }`}
            >
              Créer votre premier magasin
            </button>
          </div>
        ) : (
          <>
          {/* Toolbar multi-select */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-sm font-semibold text-indigo-700">{selectedIds.size} magasin(s) sélectionné(s)</span>
              <button
                onClick={() => setContextModal({ storeIds: [...selectedIds], title: `${selectedIds.size} magasins sélectionnés` })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Appliquer un contexte
              </button>
              <button
                onClick={() => setDeleteConfirm([...selectedIds])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer ({selectedIds.size})
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="glass-morphism rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-3 text-center w-8">
                    <input type="checkbox" checked={rankedStores.length > 0 && selectedIds.size === rankedStores.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-indigo-600" />
                  </th>
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th className="px-4 py-3 text-left">Magasin</th>
                  <th className="px-4 py-3 text-right">CA — {formatPeriod(periodType, periodOffset)}</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Ventes</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Panier moyen</span>
                      <span className="pointer-events-none absolute top-full right-0 mt-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Panier moyen = CA ÷ Nombre de ventes. Montant moyen dépensé par transaction sur la période.
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Transformation</span>
                      <span className="pointer-events-none absolute top-full right-0 mt-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Taux de transformation = Ventes ÷ Prospects. Indique la part des prospects convertis en achat.
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Évolution</span>
                      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Évolution du CA par rapport à la même période précédente (semaine / mois / année selon le filtre sélectionné).
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Équipe</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankedStores.map((s, index) => {
                  const originalIndex = stores.findIndex(st => st.id === s.id);
                  const rankIcons = ['🥇', '🥈', '🥉', '🏅', '⭐', '✨'];
                  const rankIcon = index < rankIcons.length ? rankIcons[index] : `${index + 1}`;
                  const evo = s.periodEvolution;
                  const hasEvo = evo !== null && evo !== undefined && !isNaN(evo) && (s.stats?.prev_period_ca > 0 || s.periodCA > 0);
                  return (
                    <tr key={s.id} className={`hover:bg-orange-50/40 transition-colors ${index < 3 ? 'bg-orange-50/20' : 'bg-white'}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-4 text-center">
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded border-gray-300 text-indigo-600" />
                      </td>
                      {/* Rang */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-xl">{rankIcon}</span>
                      </td>

                      {/* Magasin */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{s.name}</p>
                            {s.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />{s.location}
                              </p>
                            )}
                          </div>
                          {(s.pending_manager_count || 0) + (s.pending_seller_count || 0) > 0 && (
                            <span className="text-xs font-bold text-yellow-800 bg-yellow-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              +{(s.pending_manager_count || 0) + (s.pending_seller_count || 0)} en attente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CA sélectionné */}
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-gray-900 text-base">
                          {s.periodCA > 0 ? `${s.periodCA.toLocaleString('fr-FR')} €` : <span className="text-gray-400 font-normal text-sm">—</span>}
                        </p>
                      </td>

                      {/* Ventes */}
                      <td className="px-4 py-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-gray-700">
                          {s.periodVentes > 0 ? s.periodVentes : <span className="text-gray-400 font-normal text-sm">—</span>}
                        </p>
                      </td>

                      {/* Panier moyen */}
                      <td className="px-4 py-4 text-right hidden lg:table-cell">
                        {s.periodVentes > 0 && s.periodCA > 0 ? (
                          <p className="font-semibold text-gray-700">
                            {Math.round(s.periodCA / s.periodVentes).toLocaleString('fr-FR')} €
                          </p>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Taux de transformation */}
                      <td className="px-4 py-4 text-right hidden lg:table-cell">
                        {s.periodProspects > 0 && s.periodVentes > 0 ? (
                          <p className="font-semibold text-gray-700">
                            {Math.round((s.periodVentes / s.periodProspects) * 100)} %
                          </p>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Évolution */}
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        {hasEvo ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {evo > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                <TrendingUp className="w-3 h-3" />+{Math.round(evo * 10) / 10}%
                              </span>
                            ) : evo < 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                                <TrendingDown className="w-3 h-3" />{Math.round(evo * 10) / 10}%
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                <Minus className="w-3 h-3" />0%
                              </span>
                            )}
                            {s.isPartialComparison && (
                              <span className="text-gray-400 text-xs italic">vs J identique</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Équipe (masquée sur md, visible lg) */}
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-semibold">{storesStats[s.id]?.managers_count ?? '—'}</span>
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-semibold">{storesStats[s.id]?.sellers_count ?? '—'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setContextForm({}); setContextModal({ storeIds: [s.id], title: s.name }); }}
                            title="Contexte métier IA"
                            className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm([s.id]); }}
                            title="Supprimer le magasin"
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* ── Modal contexte métier ─────────────────────────── */}
      {contextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">🏪 Contexte métier</h3>
                <p className="text-xs text-gray-500 mt-0.5">{contextModal.title}</p>
              </div>
              <button onClick={() => { setContextModal(null); setContextForm({}); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {contextLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {contextModal.storeIds.length > 1 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
                    Ce contexte sera appliqué aux <strong>{contextModal.storeIds.length} magasins sélectionnés</strong>.
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  🤖 Ces informations permettent à l'IA d'adapter ses analyses, conseils et défis au contexte précis de chaque boutique.
                </div>

                {[
                  { key: 'type_commerce', label: '🏷️ Type de commerce', options: ['Boutique mode / textile','Bijouterie / accessoires','Cosmétique / beauté','Sport / outdoor','Tech / électronique','Librairie / papeterie','Maison / décoration','Épicerie / alimentaire','Pharmacie / parapharmacie','Autre'] },
                  { key: 'positionnement', label: '🎯 Positionnement prix', options: ['Entrée de gamme / discount','Milieu de gamme','Premium','Luxe'] },
                  { key: 'format_magasin', label: '🏪 Format du point de vente', options: ['Boutique de centre-ville','Centre commercial','Retail park / zone commerciale','Outlet / déstockage','Concept store','Pop-up / éphémère'] },
                  { key: 'duree_vente', label: '⏱️ Durée moyenne d\'une vente', options: ['Moins de 5 minutes','5 à 15 minutes','15 à 30 minutes','Plus de 30 minutes'] },
                  { key: 'kpi_prioritaire', label: '📊 KPI prioritaire', options: ['Chiffre d\'affaires (CA)','Panier moyen','Taux de transformation','Indice de vente (UPT)','Fidélisation client'] },
                ].map(({ key, label, options }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                    <select value={contextForm[key] || ''} onChange={e => setContextForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option value="">-- Sélectionner --</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">👥 Clientèle cible <span className="font-normal text-gray-500">(plusieurs choix)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {['Familles','Jeunes (18-35 ans)','Seniors (50+)','Touristes','Professionnels / B2B','Enfants','Tous publics'].map(opt => (
                      <button key={opt} type="button" onClick={() => toggleClientele(opt)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${(contextForm.clientele_cible || []).includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">📅 Saisonnalité <span className="font-normal text-gray-500">(optionnel)</span></label>
                  <input type="text" value={contextForm.saisonnalite || ''} onChange={e => setContextForm(p => ({ ...p, saisonnalite: e.target.value }))}
                    placeholder="Ex : forte activité en décembre, creux en août..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">💬 Contexte libre <span className="font-normal text-gray-500">(optionnel)</span></label>
                  <textarea value={contextForm.contexte_libre || ''} onChange={e => setContextForm(p => ({ ...p, contexte_libre: e.target.value }))}
                    placeholder="Particularités de la boutique utiles pour l'IA..."
                    rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                </div>

                <button onClick={handleContextSave} disabled={contextSaving}
                  className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2">
                  {contextSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Check className="w-4 h-4" /> Enregistrer le contexte</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal confirmation suppression ───────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer {deleteConfirm.length > 1 ? `ces ${deleteConfirm.length} magasins` : 'ce magasin'} ?</h3>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible. Les managers et vendeurs associés ne seront pas supprimés.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                Annuler
              </button>
              <button onClick={handleDeleteConfirmed} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
