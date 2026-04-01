import React from 'react';
import { X, Loader2, Check } from 'lucide-react';

export default function GerantBusinessContextModal({
  contextModal,
  contextForm,
  contextLoading,
  contextSaving,
  onClose,
  onSave,
  toggleClientele,
  toggleKpi,
  setContextForm,
}) {
  if (!contextModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">🏪 Contexte métier</h3>
            <p className="text-xs text-gray-500 mt-0.5">{contextModal.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {contextLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {contextModal.storeIds.length > 1 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
                Ce contexte sera appliqué aux <strong>{contextModal.storeIds.length} magasins sélectionnés</strong>.
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              🤖 Ces informations permettent à l'IA d'adapter ses analyses, conseils et défis au contexte précis de chaque boutique.
            </div>

            {[
              { key: 'type_commerce', label: '🏷️ Type de commerce', options: ['Boutique mode / textile','Bijouterie / accessoires','Cosmétique / beauté','Sport / outdoor','Tech / électronique','Librairie / papeterie','Maison / décoration','Épicerie / alimentaire','Pharmacie / parapharmacie','Autre'] },
              { key: 'positionnement', label: '🎯 Positionnement prix', options: ['Entrée de gamme / discount','Milieu de gamme','Premium','Luxe'] },
              { key: 'format_magasin', label: '🏪 Format du point de vente', options: ['Boutique de centre-ville','Centre commercial','Retail park / zone commerciale','Outlet / déstockage','Concept store','Pop-up / éphémère'] },
              { key: 'duree_vente', label: "⏱️ Durée moyenne d'une vente", options: ['Moins de 5 minutes','5 à 15 minutes','15 à 30 minutes','Plus de 30 minutes'] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                <select
                  value={contextForm[key] || ''}
                  onChange={e => setContextForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">-- Sélectionner --</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                👥 Clientèle cible <span className="font-normal text-gray-500">(plusieurs choix)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {['Familles','Jeunes (18-35 ans)','Seniors (50+)','Touristes','Professionnels / B2B','Enfants','Tous publics'].map(opt => (
                  <button key={opt} type="button" onClick={() => toggleClientele(opt)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${(contextForm.clientele_cible || []).includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                📊 KPI prioritaires <span className="font-normal text-gray-500">(plusieurs choix)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {["Chiffre d'affaires (CA)",'Panier moyen','Taux de transformation','Indice de vente (UPT)','Fidélisation client'].map(opt => (
                  <button key={opt} type="button" onClick={() => toggleKpi(opt)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${(contextForm.kpi_prioritaire || []).includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                📅 Saisonnalité <span className="font-normal text-gray-500">(optionnel)</span>
              </label>
              <input type="text" value={contextForm.saisonnalite || ''}
                onChange={e => setContextForm(p => ({ ...p, saisonnalite: e.target.value }))}
                placeholder="Ex : forte activité en décembre, creux en août..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                💬 Contexte libre <span className="font-normal text-gray-500">(optionnel)</span>
              </label>
              <textarea value={contextForm.contexte_libre || ''}
                onChange={e => setContextForm(p => ({ ...p, contexte_libre: e.target.value }))}
                placeholder="Particularités de la boutique utiles pour l'IA..."
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            </div>

            <button onClick={onSave} disabled={contextSaving}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 text-sm flex items-center justify-center gap-2">
              {contextSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                : <><Check className="w-4 h-4" /> Enregistrer le contexte</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
