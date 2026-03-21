import React from 'react';
import { Target } from 'lucide-react';

export default function ObjectivesSection({ objectives, newObjective, setNewObjective, onSubmit }) {
  const set = (patch) => setNewObjective(prev => ({ ...prev, ...patch }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-6 h-6 text-[#ffd871]" />
        <h2 className="text-2xl font-bold">Mes Objectifs</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <input type="number" placeholder="CA cible (€)" value={newObjective.ca_target}
            onChange={(e) => set({ ca_target: e.target.value })} className="p-3 border rounded-lg" />
          <input type="number" step="0.01" placeholder="Indice de vente cible" value={newObjective.indice_vente_target}
            onChange={(e) => set({ indice_vente_target: e.target.value })} className="p-3 border rounded-lg" />
          <input type="number" step="0.01" placeholder="Panier moyen cible (€)" value={newObjective.panier_moyen_target}
            onChange={(e) => set({ panier_moyen_target: e.target.value })} className="p-3 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="date" value={newObjective.period_start}
            onChange={(e) => set({ period_start: e.target.value })} className="p-3 border rounded-lg" required />
          <input type="date" value={newObjective.period_end}
            onChange={(e) => set({ period_end: e.target.value })} className="p-3 border rounded-lg" required />
        </div>
        <button type="submit" className="w-full bg-[#ffd871] hover:bg-yellow-400 text-gray-800 font-semibold py-3 rounded-lg">
          Créer un objectif
        </button>
      </form>

      <div className="space-y-2">
        {objectives.map((obj) => (
          <div key={obj.id} className="p-4 bg-gray-50 rounded-lg">
            <p className="font-semibold">Période : {obj.period_start} → {obj.period_end}</p>
            {obj.ca_target && <p>CA : {obj.ca_target}€</p>}
            {obj.indice_vente_target && <p>Indice vente : {obj.indice_vente_target}</p>}
            {obj.panier_moyen_target && <p>Panier moyen : {obj.panier_moyen_target}€</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
