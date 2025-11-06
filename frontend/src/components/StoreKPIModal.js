import React, { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null }) {
  const [activeTab, setActiveTab] = useState('config');
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

  useEffect(() => {
    fetchKPIConfig();
  }, []);

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
              {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_clients || kpiConfig.manager_track_articles || kpiConfig.manager_track_prospects) 
                ? '👨‍💼 Saisie KPI Manager' 
                : '📊 Saisie Prospects'
              }
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
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
              {/* Affichage conditionnel : si manager a activé des KPIs, afficher formulaire KPI Manager, sinon formulaire Prospects */}
              {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_clients || kpiConfig.manager_track_articles) ? (
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
                // Formulaire Prospects (par défaut)
                <>
                  <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200 mb-6">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Saisie des Prospects :</strong> Nombre de personnes entrées dans le magasin.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">👥 Nombre de Prospects</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.nb_prospects}
                        onChange={(e) => setFormData({ ...formData, nb_prospects: e.target.value })}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                        placeholder="Ex: 150"
                      />
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
                        {loading ? 'Enregistrement...' : '💾 Enregistrer'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
