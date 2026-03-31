import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';

const TYPE_OPTIONS = [
  'Boutique mode / textile',
  'Bijouterie / accessoires',
  'Cosmétique / beauté',
  'Sport / outdoor',
  'Tech / électronique',
  'Librairie / papeterie',
  'Maison / décoration',
  'Épicerie / alimentaire',
  'Pharmacie / parapharmacie',
  'Autre',
];

const POSITIONNEMENT_OPTIONS = [
  'Entrée de gamme / discount',
  'Milieu de gamme',
  'Premium',
  'Luxe',
];

const CLIENTELE_OPTIONS = [
  'Familles',
  'Jeunes (18-35 ans)',
  'Seniors (50+)',
  'Touristes',
  'Professionnels / B2B',
  'Enfants',
  'Tous publics',
];

const FORMAT_OPTIONS = [
  'Boutique de centre-ville',
  'Centre commercial',
  'Retail park / zone commerciale',
  'Outlet / déstockage',
  'Concept store',
  'Pop-up / éphémère',
];

const DUREE_OPTIONS = [
  'Moins de 5 minutes',
  '5 à 15 minutes',
  '15 à 30 minutes',
  'Plus de 30 minutes',
];

const KPI_OPTIONS = [
  'Chiffre d\'affaires (CA)',
  'Panier moyen',
  'Taux de transformation',
  'Indice de vente (UPT)',
  'Fidélisation client',
];

export default function BusinessContextTab({ storeId }) {
  const [context, setContext] = useState({
    type_commerce: '',
    positionnement: '',
    clientele_cible: [],
    format_magasin: '',
    duree_vente: '',
    kpi_prioritaire: '',
    saisonnalite: '',
    contexte_libre: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/gerant/stores/${storeId}/business-context`)
      .then(res => {
        const bc = res.data?.business_context;
        if (bc) setContext(prev => ({ ...prev, ...bc }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  const toggleClientele = (val) => {
    setContext(prev => ({
      ...prev,
      clientele_cible: prev.clientele_cible.includes(val)
        ? prev.clientele_cible.filter(v => v !== val)
        : [...prev.clientele_cible, val],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/gerant/stores/${storeId}/business-context`, { business_context: context });
      toast.success('Contexte métier enregistré !');
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-800 font-semibold">🤖 Pourquoi remplir ce formulaire ?</p>
        <p className="text-xs text-indigo-700 mt-1">
          Ces informations permettent à l'IA d'adapter ses analyses, conseils et défis au contexte précis de votre boutique.
        </p>
      </div>

      {/* Type de commerce */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">🏷️ Type de commerce</label>
        <select
          value={context.type_commerce}
          onChange={e => setContext(prev => ({ ...prev, type_commerce: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">-- Sélectionner --</option>
          {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Positionnement */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">🎯 Positionnement prix</label>
        <select
          value={context.positionnement}
          onChange={e => setContext(prev => ({ ...prev, positionnement: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">-- Sélectionner --</option>
          {POSITIONNEMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Clientèle cible */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">👥 Clientèle cible <span className="font-normal text-gray-500">(plusieurs choix)</span></label>
        <div className="flex flex-wrap gap-2">
          {CLIENTELE_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleClientele(opt)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                context.clientele_cible.includes(opt)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Format magasin */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">🏪 Format du point de vente</label>
        <select
          value={context.format_magasin}
          onChange={e => setContext(prev => ({ ...prev, format_magasin: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">-- Sélectionner --</option>
          {FORMAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Durée de vente */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">⏱️ Durée moyenne d'une vente</label>
        <select
          value={context.duree_vente}
          onChange={e => setContext(prev => ({ ...prev, duree_vente: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">-- Sélectionner --</option>
          {DUREE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* KPI prioritaire */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">📊 KPI le plus important pour vous</label>
        <select
          value={context.kpi_prioritaire}
          onChange={e => setContext(prev => ({ ...prev, kpi_prioritaire: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">-- Sélectionner --</option>
          {KPI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Saisonnalité */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Spécificités saisonnières <span className="font-normal text-gray-500">(optionnel)</span></label>
        <input
          type="text"
          value={context.saisonnalite}
          onChange={e => setContext(prev => ({ ...prev, saisonnalite: e.target.value }))}
          placeholder="Ex : forte activité en décembre, creux en août..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Contexte libre */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">💬 Contexte supplémentaire <span className="font-normal text-gray-500">(optionnel)</span></label>
        <textarea
          value={context.contexte_libre}
          onChange={e => setContext(prev => ({ ...prev, contexte_libre: e.target.value }))}
          placeholder="Décrivez toute particularité de votre boutique utile pour l'IA..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 text-sm"
      >
        {saving ? 'Enregistrement...' : '💾 Enregistrer le contexte métier'}
      </button>
    </div>
  );
}
