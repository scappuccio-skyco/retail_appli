import React, { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [overviewData, setOverviewData] = useState(null);
  const [overviewDate, setOverviewDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    nb_prospects: ''
  });
  const [managerKPIData, setManagerKPIData] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    ca_journalier: '',
    nb_ventes: '',
    nb_clients: '',
    nb_articles: '',
    nb_prospects: ''
  });
  const [loading, setLoading] = useState(false);
  const [kpiConfig, setKpiConfig] = useState({
    seller_track_ca: true,
    manager_track_ca: false,
    seller_track_ventes: true,
    manager_track_ventes: false,
    seller_track_clients: true,
    manager_track_clients: false,
    seller_track_articles: true,
    manager_track_articles: false,
    seller_track_prospects: true,
    manager_track_prospects: false
  });

  const fetchOverviewData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/manager/store-kpi-overview?date=${overviewDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverviewData(res.data);
    } catch (err) {
      console.error('Error fetching overview:', err);
      toast.error('Erreur lors du chargement de la synthèse');
    }
  };

  useEffect(() => {
    fetchKPIConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverviewData();
    }
  }, [activeTab, overviewDate]);

  const fetchKPIConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/manager/kpi-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        let config = res.data;
        // Set defaults if empty
        if (!config.seller_track_ca && !config.manager_track_ca) config.seller_track_ca = true;
        if (!config.seller_track_ventes && !config.manager_track_ventes) config.seller_track_ventes = true;
        if (!config.seller_track_clients && !config.manager_track_clients) config.seller_track_clients = true;
        if (!config.seller_track_articles && !config.manager_track_articles) config.seller_track_articles = true;
        if (!config.seller_track_prospects && !config.manager_track_prospects) config.seller_track_prospects = true;
        setKpiConfig(config);
      }
    } catch (err) {
      console.error('Error fetching KPI config:', err);
    }
  };

  const handleKPIUpdate = async (field, value) => {
    try {
      const token = localStorage.getItem('token');
      let updatedConfig = { ...kpiConfig, [field]: value };
      
      // Exclusivité mutuelle
      if (value === true) {
        if (field === 'seller_track_ca') updatedConfig.manager_track_ca = false;
        if (field === 'manager_track_ca') updatedConfig.seller_track_ca = false;
        if (field === 'seller_track_ventes') updatedConfig.manager_track_ventes = false;
        if (field === 'manager_track_ventes') updatedConfig.seller_track_ventes = false;
        if (field === 'seller_track_clients') updatedConfig.manager_track_clients = false;
        if (field === 'manager_track_clients') updatedConfig.seller_track_clients = false;
        if (field === 'seller_track_articles') updatedConfig.manager_track_articles = false;
        if (field === 'manager_track_articles') updatedConfig.seller_track_articles = false;
        if (field === 'seller_track_prospects') updatedConfig.manager_track_prospects = false;
        if (field === 'manager_track_prospects') updatedConfig.seller_track_prospects = false;
      }
      
      await axios.put(`${API}/api/manager/kpi-config`, updatedConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setKpiConfig(updatedConfig);
      toast.success('Configuration mise à jour !');
    } catch (err) {
      console.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/manager/store-kpi`,
        {
          date: formData.date,
          nb_prospects: parseInt(formData.nb_prospects)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Prospects enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving store KPI:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerKPISubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        date: managerKPIData.date
      };
      
      // Ajouter seulement les KPIs activés côté manager
      if (kpiConfig.manager_track_ca && managerKPIData.ca_journalier) {
        payload.ca_journalier = parseFloat(managerKPIData.ca_journalier);
      }
      if (kpiConfig.manager_track_ventes && managerKPIData.nb_ventes) {
        payload.nb_ventes = parseInt(managerKPIData.nb_ventes);
      }
      if (kpiConfig.manager_track_clients && managerKPIData.nb_clients) {
        payload.nb_clients = parseInt(managerKPIData.nb_clients);
      }
      if (kpiConfig.manager_track_articles && managerKPIData.nb_articles) {
        payload.nb_articles = parseInt(managerKPIData.nb_articles);
      }
      if (kpiConfig.manager_track_prospects && managerKPIData.nb_prospects) {
        payload.nb_prospects = parseInt(managerKPIData.nb_prospects);
      }

      await axios.post(
        `${API}/api/manager/manager-kpi`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('KPI Manager enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving manager KPI:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-white" />
            <h2 className="text-2xl font-bold text-white">📊 Vue d'ensemble KPI Magasin</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'border-b-3 border-purple-600 text-purple-700 bg-white'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              📊 Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'config'
                  ? 'border-b-3 border-purple-600 text-purple-700 bg-white'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              ⚙️ Configuration KPI
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'prospects'
                  ? 'border-b-3 border-purple-600 text-purple-700 bg-white'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              👨‍💼 Saisie KPI Manager
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="max-w-5xl mx-auto">
              {/* Date selector */}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">📅 Date :</label>
                <input
                  type="date"
                  value={overviewDate}
                  onChange={(e) => {
                    setOverviewDate(e.target.value);
                    fetchOverviewData();
                  }}
                  className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                />
                <button
                  onClick={fetchOverviewData}
                  className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  🔄 Actualiser
                </button>
              </div>

              {overviewData ? (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-blue-700 font-semibold mb-0.5">👥 Vendeurs</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {overviewData.sellers_reported} / {overviewData.total_sellers}
                      </div>
                      <div className="text-xs text-blue-600 mt-0.5">ont saisi leurs KPIs</div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                      <div className="text-xs text-green-700 font-semibold mb-0.5">💰 CA Total</div>
                      <div className="text-2xl font-bold text-green-900">
                        {((overviewData.manager_data?.ca_journalier || 0) + overviewData.sellers_data.ca_journalier).toFixed(2)} €
                      </div>
                      <div className="text-xs text-green-600 mt-0.5">Manager + Vendeurs</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                      <div className="text-xs text-purple-700 font-semibold mb-0.5">🛍️ Ventes Totales</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {(overviewData.manager_data?.nb_ventes || 0) + overviewData.sellers_data.nb_ventes}
                      </div>
                      <div className="text-xs text-purple-600 mt-0.5">Manager + Vendeurs</div>
                    </div>
                  </div>

                  {/* Detailed comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Manager data */}
                    <div className="bg-white rounded-xl p-5 border-2 border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>👨‍💼</span> Données Manager
                      </h3>
                      {Object.keys(overviewData.manager_data).length > 0 ? (
                        <div className="space-y-3">
                          {overviewData.manager_data.ca_journalier > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">💰 CA Journalier</span>
                              <span className="font-bold text-gray-800">{overviewData.manager_data.ca_journalier} €</span>
                            </div>
                          )}
                          {overviewData.manager_data.nb_ventes > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">🛍️ Ventes</span>
                              <span className="font-bold text-gray-800">{overviewData.manager_data.nb_ventes}</span>
                            </div>
                          )}
                          {overviewData.manager_data.nb_clients > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">👥 Clients</span>
                              <span className="font-bold text-gray-800">{overviewData.manager_data.nb_clients}</span>
                            </div>
                          )}
                          {overviewData.manager_data.nb_articles > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">📦 Articles</span>
                              <span className="font-bold text-gray-800">{overviewData.manager_data.nb_articles}</span>
                            </div>
                          )}
                          {overviewData.manager_data.nb_prospects > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">🚶 Prospects</span>
                              <span className="font-bold text-gray-800">{overviewData.manager_data.nb_prospects}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm italic">Aucune donnée saisie pour cette date</p>
                      )}
                    </div>

                    {/* Sellers aggregated data */}
                    <div className="bg-white rounded-xl p-5 border-2 border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>🧑‍💼</span> Données Vendeurs (Agrégées)
                      </h3>
                      {overviewData.sellers_reported > 0 ? (
                        <div className="space-y-3">
                          {overviewData.sellers_data.ca_journalier > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">💰 CA Journalier</span>
                              <span className="font-bold text-gray-800">{overviewData.sellers_data.ca_journalier.toFixed(2)} €</span>
                            </div>
                          )}
                          {overviewData.sellers_data.nb_ventes > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">🛍️ Ventes</span>
                              <span className="font-bold text-gray-800">{overviewData.sellers_data.nb_ventes}</span>
                            </div>
                          )}
                          {overviewData.sellers_data.nb_clients > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">👥 Clients</span>
                              <span className="font-bold text-gray-800">{overviewData.sellers_data.nb_clients}</span>
                            </div>
                          )}
                          {overviewData.sellers_data.nb_articles > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">📦 Articles</span>
                              <span className="font-bold text-gray-800">{overviewData.sellers_data.nb_articles}</span>
                            </div>
                          )}
                          {overviewData.sellers_data.nb_prospects > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">🚶 Prospects</span>
                              <span className="font-bold text-gray-800">{overviewData.sellers_data.nb_prospects}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm italic">Aucun vendeur n'a saisi ses KPIs pour cette date</p>
                      )}
                    </div>
                  </div>

                  {/* Individual seller entries */}
                  {overviewData.seller_entries.length > 0 && (
                    <div className="bg-white rounded-xl p-5 border-2 border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Détail par vendeur</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-700">Vendeur</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-700">💰 CA</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-700">🛍️ Ventes</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-700">👥 Clients</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-700">📦 Articles</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-700">🚶 Prospects</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewData.seller_entries.map((entry, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="px-4 py-2 text-gray-800 font-medium">
                                  {entry.seller_name || `Vendeur ${idx + 1}`}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">{entry.ca_journalier?.toFixed(2) || 0} €</td>
                                <td className="px-4 py-2 text-right text-gray-700">{entry.nb_ventes || 0}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{entry.nb_clients || 0}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{entry.nb_articles || 0}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{entry.nb_prospects || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-gray-600">Chargement des données...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 border-2 border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 <strong>Configuration des KPI :</strong> Choisissez qui remplit chaque KPI. Vendeurs (vert) ou Manager (violet) - exclusif.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">💰 Chiffre d'Affaires</h4>
                      <p className="text-sm text-gray-600">CA quotidien</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_ca', !kpiConfig.seller_track_ca)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_ca ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_ca', !kpiConfig.manager_track_ca)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_ca ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">🛍️ Nombre de Ventes</h4>
                      <p className="text-sm text-gray-600">Transactions</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_ventes', !kpiConfig.seller_track_ventes)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_ventes ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_ventes', !kpiConfig.manager_track_ventes)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_ventes ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">👥 Nombre de Clients</h4>
                      <p className="text-sm text-gray-600">Clients servis</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_clients', !kpiConfig.seller_track_clients)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_clients ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_clients', !kpiConfig.manager_track_clients)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_clients ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">📦 Nombre d'Articles</h4>
                      <p className="text-sm text-gray-600">Articles vendus</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_articles', !kpiConfig.seller_track_articles)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_articles ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_articles', !kpiConfig.manager_track_articles)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_articles ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">🚶 Nombre de Prospects</h4>
                      <p className="text-sm text-gray-600">Entrées magasin</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_prospects', !kpiConfig.seller_track_prospects)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_prospects ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_prospects', !kpiConfig.manager_track_prospects)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_prospects ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-3 border-2 border-green-200">
                <p className="text-sm text-green-800">
                  ✅ KPI activés côté <strong>Vendeurs</strong> (vert) : formulaire vendeur. 
                  KPI activés côté <strong>Manager</strong> (violet) : vous remplissez.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'prospects' && (
            <div className="max-w-2xl mx-auto">
              {/* Affichage conditionnel : si manager a activé des KPIs, afficher formulaire KPI Manager, sinon message d'instruction */}
              {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_clients || kpiConfig.manager_track_articles || kpiConfig.manager_track_prospects) ? (
                // Formulaire KPI Manager
                <>
                  <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200 mb-6">
                    <p className="text-sm text-purple-800">
                      💡 <strong>Saisie KPI Manager :</strong> Remplissez les KPIs que vous avez configurés pour le manager.
                    </p>
                  </div>

                  <form onSubmit={handleManagerKPISubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date</label>
                      <input
                        type="date"
                        required
                        value={managerKPIData.date}
                        onChange={(e) => setManagerKPIData({ ...managerKPIData, date: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {kpiConfig.manager_track_ca && (
                        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">💰 Chiffre d'Affaires</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={managerKPIData.ca_journalier}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, ca_journalier: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 2500.50"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_ventes && (
                        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🛍️ Nombre de Ventes</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_ventes}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_ventes: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 25"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_clients && (
                        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">👥 Nombre de Clients</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_clients}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_clients: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 30"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_articles && (
                        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">📦 Nombre d'Articles</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_articles}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_articles: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 45"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_prospects && (
                        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🚶 Nombre de Prospects</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_prospects}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_prospects: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 150"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {loading ? 'Enregistrement...' : '💾 Enregistrer KPI'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // Message d'instruction quand aucun KPI manager n'est activé
                <div className="flex flex-col items-center justify-center py-6 px-6">
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-yellow-200 max-w-md">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-100 rounded-full mb-3">
                        <span className="text-3xl">📋</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">Aucun KPI à saisir</h3>
                      <p className="text-sm text-gray-600">
                        Vous n'avez activé aucun KPI pour la saisie Manager.
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-yellow-300 mb-4">
                      <p className="text-xs text-gray-700 mb-2">
                        💡 <strong>Pour commencer la saisie :</strong>
                      </p>
                      <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                        <li>Rendez-vous dans l'onglet <strong className="text-purple-700">⚙️ Configuration KPI</strong></li>
                        <li>Activez les KPIs (bouton violet 👨‍💼)</li>
                        <li>Revenez dans cet onglet pour saisir vos données</li>
                      </ol>
                    </div>
                    
                    <button
                      onClick={() => setActiveTab('config')}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span>⚙️</span>
                      Aller à la Configuration KPI
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
