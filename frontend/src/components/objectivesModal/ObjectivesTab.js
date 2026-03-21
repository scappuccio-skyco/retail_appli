import React from 'react';
import { Target } from 'lucide-react';

export default function ObjectivesTab({
  activeObjectives,
  updatingObjectiveId,
  objectiveProgressValue,
  setUpdatingObjectiveId,
  setObjectiveProgressValue,
  handleUpdateProgress,
}) {
  return (
    <div>
      {/* Bandeau fin "Mes Objectifs" */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3">
        <p className="text-sm">Suivez vos objectifs et progressez vers vos cibles</p>
      </div>

      {/* Contenu avec padding */}
      <div className="px-6 py-6">
        {activeObjectives.length > 0 ? (
          <div className="space-y-4">
            {activeObjectives.map((objective, index) => {
              const isAchieved =
                objective.status === 'achieved' ||
                (objective.current_value >= objective.target_value && objective.target_value > 0);
              const isCompleted =
                objective.status === 'completed' || new Date(objective.period_end) < new Date();

              return (
                <div
                  key={`${objective.id}-${index}`}
                  id={`seller-obj-${objective.id}`}
                  className={`rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
                    isAchieved
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 hover:border-green-500 shadow-lg'
                      : isCompleted
                      ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300'
                      : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-300'
                  }`}
                >
                  {isAchieved && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-2 right-2 text-4xl animate-bounce">🎉</div>
                      <div className="absolute top-8 right-8 text-3xl animate-pulse">✨</div>
                      <div className="absolute bottom-4 left-4 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>🌟</div>
                      <div className="absolute bottom-8 right-12 text-2xl animate-pulse" style={{ animationDelay: '0.4s' }}>💫</div>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-gray-800">{objective.title || objective.name}</h4>
                        {isAchieved && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs font-bold shadow-md celebrate-animation">
                            🎉 Réussi !
                          </span>
                        )}
                        {isCompleted && !isAchieved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500 text-white rounded-full text-xs font-semibold">
                            ✓ Terminé
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{objective.description}</p>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">
                        {objective.type || 'Standard'}
                      </span>
                      {isAchieved && (
                        <div className="text-center">
                          <div className="text-3xl celebrate-animation">🏆</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informations détaillées */}
                  <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">📅 Période</p>
                        <p className="text-gray-800">
                          {new Date(objective.period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' - '}
                          {new Date(objective.period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">🎯 Type</p>
                        {objective.objective_type === 'kpi_standard' && (
                          <p className="text-gray-800 capitalize">
                            {objective.kpi_name === 'ca'
                              ? "💰 Chiffre d'affaires"
                              : objective.kpi_name === 'ventes'
                              ? '🛍️ Nombre de ventes'
                              : objective.kpi_name === 'articles'
                              ? "📦 Nombre d'articles"
                              : objective.kpi_name || 'N/A'}
                          </p>
                        )}
                        {objective.objective_type === 'product_focus' && (
                          <p className="text-gray-800">📦 Focus Produit</p>
                        )}
                        {objective.objective_type === 'custom' && (
                          <p className="text-gray-800">✨ Personnalisé</p>
                        )}
                      </div>
                    </div>

                    {/* Afficher les détails du produit pour product_focus */}
                    {objective.objective_type === 'product_focus' && objective.product_name && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 mb-1">📦 Produit ciblé</p>
                        <p className="text-gray-800 font-semibold">{objective.product_name}</p>
                        {objective.target_value && (
                          <p className="text-xs text-gray-600 mt-1">
                            Objectif : {objective.target_value} {objective.unit || ''}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Afficher la description pour custom */}
                    {objective.objective_type === 'custom' && objective.custom_description && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 mb-1">✨ Description</p>
                        <p className="text-xs text-gray-700">{objective.custom_description}</p>
                      </div>
                    )}
                  </div>

                  {/* Barre de progression */}
                  {objective.target_value && (
                    <div className="mt-3 relative z-10">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progression</span>
                        <span className={`font-semibold ${isAchieved ? 'text-green-600 font-bold' : ''}`}>
                          {objective.current_value || 0} / {objective.target_value} {objective.unit || ''}
                          {isAchieved && ' 🎯'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            isAchieved
                              ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 animate-pulse'
                              : 'bg-gradient-to-r from-purple-600 to-pink-600'
                          }`}
                          style={{
                            width: `${Math.min(
                              ((objective.current_value || 0) / objective.target_value) * 100,
                              100
                            )}%`,
                          }}
                        >
                          {isAchieved && (
                            <div className="absolute inset-0 bg-white opacity-30 animate-ping"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historique des progressions */}
                  {objective.progress_history && objective.progress_history.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
                          📊 Historique des progressions ({objective.progress_history.length})
                          <span className="text-xs">▼</span>
                        </summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {[...objective.progress_history].reverse().map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-purple-50 rounded px-2 py-1"
                            >
                              <span className="text-gray-600">
                                {new Date(entry.date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="font-semibold text-purple-700">
                                {entry.value} {objective.unit || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Bouton de mise à jour pour vendeur */}
                  {objective.data_entry_responsible === 'seller' && (
                    <div className="mt-3">
                      {updatingObjectiveId === objective.id ? (
                        <div className="bg-white rounded-lg p-3 border-2 border-cyan-300">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Mettre à jour ma progression :
                          </p>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              value={objectiveProgressValue}
                              onChange={(e) => setObjectiveProgressValue(e.target.value)}
                              placeholder="Nouvelle valeur"
                              className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm min-w-0"
                            />
                            <button
                              onClick={() => handleUpdateProgress(objective.id)}
                              className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold flex-shrink-0"
                              title="Valider"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => {
                                setUpdatingObjectiveId(null);
                                setObjectiveProgressValue('');
                              }}
                              className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all flex-shrink-0"
                              title="Annuler"
                            >
                              ❌
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setUpdatingObjectiveId(objective.id);
                            setObjectiveProgressValue('');
                          }}
                          className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all font-semibold flex items-center justify-center gap-2"
                        >
                          📝 Mettre à jour ma progression
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Target className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-semibold mb-2">Aucun objectif actif</p>
            <p className="text-sm">Vos objectifs apparaîtront ici une fois créés</p>
          </div>
        )}
      </div>
    </div>
  );
}
