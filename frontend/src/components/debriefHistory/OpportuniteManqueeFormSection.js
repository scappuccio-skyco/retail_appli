import React from 'react';
import { Sparkles, Eye, EyeOff, XCircle } from 'lucide-react';

export default function OpportuniteManqueeFormSection({
  formManquee,
  setFormManquee,
  loading,
  onSubmit,
  onBack,
  toggleCheckbox,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-orange-500">
        <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          Analyser une opportunité manquée
        </h3>
        <p className="text-sm text-orange-700 mt-2">
          Quelques secondes pour progresser 📈
        </p>
      </div>

      <div className="space-y-4">
        {/* Produit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            🎯 Produit
          </label>
          <input
            type="text"
            value={formManquee.produit}
            onChange={(e) => setFormManquee({ ...formManquee, produit: e.target.value })}
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
                onClick={() => setFormManquee({ ...formManquee, type_client: type })}
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
            onChange={(e) => setFormManquee({ ...formManquee, description_vente: e.target.value })}
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
              onChange={(e) => setFormManquee({ ...formManquee, moment_perte_autre: e.target.value })}
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
              "N'a pas perçu la valeur",
              'Pas convaincu',
              'Manque de confiance',
              "J'ai manqué d'arguments",
              'Prix trop élevé',
              'Autre',
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
              onChange={(e) => setFormManquee({ ...formManquee, raisons_echec_autre: e.target.value })}
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
            onChange={(e) => setFormManquee({ ...formManquee, amelioration_pensee: e.target.value })}
            placeholder="Ex: Mieux reformuler le besoin..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* Toggle visibilité */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formManquee.shared_with_manager}
              onChange={(e) => setFormManquee({ ...formManquee, shared_with_manager: e.target.checked })}
              className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
            />
            <div>
              <p className="font-medium text-gray-900">Partager avec mon manager</p>
              <p className="text-sm text-gray-600">
                {formManquee.shared_with_manager ? (
                  <span className="flex items-center gap-1 text-orange-600">
                    <Eye className="w-4 h-4" /> Visible
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500">
                    <EyeOff className="w-4 h-4" /> Privé
                  </span>
                )}
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
          >
            ← Retour
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyse en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Obtenir mon analyse AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
