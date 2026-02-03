import React from 'react';
import PropTypes from 'prop-types';
import { Trash2 } from 'lucide-react';

export default function ObjectivesCompletedTab({ objectives, onDeleteObjective }) {
  const today = new Date().toISOString().split('T')[0];
  const completedObjectives = objectives.filter(obj =>
    obj.period_end < today || obj.status === 'achieved' || obj.status === 'failed'
  );

  if (completedObjectives.length === 0) {
    return <p className="text-center text-gray-500 py-8">Aucun objectif terminé</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🏆 Objectifs terminés</h3>
        <div className="space-y-3">
          {completedObjectives.map((objective) => (
            <div
              key={objective.id}
              className={`rounded-lg p-4 border-2 transition-all ${
                objective.status === 'achieved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-800">{objective.title}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      objective.status === 'achieved'
                        ? 'bg-green-600 text-white'
                        : 'bg-white sm:bg-red-600 text-red-700 sm:text-white border-2 border-red-600'
                    }`}>
                      {objective.status === 'achieved' ? '✅ Atteint' : '❌ Non atteint'}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {objective.type === 'collective' ? 'Equipe' : 'Individuel'}
                    </span>
                  </div>
                  {objective.description && <p className="text-sm text-gray-600 mb-2">{objective.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm mt-3 bg-white rounded p-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Periode</p>
                      <p className="text-gray-800">
                        {new Date(objective.period_start).toLocaleDateString('fr-FR')} - {new Date(objective.period_end).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">🎯 KPI</p>
                      <p className="text-gray-800 capitalize">{objective.kpi_name || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-500">Progression finale</p>
                      <p className="text-gray-800 font-bold">
                        {objective.current_value || 0} / {objective.target_value} {objective.unit || ''}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full transition-all ${objective.status === 'achieved' ? 'bg-green-600' : 'bg-red-600'}`}
                          style={{ width: `${Math.min(((objective.current_value || 0) / objective.target_value) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={() => onDeleteObjective(objective.id)}
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
ObjectivesCompletedTab.propTypes = {
  objectives: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string,
    type: PropTypes.string,
    period_start: PropTypes.string,
    period_end: PropTypes.string,
    kpi_name: PropTypes.string,
    current_value: PropTypes.number,
    target_value: PropTypes.number,
    unit: PropTypes.string
  })).isRequired,
  onDeleteObjective: PropTypes.func.isRequired
};
