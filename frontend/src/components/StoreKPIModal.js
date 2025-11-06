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
  const [loading, setLoading] = useState(false);
  const [kpiConfig, setKpiConfig] = useState({
    seller_track_ca: true,
    manager_track_ca: false,
    seller_track_ventes: true,
    manager_track_ventes: false,
    seller_track_clients: true,
    manager_track_clients: false,
    seller_track_articles: true,
    manager_track_articles: false
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-white" />
            <h2 className="text-2xl font-bold text-white">📊 KPI Magasin</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-sm text-blue-800">
              💡 <strong>Bon à savoir :</strong> Le nombre de prospects permet de calculer le{' '}
              <strong>taux de transformation de l'équipe</strong> : (Ventes ÷ Prospects) × 100
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📅 Date
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
            />
          </div>

          {/* Nombre de prospects */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              👥 Nombre de Prospects
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Personnes entrées dans le magasin (compteur, estimation, etc.)
            </p>
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

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
