import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Calendar, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function KPIEntryModal({ onClose, onSuccess }) {
  const [enabled, setEnabled] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [caJournalier, setCaJournalier] = useState('');
  const [nbVentes, setNbVentes] = useState('');
  const [nbClients, setNbClients] = useState('');
  const [nbArticles, setNbArticles] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statusRes, entriesRes, configRes, historicalRes] = await Promise.all([
        axios.get(`${API}/seller/kpi-enabled`, { headers }),
        axios.get(`${API}/seller/kpi-entries?days=1`, { headers }),
        axios.get(`${API}/seller/kpi-config`, { headers }),
        axios.get(`${API}/seller/kpi-entries?days=30`, { headers }) // Last 30 days for average
      ]);
      
      setEnabled(statusRes.data.enabled || false);
      setKpiConfig(configRes.data);
      setHistoricalData(historicalRes.data);
      
      // If there's an entry for selected date, pre-fill it
      const existingEntry = entriesRes.data.find(e => e.date === date);
      if (existingEntry) {
        setCaJournalier(existingEntry.ca_journalier || '');
        setNbVentes(existingEntry.nb_ventes || '');
        setNbClients(existingEntry.nb_clients || '');
        setNbArticles(existingEntry.nb_articles || '');
        setComment(existingEntry.comment || '');
      } else {
        setCaJournalier('');
        setNbVentes('');
        setNbClients('');
        setNbArticles('');
        setComment('');
      }
    } catch (err) {
      console.error('Error loading KPI data:', err);
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  const calculateAverages = () => {
    if (historicalData.length === 0) return null;
    
    const totals = {
      ca: 0,
      ventes: 0,
      clients: 0,
      articles: 0,
      count: 0
    };
    
    historicalData.forEach(entry => {
      totals.ca += entry.ca_journalier || 0;
      totals.ventes += entry.nb_ventes || 0;
      totals.clients += entry.nb_clients || 0;
      totals.articles += entry.nb_articles || 0;
      totals.count += 1;
    });
    
    return {
      avgCA: totals.count > 0 ? totals.ca / totals.count : 0,
      avgVentes: totals.count > 0 ? totals.ventes / totals.count : 0,
      avgClients: totals.count > 0 ? totals.clients / totals.count : 0,
      avgArticles: totals.count > 0 ? totals.articles / totals.count : 0
    };
  };

  const checkAnomalies = () => {
    const averages = calculateAverages();
    if (!averages || historicalData.length < 5) {
      // Not enough data to compare, skip validation
      return [];
    }
    
    const detectedWarnings = [];
    const THRESHOLD_HIGH = 1.5; // 150% of average
    const THRESHOLD_LOW = 0.5;  // 50% of average
    
    // Check CA
    if (kpiConfig?.track_ca && caJournalier) {
      const value = parseFloat(caJournalier);
      if (averages.avgCA > 0) {
        if (value > averages.avgCA * THRESHOLD_HIGH) {
          detectedWarnings.push({
            kpi: 'Chiffre d\'affaires',
            value: `${value.toFixed(2)}€`,
            average: `${averages.avgCA.toFixed(2)}€`,
            percentage: ((value / averages.avgCA - 1) * 100).toFixed(0)
          });
        } else if (value < averages.avgCA * THRESHOLD_LOW && value > 0) {
          detectedWarnings.push({
            kpi: 'Chiffre d\'affaires',
            value: `${value.toFixed(2)}€`,
            average: `${averages.avgCA.toFixed(2)}€`,
            percentage: ((value / averages.avgCA - 1) * 100).toFixed(0)
          });
        }
      }
    }
    
    // Check Ventes
    if (kpiConfig?.track_ventes && nbVentes) {
      const value = parseInt(nbVentes);
      if (averages.avgVentes > 0) {
        if (value > averages.avgVentes * THRESHOLD_HIGH) {
          detectedWarnings.push({
            kpi: 'Nombre de ventes',
            value: value,
            average: Math.round(averages.avgVentes),
            percentage: ((value / averages.avgVentes - 1) * 100).toFixed(0)
          });
        } else if (value < averages.avgVentes * THRESHOLD_LOW && value > 0) {
          detectedWarnings.push({
            kpi: 'Nombre de ventes',
            value: value,
            average: Math.round(averages.avgVentes),
            percentage: ((value / averages.avgVentes - 1) * 100).toFixed(0)
          });
        }
      }
    }
    
    // Check Clients
    if (kpiConfig?.track_clients && nbClients) {
      const value = parseInt(nbClients);
      if (averages.avgClients > 0) {
        if (value > averages.avgClients * THRESHOLD_HIGH) {
          detectedWarnings.push({
            kpi: 'Nombre de clients',
            value: value,
            average: Math.round(averages.avgClients),
            percentage: ((value / averages.avgClients - 1) * 100).toFixed(0)
          });
        } else if (value < averages.avgClients * THRESHOLD_LOW && value > 0) {
          detectedWarnings.push({
            kpi: 'Nombre de clients',
            value: value,
            average: Math.round(averages.avgClients),
            percentage: ((value / averages.avgClients - 1) * 100).toFixed(0)
          });
        }
      }
    }
    
    // Check Articles
    if (kpiConfig?.track_articles && nbArticles) {
      const value = parseInt(nbArticles);
      if (averages.avgArticles > 0) {
        if (value > averages.avgArticles * THRESHOLD_HIGH) {
          detectedWarnings.push({
            kpi: 'Nombre d\'articles',
            value: value,
            average: Math.round(averages.avgArticles),
            percentage: ((value / averages.avgArticles - 1) * 100).toFixed(0)
          });
        } else if (value < averages.avgArticles * THRESHOLD_LOW && value > 0) {
          detectedWarnings.push({
            kpi: 'Nombre d\'articles',
            value: value,
            average: Math.round(averages.avgArticles),
            percentage: ((value / averages.avgArticles - 1) * 100).toFixed(0)
          });
        }
      }
    }
    
    return detectedWarnings;
  };

  const handleSubmit = async () => {
    // Validate only required fields based on config
    const missingFields = [];
    if (kpiConfig?.track_ca && !caJournalier) missingFields.push('CA');
    if (kpiConfig?.track_ventes && !nbVentes) missingFields.push('Ventes');
    if (kpiConfig?.track_clients && !nbClients) missingFields.push('Clients');
    if (kpiConfig?.track_articles && !nbArticles) missingFields.push('Articles');
    
    if (missingFields.length > 0) {
      toast.error(`Veuillez remplir : ${missingFields.join(', ')}`);
      return;
    }

    // Check for anomalies
    const detectedWarnings = checkAnomalies();
    if (detectedWarnings.length > 0) {
      setWarnings(detectedWarnings);
      setShowWarningModal(true);
      return;
    }

    // No warnings, proceed with save
    await saveKPIData();
  };

  const saveKPIData = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/seller/kpi-entry`, {
        date,
        ca_journalier: kpiConfig?.track_ca ? parseFloat(caJournalier) : 0,
        nb_ventes: kpiConfig?.track_ventes ? parseInt(nbVentes) : 0,
        nb_clients: kpiConfig?.track_clients ? parseInt(nbClients) : 0,
        nb_articles: kpiConfig?.track_articles ? parseInt(nbArticles) : 0,
        comment: comment || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('KPI enregistrés avec succès!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving KPI:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-4">
            <p className="text-gray-600">Les KPI quotidiens ne sont pas activés.</p>
            <p className="text-sm text-gray-500 mt-2">Contactez votre manager.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#ffd871]" />
            <h2 className="text-2xl font-bold text-gray-800">Mes KPI du jour</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Date Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 Remplissez les données demandées. Les KPI dérivés seront calculés automatiquement.
            </p>
          </div>

          {/* KPI Inputs - Dynamic based on config */}
          <div className="space-y-4 mb-6">
            {kpiConfig?.track_ca && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">💰</span>
                  <label className="font-medium text-gray-800">
                    Chiffre d'affaires
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={caJournalier}
                    onChange={(e) => setCaJournalier(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                  <span className="text-gray-600 font-medium min-w-[40px]">€</span>
                </div>
              </div>
            )}

            {kpiConfig?.track_ventes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🛍️</span>
                  <label className="font-medium text-gray-800">
                    Nombre de ventes
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nbVentes}
                    onChange={(e) => setNbVentes(e.target.value)}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                  <span className="text-gray-600 font-medium min-w-[40px]">ventes</span>
                </div>
              </div>
            )}

            {kpiConfig?.track_clients && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">👥</span>
                  <label className="font-medium text-gray-800">
                    Nombre de clients accueillis
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nbClients}
                    onChange={(e) => setNbClients(e.target.value)}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                  <span className="text-gray-600 font-medium min-w-[40px]">clients</span>
                </div>
              </div>
            )}

            {kpiConfig?.track_articles && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📦</span>
                  <label className="font-medium text-gray-800">
                    Nombre d'articles vendus
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nbArticles}
                    onChange={(e) => setNbArticles(e.target.value)}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                  <span className="text-gray-600 font-medium min-w-[40px]">articles</span>
                </div>
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notes sur votre journée..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Valeurs inhabituelles détectées</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Les données suivantes diffèrent significativement de votre moyenne sur 30 jours :
            </p>

            <div className="space-y-3 mb-6">
              {warnings.map((warning, index) => (
                <div key={index} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{warning.kpi}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Valeur saisie : <span className="font-bold text-orange-600">{warning.value}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Moyenne habituelle : <span className="font-medium">{warning.average}</span>
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      parseFloat(warning.percentage) > 0 
                        ? 'bg-orange-200 text-orange-800' 
                        : 'bg-blue-200 text-blue-800'
                    }`}>
                      {warning.percentage > 0 ? '+' : ''}{warning.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800">
                💡 Vérifiez que les valeurs sont correctes avant de confirmer.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setWarnings([]);
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 font-medium"
              >
                Corriger
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setWarnings([]);
                  saveKPIData();
                }}
                disabled={saving}
                className="flex-1 py-3 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
