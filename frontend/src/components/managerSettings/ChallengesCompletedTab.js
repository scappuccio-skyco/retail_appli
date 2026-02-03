import React from 'react';
import PropTypes from 'prop-types';
import { Trash2 } from 'lucide-react';

export default function ChallengesCompletedTab({ challenges, onDeleteChallenge }) {
  const today = new Date().toISOString().split('T')[0];
  const completedChallenges = challenges.filter(chall =>
    chall.end_date < today || chall.status === 'achieved'
  );

  if (completedChallenges.length === 0) {
    return <p className="text-center text-gray-500 py-8">Aucun challenge terminé</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🏆 Challenges terminés</h3>
        <div className="space-y-3">
          {completedChallenges.map((challenge) => (
            <div
              key={challenge.id}
              className={`rounded-lg p-4 border-2 transition-all ${
                challenge.status === 'achieved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-800">{challenge.title}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      challenge.status === 'achieved'
                        ? 'bg-green-600 text-white'
                        : 'bg-white sm:bg-red-600 text-red-700 sm:text-white border-2 border-red-600'
                    }`}>
                      {challenge.status === 'achieved' ? '✅' : '❌'} <span className="hidden sm:inline">{challenge.status === 'achieved' ? 'Atteint' : 'Non atteint'}</span>
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {challenge.type === 'collective' ? '👥' : '👤'} <span className="hidden sm:inline">{challenge.type === 'collective' ? 'Équipe' : 'Individuel'}</span>
                    </span>
                  </div>
                  {challenge.description && <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm mt-3 bg-white rounded p-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">📅 Période</p>
                      <p className="text-gray-800">
                        {new Date(challenge.start_date).toLocaleDateString('fr-FR')} - {new Date(challenge.end_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">🎯 KPI</p>
                      <p className="text-gray-800 capitalize">{challenge.kpi_name || challenge.challenge_type || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-500">Progression finale</p>
                      <p className="text-gray-800 font-bold">
                        {challenge.current_value || 0} / {challenge.target_value} {challenge.unit || ''}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full transition-all ${challenge.status === 'achieved' ? 'bg-green-600' : 'bg-red-600'}`}
                          style={{ width: `${Math.min(((challenge.current_value || 0) / challenge.target_value) * 100, 100)}%` }}
                        />
                      </div>
                      {challenge.updated_at && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                          <span>📅 Dernière mise à jour :</span>
                          <span className="font-semibold">
                            {new Date(challenge.updated_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {challenge.updated_by_name && (
                            <>
                              <span>par</span>
                              <span className="font-semibold text-blue-600">{challenge.updated_by_name}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={() => onDeleteChallenge(challenge.id, challenge.title)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
ChallengesCompletedTab.propTypes = {
  challenges: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string,
    type: PropTypes.string,
    start_date: PropTypes.string,
    end_date: PropTypes.string,
    kpi_name: PropTypes.string,
    challenge_type: PropTypes.string,
    current_value: PropTypes.number,
    target_value: PropTypes.number,
    unit: PropTypes.string,
    updated_at: PropTypes.string,
    updated_by_name: PropTypes.string
  })).isRequired,
  onDeleteChallenge: PropTypes.func.isRequired
};
