import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import KPISummaryCards from './kpiReporting/KPISummaryCards';
import KPIChartsSection from './kpiReporting/KPIChartsSection';
import KPIDetailTable from './kpiReporting/KPIDetailTable';

export default function KPIReporting({ user, onBack }) {
  const [entries, setEntries] = useState([]); // Entries filtrées pour les graphiques
  const [allEntries, setAllEntries] = useState([]); // TOUTES les entrées pour le détail
  const [kpiConfig, setKpiConfig] = useState(null); // Configuration KPI du manager
  const [kpiMetrics, setKpiMetrics] = useState(null); // Agrégats serveur (source de vérité)
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week'); // week, month, quarter, year
  const [showAllEntries, setShowAllEntries] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchKPIData(controller.signal);
    return () => controller.abort();
  }, [period]);

  const fetchKPIData = async (signal) => {
    setLoading(true);
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
      const isYearView = days === 365;
      // Pour la vue annuelle, allEntries et filteredEntries sont identiques → une seule requête
      const requests = [
        api.get('/seller/kpi-config', { signal }),
        api.get('/seller/kpi-entries?days=365', { signal }),
        api.get(`/seller/kpi-metrics?days=${days}`, { signal }),
        ...(!isYearView ? [api.get(`/seller/kpi-entries?days=${days}`, { signal })] : []),
      ];
      const [configRes, allRes, metricsRes, filteredRes] = await Promise.all(requests);

      setKpiConfig(configRes.data);
      const allEntriesData = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.items || []);
      const filteredEntriesData = isYearView
        ? allEntriesData
        : (Array.isArray(filteredRes?.data) ? filteredRes.data : (filteredRes?.data?.items || []));
      setAllEntries(allEntriesData);
      setEntries(filteredEntriesData);
      setKpiMetrics(metricsRes.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      logger.error('Error loading KPI data:', err);
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  // Build stats from server-side aggregation (source de vérité)
  const calculateStats = () => {
    if (!kpiMetrics || !kpiConfig) return null;

    const stats = { nbJours: kpiMetrics.nb_jours ?? entries.length };

    if (kpiConfig.track_ca) {
      stats.totalCA = (kpiMetrics.ca ?? 0).toFixed(2);
    }
    if (kpiConfig.track_ventes) {
      stats.totalVentes = kpiMetrics.ventes ?? 0;
    }
    if (kpiConfig.track_clients) {
      stats.totalClients = entries.reduce((sum, e) => sum + (e.nb_clients || 0), 0);
    }
    if (kpiConfig.track_articles) {
      stats.totalArticles = kpiMetrics.articles ?? 0;
    }
    // panier_moyen = CA total / ventes totales (calculé côté serveur)
    if (kpiConfig.track_ca && kpiConfig.track_ventes && kpiMetrics.panier_moyen != null) {
      stats.avgPanierMoyen = (kpiMetrics.panier_moyen ?? 0).toFixed(2);
    }
    // taux_transformation = ventes / prospects (calculé côté serveur)
    if (kpiConfig.track_ventes && kpiConfig.track_prospects && kpiMetrics.taux_transformation != null) {
      stats.avgTauxTransfo = (kpiMetrics.taux_transformation ?? 0).toFixed(2);
    }
    // indice_vente = articles / ventes (calculé côté serveur)
    if (kpiConfig.track_ca && kpiConfig.track_articles && kpiMetrics.indice_vente != null) {
      stats.avgIndiceVente = (kpiMetrics.indice_vente ?? 0).toFixed(2);
    }

    return stats;
  };

  const prepareChartData = () => {
    if (period === 'year') {
      // Agrégation mensuelle
      const monthlyData = {};
      entries.forEach(entry => {
        const date = new Date(entry.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { ca: 0, ventes: 0, clients: 0, panierMoyenSum: 0, tauxTransfoSum: 0, indiceVenteSum: 0, count: 0 };
        }
        monthlyData[monthKey].ca += entry.ca_journalier || 0;
        monthlyData[monthKey].ventes += entry.nb_ventes || 0;
        monthlyData[monthKey].clients += entry.nb_clients || 0;
        monthlyData[monthKey].panierMoyenSum += entry.panier_moyen || 0;
        monthlyData[monthKey].tauxTransfoSum += entry.taux_transformation || 0;
        monthlyData[monthKey].indiceVenteSum += entry.indice_vente || 0;
        monthlyData[monthKey].count += 1;
      });
      return Object.keys(monthlyData).sort((a, b) => a.localeCompare(b, 'fr-FR')).map(monthKey => {
        const data = monthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        return {
          date: monthName,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count,
          indiceVente: data.indiceVenteSum / data.count,
        };
      });
    }

    if (period === 'quarter') {
      // Agrégation hebdomadaire
      const weeklyData = {};
      entries.forEach(entry => {
        const date = new Date(entry.date);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { ca: 0, ventes: 0, clients: 0, panierMoyenSum: 0, tauxTransfoSum: 0, indiceVenteSum: 0, count: 0 };
        }
        weeklyData[weekKey].ca += entry.ca_journalier || 0;
        weeklyData[weekKey].ventes += entry.nb_ventes || 0;
        weeklyData[weekKey].clients += entry.nb_clients || 0;
        weeklyData[weekKey].panierMoyenSum += entry.panier_moyen || 0;
        weeklyData[weekKey].tauxTransfoSum += entry.taux_transformation || 0;
        weeklyData[weekKey].indiceVenteSum += entry.indice_vente || 0;
        weeklyData[weekKey].count += 1;
      });
      return Object.keys(weeklyData).sort((a, b) => a.localeCompare(b, 'fr-FR')).map(weekKey => {
        const data = weeklyData[weekKey];
        const weekDate = new Date(weekKey);
        const weekLabel = `S${Math.ceil((weekDate.getDate() + 6 - weekDate.getDay()) / 7)} ${weekDate.toLocaleDateString('fr-FR', { month: 'short' })}`;
        return {
          date: weekLabel,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count,
          indiceVente: data.indiceVenteSum / data.count,
        };
      });
    }

    // Vue quotidienne pour 7j et 30j
    return entries.slice().reverse().map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      ca: entry.ca_journalier,
      ventes: entry.nb_ventes,
      clients: entry.nb_clients,
      panierMoyen: entry.panier_moyen,
      tauxTransfo: entry.taux_transformation,
      indiceVente: entry.indice_vente,
    }));
  };

  const stats = calculateStats();
  const chartData = prepareChartData();

  const PERIODS = [
    { key: 'week', label: '7 jours' },
    { key: 'month', label: '30 jours' },
    { key: 'quarter', label: '90 jours' },
    { key: 'year', label: '1 an' },
  ];

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-12">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="glass-morphism rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">📊 Reporting KPI</h1>
                <p className="text-gray-600">{user.name}</p>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${
                    period === key
                      ? 'bg-[#ffd871] text-gray-800'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="glass-morphism rounded-2xl p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg mb-2">Aucune donnée disponible</p>
            <p className="text-gray-500 text-sm">Commencez à saisir vos KPI quotidiens</p>
          </div>
        ) : (
          <>
            <KPISummaryCards stats={stats} kpiConfig={kpiConfig} />
            <KPIChartsSection chartData={chartData} kpiConfig={kpiConfig} />
            <KPIDetailTable
              allEntries={allEntries}
              kpiConfig={kpiConfig}
              showAllEntries={showAllEntries}
              onToggleShowAll={() => setShowAllEntries(prev => !prev)}
            />
          </>
        )}
      </div>
    </div>
  );
}
