import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function KPIEntryModal({ onClose, onSuccess }) {
  const [enabled, setEnabled] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [caJournalier, setCaJournalier] = useState('');
  const [nbVentes, setNbVentes] = useState('');
  const [nbClients, setNbClients] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    try {
      const [statusRes, entriesRes] = await Promise.all([
        axios.get(`${API}/seller/kpi-enabled`),
        axios.get(`${API}/seller/kpi-entries?days=1`)
      ]);
      
      setEnabled(statusRes.data.enabled || false);
      
      // If there's an entry for selected date, pre-fill it
      const existingEntry = entriesRes.data.find(e => e.date === date);
      if (existingEntry) {
        setCaJournalier(existingEntry.ca_journalier || '');
        setNbVentes(existingEntry.nb_ventes || '');
        setNbClients(existingEntry.nb_clients || '');
        setComment(existingEntry.comment || '');
      } else {
        setCaJournalier('');
        setNbVentes('');
        setNbClients('');
        setComment('');
      }
    } catch (err) {
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!caJournalier || !nbVentes || !nbClients) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/seller/kpi-entry`, {
        date,
        ca_journalier: parseFloat(caJournalier),
        nb_ventes: parseInt(nbVentes),
        nb_clients: parseInt(nbClients),
        comment: comment || null
      });
      toast.success('KPI enregistrés avec succès!');
      onSuccess();
      onClose();
    } catch (err) {
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
              💡 Remplissez ces 3 données simples. Le système calculera automatiquement votre panier moyen et taux de transformation.
            </p>
          </div>

          {/* KPI Inputs */}
          <div className="space-y-4 mb-6">
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
    </div>
  );
}
