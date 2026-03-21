import React from 'react';
import { Trophy } from 'lucide-react';

export default function ChallengesSection({ challenges, newChallenge, setNewChallenge, onSubmit }) {
  const set = (patch) => setNewChallenge(prev => ({ ...prev, ...patch }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-[#ffd871]" />
        <h2 className="text-2xl font-bold">Challenges</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 mb-6">
        <input type="text" placeholder="Titre du challenge" value={newChallenge.title}
          onChange={(e) => set({ title: e.target.value })} className="w-full p-3 border rounded-lg" required />
        <textarea placeholder="Description (optionnel)" value={newChallenge.description}
          onChange={(e) => set({ description: e.target.value })} className="w-full p-3 border rounded-lg" rows="2" />
        <select value={newChallenge.type} onChange={(e) => set({ type: e.target.value })} className="w-full p-3 border rounded-lg">
          <option value="collective">Collectif (toute l'équipe)</option>
          <option value="individual">Individuel</option>
        </select>
        <div className="grid grid-cols-2 gap-4">
          <input type="number" placeholder="CA cible (€)" value={newChallenge.ca_target}
            onChange={(e) => set({ ca_target: e.target.value })} className="p-3 border rounded-lg" />
          <input type="number" placeholder="Ventes cibles" value={newChallenge.ventes_target}
            onChange={(e) => set({ ventes_target: e.target.value })} className="p-3 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="date" value={newChallenge.start_date}
            onChange={(e) => set({ start_date: e.target.value })} className="p-3 border rounded-lg" required />
          <input type="date" value={newChallenge.end_date}
            onChange={(e) => set({ end_date: e.target.value })} className="p-3 border rounded-lg" required />
        </div>
        <button type="submit" className="w-full bg-[#ffd871] hover:bg-yellow-400 text-gray-800 font-semibold py-3 rounded-lg">
          Créer le challenge
        </button>
      </form>

      <div className="space-y-2">
        {challenges.map((challenge) => (
          <div key={challenge.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-[#ffd871]">
            <h3 className="font-bold text-lg">{challenge.title}</h3>
            <p className="text-sm text-gray-600">{challenge.description}</p>
            <p className="mt-2">Type : <span className="font-semibold">{challenge.type === 'collective' ? 'Collectif' : 'Individuel'}</span></p>
            <p>Période : {challenge.start_date} → {challenge.end_date}</p>
            <p className="mt-2">
              Statut : <span className={`font-semibold ${
                challenge.status === 'active' ? 'text-blue-600' :
                challenge.status === 'completed' ? 'text-green-600' : 'text-red-600'
              }`}>
                {challenge.status === 'active' ? 'En cours' : challenge.status === 'completed' ? 'Réussi' : 'Échoué'}
              </span>
            </p>
            {challenge.ca_target && <p className="mt-1">CA : {challenge.progress_ca?.toFixed(2) || 0}€ / {challenge.ca_target}€</p>}
            {challenge.ventes_target && <p>Ventes : {challenge.progress_ventes || 0} / {challenge.ventes_target}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
