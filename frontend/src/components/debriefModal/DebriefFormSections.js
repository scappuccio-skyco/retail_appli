import React from 'react';

export default function DebriefFormSections({ formData, handleChange, venteConclue }) {
  return (
    <div className="space-y-6">
      {/* SECTION 1 - CONTEXTE RAPIDE */}
      <div className="bg-white rounded-xl p-6 border-2 border-blue-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#1E3A8A] rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            1
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Contexte rapide</h3>
            <p className="text-sm text-gray-600">Dis-moi rapidement le contexte de cette vente.</p>
          </div>
        </div>

        {/* Produit */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">📦</span> Produit ou service proposé
          </label>
          <input
            type="text"
            value={formData.produit}
            onChange={(e) => handleChange('produit', e.target.value)}
            placeholder="Ex: iPhone 15, forfait mobile..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        {/* Type de client */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">👤</span> Type de client
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Nouveau client', 'Client fidèle', 'Touriste / passage', 'Indécis', 'Autre'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleChange('type_client', type)}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.type_client === type
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Situation de la vente */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">📍</span> Situation de la vente
          </label>
          <div className="space-y-2">
            {[
              'Client venu spontanément',
              'Vente initiée par moi (approche proactive)',
              "Vente sur recommandation d'un collègue"
            ].map(situation => (
              <button
                key={situation}
                type="button"
                onClick={() => handleChange('situation_vente', situation)}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.situation_vente === situation
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {situation}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2 - CE QUI S'EST PASSÉ */}
      <div className="bg-white rounded-xl p-6 border-2 border-purple-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            2
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Ce qui s'est passé</h3>
            <p className="text-sm text-gray-600">Décris en quelques mots ce qui s'est passé.</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">✍️</span> Comment la vente s'est déroulée selon toi ?
          </label>
          <textarea
            value={formData.description_vente}
            onChange={(e) => handleChange('description_vente', e.target.value)}
            placeholder="Décris brièvement la scène..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none shadow-sm"
          />
        </div>

        {/* Moment blocage / succès */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">{venteConclue ? '✨' : '⏱️'}</span>
            {venteConclue
              ? "À quel moment la vente s'est conclue ?"
              : "À quel moment la vente a basculé ou s'est bloquée ?"}
          </label>
          <div className="space-y-2">
            {[
              'Accueil',
              'Découverte du besoin',
              'Proposition produit',
              'Argumentation / objections',
              "Closing (moment d'achat)",
              'Autre'
            ].map(moment => (
              <button
                key={moment}
                type="button"
                onClick={() => handleChange('moment_perte_client', moment)}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.moment_perte_client === moment
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                {moment}
              </button>
            ))}
          </div>
          {formData.moment_perte_client === 'Autre' && (
            <input
              type="text"
              value={formData.moment_perte_autre}
              onChange={(e) => handleChange('moment_perte_autre', e.target.value)}
              placeholder="Précisez..."
              className="w-full mt-2 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-sm"
            />
          )}
        </div>

        {/* Raisons / Facteurs */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">{venteConclue ? '🎉' : '🤔'}</span>
            {venteConclue
              ? 'Quels ont été les facteurs de réussite ?'
              : "Pourquoi penses-tu que le client n'a pas acheté ?"}
          </label>
          <div className="space-y-2">
            {[
              "Il n'a pas perçu la valeur du produit",
              "Il n'a pas été convaincu",
              "Il n'avait pas confiance / pas prêt",
              "J'ai manqué d'arguments ou de reformulation",
              'Autre'
            ].map(raison => (
              <button
                key={raison}
                type="button"
                onClick={() => handleChange('raisons_echec', raison)}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.raisons_echec === raison
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                {raison}
              </button>
            ))}
          </div>
          {formData.raisons_echec === 'Autre' && (
            <textarea
              value={formData.raisons_echec_autre}
              onChange={(e) => handleChange('raisons_echec_autre', e.target.value)}
              placeholder="Précisez..."
              rows={2}
              className="w-full mt-2 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none shadow-sm"
            />
          )}
        </div>
      </div>

      {/* SECTION 3 - TON RÉFLEXION */}
      <div className="bg-white rounded-xl p-6 border-2 border-green-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            3
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Ta réflexion</h3>
            <p className="text-sm text-gray-600">Prends du recul sur cette expérience.</p>
          </div>
        </div>

        {/* Amélioration / Ce qui a fonctionné */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span className="text-lg">{venteConclue ? '🌟' : '💡'}</span>
            {venteConclue
              ? "Qu'est-ce qui a le mieux fonctionné ?"
              : "Qu'aurais-tu pu faire différemment selon toi ?"}
          </label>
          <textarea
            value={formData.amelioration_pensee}
            onChange={(e) => handleChange('amelioration_pensee', e.target.value)}
            placeholder={venteConclue ? "Partage ce qui t'a permis de réussir..." : 'Partage tes réflexions...'}
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-[#10B981] transition-all resize-none shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
