import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

export default function useKPIEntryModal({ onClose, onSuccess, editEntry }) {
  const [enabled, setEnabled] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [date, setDate] = useState(editEntry?.date || new Date().toISOString().split('T')[0]);
  const [caJournalier, setCaJournalier] = useState(editEntry?.ca_journalier?.toString() || '');
  const [nbVentes, setNbVentes] = useState(editEntry?.nb_ventes?.toString() || '');
  const [nbClients, setNbClients] = useState(editEntry?.nb_clients?.toString() || '');
  const [nbArticles, setNbArticles] = useState(editEntry?.nb_articles?.toString() || '');
  const [nbProspects, setNbProspects] = useState(editEntry?.nb_prospects?.toString() || '');
  const [comment, setComment] = useState(editEntry?.comment || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEntryLocked, setIsEntryLocked] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async (signal) => {
    try {
      const [statusRes, entriesRes, configRes, historicalRes] = await Promise.all([
        api.get('/seller/kpi-enabled', { signal }),
        api.get('/seller/kpi-entries?days=1', { signal }),
        api.get('/seller/kpi-config', { signal }),
        api.get('/seller/kpi-entries?days=30', { signal }),
      ]);

      setEnabled(statusRes.data.enabled || false);
      setKpiConfig(configRes.data);
      const hist = Array.isArray(historicalRes.data) ? historicalRes.data : (historicalRes.data?.items || []);
      setHistoricalData(hist);

      const dayEntries = Array.isArray(entriesRes.data) ? entriesRes.data : (entriesRes.data?.items || []);
      const existingEntry = dayEntries.find(e => e.date === date);
      if (existingEntry) {
        setCaJournalier(existingEntry.ca_journalier || '');
        setNbVentes(existingEntry.nb_ventes || '');
        setNbClients(existingEntry.nb_clients || '');
        setNbArticles(existingEntry.nb_articles || '');
        setNbProspects(existingEntry.nb_prospects || '');
        setComment(existingEntry.comment || '');
        setIsEntryLocked(existingEntry.locked === true);
      } else {
        setIsEntryLocked(false);
        setCaJournalier(''); setNbVentes(''); setNbClients('');
        setNbArticles(''); setNbProspects(''); setComment('');
      }
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return;
      logger.error('Error loading KPI data:', err);
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  const calculateAverages = () => {
    if (historicalData.length === 0) return null;
    const totals = { ca: 0, ventes: 0, clients: 0, articles: 0, count: 0 };
    historicalData.forEach(entry => {
      totals.ca += entry.ca_journalier || 0;
      totals.ventes += entry.nb_ventes || 0;
      totals.articles += entry.nb_articles || 0;
      totals.count += 1;
    });
    return {
      avgCA: totals.count > 0 ? totals.ca / totals.count : 0,
      avgVentes: totals.count > 0 ? totals.ventes / totals.count : 0,
      avgClients: totals.count > 0 ? totals.clients / totals.count : 0,
      avgArticles: totals.count > 0 ? totals.articles / totals.count : 0,
    };
  };

  const checkAnomalies = () => {
    const averages = calculateAverages();
    if (!averages || historicalData.length < 5) return [];

    const detectedWarnings = [];
    const HIGH = 1.5;
    const LOW = 0.5;

    const checkField = (enabled, label, rawValue, avg, isFloat = false) => {
      if (!enabled || !rawValue) return;
      const value = isFloat ? Number.parseFloat(rawValue) : Number.parseInt(rawValue);
      if (avg > 0 && (value > avg * HIGH || (value < avg * LOW && value > 0))) {
        detectedWarnings.push({
          kpi: label,
          value: isFloat ? `${value.toFixed(2)}€` : value,
          average: isFloat ? `${avg.toFixed(2)}€` : Math.round(avg),
          percentage: ((value / avg - 1) * 100).toFixed(0),
        });
      }
    };

    checkField(kpiConfig?.track_ca, "Chiffre d'affaires", caJournalier, averages.avgCA, true);
    checkField(kpiConfig?.track_ventes, 'Nombre de ventes', nbVentes, averages.avgVentes);
    checkField(kpiConfig?.track_articles, "Nombre d'articles", nbArticles, averages.avgArticles);

    return detectedWarnings;
  };

  const handleSubmit = async () => {
    const missingFields = [];
    if (kpiConfig?.track_ca && !caJournalier) missingFields.push('CA');
    if (kpiConfig?.track_ventes && !nbVentes) missingFields.push('Ventes');
    if (kpiConfig?.track_articles && !nbArticles) missingFields.push('Articles');
    if (kpiConfig?.track_prospects && !nbProspects) missingFields.push('Prospects');

    if (missingFields.length > 0) {
      toast.error(`Veuillez remplir : ${missingFields.join(', ')}`);
      return;
    }

    const detectedWarnings = checkAnomalies();
    if (detectedWarnings.length > 0) {
      setWarnings(detectedWarnings);
      setShowWarningModal(true);
      return;
    }

    await saveKPIData();
  };

  const saveKPIData = async () => {
    setSaving(true);
    try {
      await api.post('/seller/kpi-entry', {
        date,
        ca_journalier: kpiConfig?.track_ca ? Number.parseFloat(caJournalier) : 0,
        nb_ventes: kpiConfig?.track_ventes ? Number.parseInt(nbVentes) : 0,
        nb_articles: kpiConfig?.track_articles ? Number.parseInt(nbArticles) : 0,
        nb_prospects: kpiConfig?.track_prospects ? Number.parseInt(nbProspects) : 0,
        comment: comment || null,
      });
      toast.success('KPI enregistrés avec succès!');
      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Error saving KPI:', err);
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const dismissWarning = () => { setShowWarningModal(false); setWarnings([]); };
  const confirmWarning = () => { dismissWarning(); saveKPIData(); };

  return {
    enabled, kpiConfig, date, setDate,
    caJournalier, setCaJournalier,
    nbVentes, setNbVentes,
    nbClients, setNbClients,
    nbArticles, setNbArticles,
    nbProspects, setNbProspects,
    comment, setComment,
    loading, saving, isEntryLocked,
    showWarningModal, warnings,
    handleSubmit, saveKPIData, dismissWarning, confirmWarning,
  };
}
