import React, { useState } from 'react';
import { CheckCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';

export default function VenteConclueForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formConclue, setFormConclue] = useState({
    visible_to_manager: false,
    produit: '',
    type_client: '',
    description_vente: '',
    moment_perte_client: [],
    moment_perte_autre: '',
    raisons_echec: [],
    raisons_echec_autre: '',
    amelioration_pensee: ''
  });

  const toggleCheckbox = (form, setForm, field, value) => {
    const currentValues = form[field];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    setForm({ ...form, [field]: newValues });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formConclue.produit.trim()) {
      toast.error('Veuillez indiquer le produit vendu');
      return;
    }
    if (!formConclue.type_client) {
      toast.error('Veuillez sélectionner le type de client');
      return;
    }
    if (!formConclue.description_vente.trim()) {
      toast.error('Veuillez décrire comment la vente s\'est passée');
      return;
    }
    if (formConclue.moment_perte_client.length === 0) {
      toast.error('Veuillez sélectionner au moins un moment clé');
      return;
    }
    if (formConclue.moment_perte_client.includes('Autre') && !formConclue.moment_perte_autre.trim()) {
      toast.error('Veuillez préciser le moment clé "Autre"');
      return;
    }
    if (formConclue.raisons_echec.length === 0) {
      toast.error('Veuillez sélectionner au moins un facteur de réussite');
      return;
    }
    if (formConclue.raisons_echec.includes('Autre') && !formConclue.raisons_echec_autre.trim()) {
      toast.error('Veuillez préciser le facteur "Autre"');
      return;
    }
    if (!formConclue.amelioration_pensee.trim()) {
      toast.error('Veuillez indiquer ce qui a fait la différence');
      return;
    }

    setLoading(true);
    try {
      const moment = formConclue.moment_perte_client.includes('Autre')
        ? formConclue.moment_perte_client.filter(m => m !== 'Autre').concat([formConclue.moment_perte_autre]).join(', ')
        : formConclue.moment_perte_client.join(', ');
      const raisons = formConclue.raisons_echec.includes('Autre') 
        ? formConclue.raisons_echec.filter(r => r !== 'Autre').concat([formConclue.raisons_echec_autre]).join(', ')
        : formConclue.raisons_echec.join(', ');

      const res = await api.post(
        '/debriefs',
        {
          vente_conclue: true,
          visible_to_manager: formConclue.visible_to_manager,
          produit: formConclue.produit,
          type_client: formConclue.type_client,
          situation_vente: formConclue.description_vente,
          description_vente: formConclue.description_vente,
          moment_perte_client: moment,
          raisons_echec: raisons,
          amelioration_pensee: formConclue.amelioration_pensee
        }
      );

      toast.success('✅ Analyse créée avec succès !');
      
      // Reset form
      setFormConclue({
        visible_to_manager: false,
        produit: '',
        type_client: '',
        description_vente: '',
        moment_perte_client: [],
        moment_perte_autre: '',
        raisons_echec: [],
        raisons_echec_autre: '',
        amelioration_pensee: ''
      });

      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      logger.error('Error submitting debrief:', err);
      toast.error('Erreur lors de la création de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Partage manager */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formConclue.visible_to_manager}
            onChange={(e) => setFormConclue({...formConclue, visible_to_manager: e.target.checked})}
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              Partager cette analyse avec mon manager
            </span>
          </div>
        </label>
      </div>

      {/* Produit vendu */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          📦 Quel produit as-tu vendu ?
        </label>
        <input
          type="text"
          value={formConclue.produit}
          onChange={(e) => setFormConclue({...formConclue, produit: e.target.value})}
          placeholder="Ex: iPhone 15 Pro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Type de client */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          👤 Type de client
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['Nouveau', 'Fidèle', 'Hésitant'].map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFormConclue({...formConclue, type_client: type})}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                formConclue.type_client === type
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Description courte */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          💬 En 2 mots, comment ça s'est passé ?
        </label>
        <textarea
          value={formConclue.description_vente}
          onChange={(e) => setFormConclue({...formConclue, description_vente: e.target.value})}
          placeholder="Ex: Client convaincu dès la démo..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Moment clé - SÉLECTION MULTIPLE */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ✨ Moments clés du succès (plusieurs choix possibles)
        </label>
        <div className="space-y-2">
          {['Accueil', 'Découverte du besoin', 'Argumentation', 'Closing', 'Autre'].map(moment => (
            <label
              key={`conclue-moment-${moment}`}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formConclue.moment_perte_client.includes(moment)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              <input
                type="checkbox"
                checked={formConclue.moment_perte_client.includes(moment)}
                onChange={() => toggleCheckbox(formConclue, setFormConclue, 'moment_perte_client', moment)}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">{moment}</span>
            </label>
          ))}
        </div>
        {formConclue.moment_perte_client.includes('Autre') && (
          <input
            type="text"
            value={formConclue.moment_perte_autre}
            onChange={(e) => setFormConclue({...formConclue, moment_perte_autre: e.target.value})}
            placeholder="Précisez..."
            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
        )}
      </div>

      {/* Facteurs de réussite - SÉLECTION MULTIPLE */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🎉 Facteurs de réussite (plusieurs choix possibles)
        </label>
        <div className="space-y-2">
          {[
            'Bonne écoute active',
            'Argumentation solide',
            'Produit adapté au besoin',
            'Bonne relation établie',
            'Autre'
          ].map(facteur => (
            <label
              key={`conclue-facteur-${facteur}`}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formConclue.raisons_echec.includes(facteur)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              <input
                type="checkbox"
                checked={formConclue.raisons_echec.includes(facteur)}
                onChange={() => toggleCheckbox(formConclue, setFormConclue, 'raisons_echec', facteur)}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">{facteur}</span>
            </label>
          ))}
        </div>
        {formConclue.raisons_echec.includes('Autre') && (
          <textarea
            value={formConclue.raisons_echec_autre}
            onChange={(e) => setFormConclue({...formConclue, raisons_echec_autre: e.target.value})}
            placeholder="Précisez les autres facteurs..."
            rows={2}
            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
          />
        )}
      </div>

      {/* Ce qui a fonctionné */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          💪 Qu'est-ce qui a vraiment fait la différence ?
        </label>
        <textarea
          value={formConclue.amelioration_pensee}
          onChange={(e) => setFormConclue({...formConclue, amelioration_pensee: e.target.value})}
          placeholder="Ex: La démo en direct..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <CheckCircle className="w-5 h-5" />
        {loading ? 'Création en cours...' : 'Créer l\'analyse'}
      </button>
    </div>
  );
}
