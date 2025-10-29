import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Settings, BarChart3 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function KPIConfigModal({ onClose, onSuccess }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const configRes = await axios.get(`${API}/manager/kpi-config`);
      setEnabled(configRes.data.enabled || false);
    } catch (err) {
      toast.error('Erreur de chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/manager/kpi-config`, {
        enabled: enabled
      });
      toast.success('Configuration sauvegardée!');
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
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#ffd871]" />
            <h2 className="text-2xl font-bold text-gray-800">KPI Quotidiens</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 mb-1">Suivi automatique des KPI</p>
                  <p className="text-sm text-blue-800">
                    Vos vendeurs rempliront 3 données simples chaque jour :
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4">
                    <li>• Chiffre d'affaires réalisé</li>
                    <li>• Nombre de ventes</li>
                    <li>• Nombre de clients accueillis</li>
                  </ul>
                  <p className="text-sm text-blue-800 mt-3 font-medium">
                    Le système calculera automatiquement : Panier moyen, Taux de transformation, Indice de vente
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => setEnabled(!enabled)}
            className={`flex items-center justify-between p-5 rounded-xl border-2 cursor-pointer transition-all ${
              enabled
                ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-50'
            }`}
          >
            <div>
              <p className="font-semibold text-gray-800 mb-1">Activer les KPI quotidiens</p>
              <p className="text-sm text-gray-600">
                {enabled ? 'Les vendeurs peuvent saisir leurs KPI' : 'Les KPI sont désactivés'}
              </p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-all ${
              enabled ? 'bg-[#ffd871]' : 'bg-gray-300'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all transform ${
                enabled ? 'translate-x-6 mt-0.5' : 'translate-x-1 mt-0.5'
              }`} />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
