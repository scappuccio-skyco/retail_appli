import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

export default function ActiveObjectivesTab({
  objectives,
  sellers,
  updatingProgressObjectiveId,
  setUpdatingProgressObjectiveId,
  progressValue,
  setProgressValue,
  handleDeleteObjective,
  handleUpdateProgress,
  setEditingObjective,
  setActiveTab,
}) {
  return (
    <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Objectifs en cours</h3>

          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const objectivesList = Array.isArray(objectives) ? objectives : [];
            const activeObjectives = objectivesList.filter(obj => {
              // Objective is active if:
              // 1. Period hasn't ended yet (period_end >= today)
              // 2. AND status is 'active' (not 'achieved' or 'failed')
              return obj.period_end >= today && obj.status !== 'achieved' && obj.status !== 'failed';
            });

            return activeObjectives.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun objectif en cours</p>
            ) : (
              <div className="space-y-3">
                {activeObjectives.map((objective) => (
              <div
                key={objective.id}
                id={`obj-${objective.id}`}
                className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200 hover:border-purple-400 transition-all"
              >
                <div>
                  <div>
                    <div className="mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-base sm:text-lg">
                          🎯 {objective.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                        {/* Type badge */}
                        <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                          objective.type === 'collective'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {objective.type === 'collective' ? '👥 Collectif' : (
                            objective.seller_id ?
                              `👤 ${(Array.isArray(sellers) ? sellers : []).find(s => s.id === objective.seller_id)?.name || 'Individuel'}`
                              : '👤 Individuel'
                          )}
                        </span>
                        {/* Visibility badge */}
                        <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                          objective.visible === false
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {objective.visible === false ? '🔒 Non visible' :
                            objective.visible_to_sellers && objective.visible_to_sellers.length > 0
                              ? `👁️ ${objective.visible_to_sellers.length} vendeur${objective.visible_to_sellers.length > 1 ? 's' : ''}`
                              : '👁️ Tous'
                          }
                        </span>
                        {/* Status badge */}
                        <span className={`text-xs font-bold px-2 sm:px-3 py-1 rounded-full whitespace-nowrap ${
                          objective.status === 'achieved'
                            ? 'bg-green-500 text-white shadow-lg'
                            : objective.status === 'failed'
                            ? 'bg-white sm:bg-red-500 text-red-700 sm:text-white border-2 border-red-500 shadow-lg'
                            : 'bg-yellow-400 text-gray-800 shadow-md'
                        }`}>
                          {objective.status === 'achieved' ? '✅ Réussi' :
                            objective.status === 'failed' ? '❌ Raté' : '⏳ En cours'}
                        </span>
                        </div>
                      </div>
                      {objective.description && (
                        <p className="text-sm text-gray-600 mt-1 break-words">
                          {objective.description}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      📅 Période: {new Date(objective.period_start).toLocaleDateString('fr-FR')} - {new Date(objective.period_end).toLocaleDateString('fr-FR')}
                    </div>
                    {/* Show specific sellers if any */}
                    {objective.visible && objective.visible_to_sellers && objective.visible_to_sellers.length > 0 && (
                      <div className="text-xs text-gray-600 mb-2">
                        👤 Visible pour : {(Array.isArray(objective.visible_to_sellers) ? objective.visible_to_sellers : []).map(sellerId => {
                          const seller = (Array.isArray(sellers) ? sellers : []).find(s => s.id === sellerId);
                          return seller ? seller.name : 'Inconnu';
                        }).join(', ')}
                      </div>
                    )}

                    {/* NEW OBJECTIVE SYSTEM DISPLAY */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="flex-1">
                          {objective.objective_type === 'kpi_standard' && (
                            <div>
                              <span className="text-xs sm:text-sm font-semibold text-blue-700">
                                📊 KPI: {
                                  objective.kpi_name === 'ca' ? '💰 CA' :
                                  objective.kpi_name === 'ventes' ? '🛍️ Ventes' :
                                  objective.kpi_name === 'articles' ? '📦 Articles' :
                                  objective.kpi_name
                                }
                              </span>
                            </div>
                          )}
                          {objective.objective_type === 'product_focus' && (
                            <div>
                              <span className="text-xs sm:text-sm font-semibold text-green-700 block mb-1">
                                📦 Focus Produit
                              </span>
                              <div className="bg-white rounded px-2 sm:px-3 py-2 mt-1">
                                <p className="text-xs text-gray-600">Produit ciblé :</p>
                                <p className="text-sm font-bold text-gray-800">{objective.product_name}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Objectif : <span className="font-semibold text-green-700">{objective.target_value?.toLocaleString('fr-FR')} {objective.unit || ''}</span>
                                </p>
                              </div>
                            </div>
                          )}
                          {objective.objective_type === 'custom' && (
                            <div>
                              <span className="text-xs sm:text-sm font-semibold text-purple-700">
                                ✨ Objectif personnalisé
                              </span>
                              {objective.custom_description && (
                                <p className="text-xs text-gray-600 mt-1">{objective.custom_description}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <span className={`text-xs font-bold px-2 sm:px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center ${
                          objective.data_entry_responsible === 'seller'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}>
                          {objective.data_entry_responsible === 'seller' ? '🧑‍💼 Vendeur' : '👨‍💼 Manager'}
                        </span>
                      </div>

                      {/* Progress info - Only for KPI Standard and Custom */}
                      {(objective.objective_type === 'kpi_standard' || objective.objective_type === 'custom') && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2 pt-2 border-t border-gray-200">
                          <span className="text-xs sm:text-sm font-semibold text-gray-700">
                            🎯 Cible: {objective.target_value?.toLocaleString('fr-FR')} {objective.unit || ''}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700">
                            📊 Actuel: {(objective.current_value || 0)?.toLocaleString('fr-FR')} {objective.unit || ''}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-blue-600">
                            ⏳ Restant: {Math.max(0, (objective.target_value || 0) - (objective.current_value || 0))?.toLocaleString('fr-FR')} {objective.unit || ''}
                          </span>
                        </div>
                      )}

                      {/* Progress info - For Product Focus (show current value) */}
                      {objective.objective_type === 'product_focus' && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-semibold text-gray-700">
                              📊 Progression: {(objective.current_value || 0)?.toLocaleString('fr-FR')} {objective.unit || ''}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${
                              ((objective.current_value || 0) / objective.target_value) * 100 >= 75 ? 'bg-green-500' :
                              ((objective.current_value || 0) / objective.target_value) * 100 >= 50 ? 'bg-yellow-500' :
                              ((objective.current_value || 0) / objective.target_value) * 100 >= 25 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(Math.round(((objective.current_value || 0) / objective.target_value) * 100), 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 text-center mt-1">
                          {Math.min(Math.round(((objective.current_value || 0) / objective.target_value) * 100), 100)}% atteint
                        </div>
                      </div>

                      {/* Informations de dernière mise à jour */}
                      {objective.updated_at && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                          <span>📅 Dernière mise à jour :</span>
                          <span className="font-semibold">
                            {new Date(objective.updated_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {objective.updated_by_name && (
                            <>
                              <span>par</span>
                              <span className="font-semibold text-blue-600">
                                {objective.updated_by_name}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Progress Update Button - Only for responsible user */}
                      {objective.data_entry_responsible === 'manager' && (
                        <div className="mt-3">
                          {updatingProgressObjectiveId === objective.id ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  key={updatingProgressObjectiveId || 'objective-progress'}
                                  name={`objective_progress_${objective.id}`}
                                  autoComplete="new-password"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={progressValue}
                                  onChange={(e) => setProgressValue(e.target.value)}
                                  placeholder="Saisir la progression (ex: 200)"
                                  className="w-24 sm:flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-xs sm:text-sm"
                                  autoFocus
                                />
                                {objective.unit && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">{objective.unit}</span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateProgress(objective.id)}
                                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-xs sm:text-sm whitespace-nowrap"
                                >
                                  ✅ Valider
                                </button>
                                <button
                                  onClick={() => {
                                    setUpdatingProgressObjectiveId(null);
                                    setProgressValue('');
                                  }}
                                  className="px-3 sm:px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all text-xs sm:text-sm"
                                >
                                  ❌
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setUpdatingProgressObjectiveId(objective.id);
                                // On veut une saisie "incrementale" : champ vide à l'ouverture
                                setProgressValue('');
                              }}
                              className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-semibold flex items-center justify-center gap-2"
                            >
                              📝 Mettre à jour la progression
                            </button>
                          )}

                          {/* Historique des mises à jour (sous le bouton) */}
                          {Array.isArray(objective.progress_history) && objective.progress_history.length > 0 && (
                            <div className="mt-2 bg-white/70 rounded-lg p-2 border border-gray-200">
                              <p className="text-xs font-semibold text-gray-600 mb-1">📜 Historique des progression</p>
                              <div className="max-h-28 overflow-y-auto space-y-1">
                                {(Array.isArray(objective.progress_history) ? objective.progress_history : []).slice(-10).reverse().map((entry, idx) => {
                                  const dt = entry?.date;
                                  const label = dt ? new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                                  const who = entry?.updated_by_name ? ` • ${entry.updated_by_name}` : '';
                                  const val = entry?.value ?? '';
                                  const valLabel = typeof val === 'number' ? val.toLocaleString('fr-FR') : val;
                                  return (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px] text-gray-700">
                                      <span className="text-gray-600 truncate">{label}{who}</span>
                                      <span className="font-semibold whitespace-nowrap">{valLabel} {objective.unit || ''}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingObjective(objective);
                        // Basculer vers l'onglet "Nouvel objectif"
                        setActiveTab('create_objective');
                        // Scroll vers le formulaire d'objectif
                        setTimeout(() => {
                          const objectiveSection = document.querySelector('#objective-form-section');
                          if (objectiveSection) {
                            objectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-all"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteObjective(objective.id)}
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
            );
          })()}
        </div>
    </div>
  );
}
