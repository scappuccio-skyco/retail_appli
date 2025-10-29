import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Settings } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function KPIConfigModal({ onClose, onSuccess }) {
  const [kpiDefinitions, setKpiDefinitions] = useState({});
  const [enabledKpis, setEnabledKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [defsRes, configRes] = await Promise.all([
        axios.get(`${API}/kpi/definitions`),
        axios.get(`${API}/manager/kpi-config`)
      ]);
      
      setKpiDefinitions(defsRes.data);
      setEnabledKpis(configRes.data.enabled_kpis || []);
    } catch (err) {
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  const toggleKPI = (kpiKey) => {
    if (enabledKpis.includes(kpiKey)) {
      setEnabledKpis(enabledKpis.filter(k => k !== kpiKey));
    } else {
      setEnabledKpis([...enabledKpis, kpiKey]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/manager/kpi-config`, {
        enabled_kpis: enabledKpis
      });
      toast.success('Configuration des KPI sauvegardée!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#ffd871]" />
            <h2 className="text-2xl font-bold text-gray-800">Configuration des KPI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Sélectionnez les KPI que vos vendeurs devront remplir quotidiennement
          </p>

          <div className="space-y-3">
            {Object.entries(kpiDefinitions).map(([key, kpi]) => {
              const isEnabled = enabledKpis.includes(key);
              return (
                <div
                  key={key}
                  onClick={() => toggleKPI(key)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isEnabled
                      ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                      : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{kpi.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{kpi.name}</p>
                      <p className="text-sm text-gray-500">Unité: {kpi.unit}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isEnabled
                      ? 'bg-[#ffd871] border-[#ffd871]'
                      : 'border-gray-300'
                  }`}>
                    {isEnabled && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {enabledKpis.length} KPI{enabledKpis.length > 1 ? 's' : ''} sélectionné{enabledKpis.length > 1 ? 's' : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
