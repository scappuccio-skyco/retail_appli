import React from 'react';
import { Sparkles, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function VenteConclueFormSection({
  formConclue,
  setFormConclue,
  loading,
  onSubmit,
  onBack,
  toggleCheckbox,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-green-500">
        <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Analyser une vente réussie
        </h3>
        <p className="text-sm text-green-700 mt-2">
          Super ! Quelques secondes pour enregistrer ce succès 🎉
        </p>
      </div>

      <div className="space-y-4">
        {/* Produit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            🎯 Produit vendu
          </label>
          <input
            type="text"
            value={formConclue.produit}
            onChange={(e) => setFormConclue({ ...formConclue, produit: e.target.value })}
            placeholder="Ex: iPhone 16 Pro"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                key={`conclue-type-${type}`}
                type="button"
                onClick={() => setFormConclue({ ...formConclue, type_client: type })}
                className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
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
            onChange={(e) => setFormConclue({ ...formConclue, description_vente: e.target.value })}
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
              onChange={(e) => setFormConclue({ ...formConclue, moment_perte_autre: e.target.value })}
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
              'Autre',
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
              onChange={(e) => setFormConclue({ ...formConclue, raisons_echec_autre: e.target.value })}
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
            onChange={(e) => setFormConclue({ ...formConclue, amelioration_pensee: e.target.value })}
            placeholder="Ex: La démo en direct..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {/* Toggle visibilité */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formConclue.shared_with_manager}
              onChange={(e) => setFormConclue({ ...formConclue, shared_with_manager: e.target.checked })}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <div>
              <p className="font-medium text-gray-900">Partager avec mon manager</p>
              <p className="text-sm text-gray-600">
                {formConclue.shared_with_manager ? (
                  <span className="flex items-center gap-1 text-green-600">
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
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
