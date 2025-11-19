import React, { useState } from 'react';
import { XCircle, Share2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function OpportuniteManqueeForm({ token, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formManquee, setFormManquee] = useState({
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
    if (!formManquee.produit.trim()) {
      toast.error('Veuillez indiquer le produit');
      return;
    }
    if (!formManquee.type_client) {
      toast.error('Veuillez sélectionner le type de client');
      return;
    }
    if (!formManquee.description_vente.trim()) {
      toast.error('Veuillez décrire ce qui s\'est passé');
      return;
    }
    if (formManquee.moment_perte_client.length === 0) {
      toast.error('Veuillez sélectionner au moins un moment');
      return;
    }
    if (formManquee.moment_perte_client.includes('Autre') && !formManquee.moment_perte_autre.trim()) {
      toast.error('Veuillez préciser le moment "Autre"');
      return;
    }
    if (formManquee.raisons_echec.length === 0) {
      toast.error('Veuillez sélectionner au moins une raison');
      return;
    }
    if (formManquee.raisons_echec.includes('Autre') && !formManquee.raisons_echec_autre.trim()) {
      toast.error('Veuillez préciser la raison "Autre"');
      return;
    }
    if (!formManquee.amelioration_pensee.trim()) {
      toast.error('Veuillez indiquer ce que tu aurais pu faire différemment');
      return;
    }

    setLoading(true);
    try {
      const moment = formManquee.moment_perte_client.includes('Autre')
        ? formManquee.moment_perte_client.filter(m => m !== 'Autre').concat([formManquee.moment_perte_autre]).join(', ')
        : formManquee.moment_perte_client.join(', ');
      const raisons = formManquee.raisons_echec.includes('Autre') 
        ? formManquee.raisons_echec.filter(r => r !== 'Autre').concat([formManquee.raisons_echec_autre]).join(', ')
        : formManquee.raisons_echec.join(', ');

      const res = await axios.post(
        `${API}/debriefs`,
        {
          vente_conclue: false,
          visible_to_manager: formManquee.visible_to_manager,
          produit: formManquee.produit,
          type_client: formManquee.type_client,
          situation_vente: formManquee.description_vente,
          description_vente: formManquee.description_vente,
          moment_perte_client: moment,
          raisons_echec: raisons,
          amelioration_pensee: formManquee.amelioration_pensee
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('✅ Analyse créée avec succès !');
      
      // Reset form
      setFormManquee({
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
      console.error('Error submitting debrief:', err);
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
            checked={formManquee.visible_to_manager}
            onChange={(e) => setFormManquee({...formManquee, visible_to_manager: e.target.checked})}
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

      {/* Produit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🎯 Produit
        </label>
        <input
          type="text"
          value={formManquee.produit}
          onChange={(e) => setFormManquee({...formManquee, produit: e.target.value})}
          placeholder="Ex: iPhone 16 Pro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Type client */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          👤 Type de client
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['Nouveau client', 'Client fidèle', 'Touriste', 'Indécis'].map(type => (
            <button
              key={`manquee-type-${type}`}
              type="button"
              onClick={() => setFormManquee({...formManquee, type_client: type})}
              className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                formManquee.type_client === type
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          💬 En 2 mots, ce qui s'est passé
        </label>
        <textarea
          value={formManquee.description_vente}
          onChange={(e) => setFormManquee({...formManquee, description_vente: e.target.value})}
          placeholder="Ex: Client hésitant sur le prix..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
        />
      </div>

      {/* Moment de perte - SÉLECTION MULTIPLE */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ⏱️ Moments où ça a basculé (plusieurs choix possibles)
        </label>
        <div className="space-y-2">
          {['Accueil', 'Découverte du besoin', 'Argumentation', 'Objections', 'Closing', 'Autre'].map(moment => (
            <label
              key={`manquee-moment-${moment}`}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formManquee.moment_perte_client.includes(moment)
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <input
                type="checkbox"
                checked={formManquee.moment_perte_client.includes(moment)}
                onChange={() => toggleCheckbox(formManquee, setFormManquee, 'moment_perte_client', moment)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">{moment}</span>
            </label>
          ))}
        </div>
        {formManquee.moment_perte_client.includes('Autre') && (
          <input
            type="text"
            value={formManquee.moment_perte_autre}
            onChange={(e) => setFormManquee({...formManquee, moment_perte_autre: e.target.value})}
            placeholder="Précisez..."
            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        )}
      </div>

      {/* Raisons - SÉLECTION MULTIPLE */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🤔 Raisons de l'échec (plusieurs choix possibles)
        </label>
        <div className="space-y-2">
          {[
            'N\'a pas perçu la valeur',
            'Pas convaincu',
            'Manque de confiance',
            'J\'ai manqué d\'arguments',
            'Prix trop élevé',
            'Autre'
          ].map(raison => (
            <label
              key={`manquee-raison-${raison}`}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formManquee.raisons_echec.includes(raison)
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <input
                type="checkbox"
                checked={formManquee.raisons_echec.includes(raison)}
                onChange={() => toggleCheckbox(formManquee, setFormManquee, 'raisons_echec', raison)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">{raison}</span>
            </label>
          ))}
        </div>
        {formManquee.raisons_echec.includes('Autre') && (
          <textarea
            value={formManquee.raisons_echec_autre}
            onChange={(e) => setFormManquee({...formManquee, raisons_echec_autre: e.target.value})}
            placeholder="Précisez les autres raisons..."
            rows={2}
            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
          />
        )}
      </div>

      {/* Amélioration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🔄 Qu'aurais-tu pu faire différemment ?
        </label>
        <textarea
          value={formManquee.amelioration_pensee}
          onChange={(e) => setFormManquee({...formManquee, amelioration_pensee: e.target.value})}
          placeholder="Ex: Mieux reformuler le besoin..."
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-700 hover:to-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <XCircle className="w-5 h-5" />
        {loading ? 'Création en cours...' : 'Créer l\'analyse'}
      </button>
    </div>
  );
}
