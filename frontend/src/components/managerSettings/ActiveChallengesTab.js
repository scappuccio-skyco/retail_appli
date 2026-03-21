import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

export default function ActiveChallengesTab({
  challenges,
  sellers,
  updatingProgressChallengeId,
  setUpdatingProgressChallengeId,
  challengeProgressValue,
  setChallengeProgressValue,
  handleDeleteChallenge,
  setEditingChallenge,
  setActiveTab,
  storeParam,
  fetchData,
  onUpdate,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Challenges en cours</h3>

        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const challengesList = Array.isArray(challenges) ? challenges : [];
          const activeChallenges = challengesList.filter(chall => {
            return chall.end_date >= today && chall.status !== 'achieved';
          });

          return activeChallenges.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucun challenge en cours</p>
          ) : (
            <div className="space-y-3">
              {activeChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-[#ffd871] transition-all"
              >
                <div>
                  <div>
                    <div className="mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-base sm:text-lg">
                          🏆 {challenge.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                        {/* Type badge */}
                        <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                          challenge.type === 'collective'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {challenge.type === 'collective' ? '👥 Collectif' : (
                            challenge.seller_id ?
                              `👤 ${(Array.isArray(sellers) ? sellers : []).find(s => s.id === challenge.seller_id)?.name || 'Individuel'}`
                              : '👤 Individuel'
                          )}
                        </span>
                        {/* Visibility badge */}
                        <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                          challenge.visible === false
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {challenge.visible === false ? '🔒 Non visible' :
                            challenge.visible_to_sellers && challenge.visible_to_sellers.length > 0
                              ? `👁️ ${challenge.visible_to_sellers.length} vendeur${challenge.visible_to_sellers.length > 1 ? 's' : ''}`
                              : '👁️ Tous'
                          }
                        </span>
                        {/* Status badge */}
                        <span className={`text-xs font-bold px-2 sm:px-3 py-1 rounded-full whitespace-nowrap ${
                          challenge.status === 'completed'
                            ? 'bg-green-500 text-white shadow-lg'
                            : challenge.status === 'failed'
                            ? 'bg-white sm:bg-red-500 text-red-700 sm:text-white border-2 border-red-500 shadow-lg'
                            : 'bg-yellow-400 text-gray-800 shadow-md'
                        }`}>
                          {challenge.status === 'completed' ? '✅ Réussi' :
                            challenge.status === 'failed' ? '❌ Raté' : '⏳ En cours'}
                        </span>
                        </div>
                      </div>
                      {challenge.description && (
                        <p className="text-sm text-gray-600 mt-1 break-words">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      📅 Période: {new Date(challenge.start_date).toLocaleDateString('fr-FR')} - {new Date(challenge.end_date).toLocaleDateString('fr-FR')}
                    </div>
                    {/* Show specific sellers if any */}
                    {challenge.visible && challenge.visible_to_sellers && challenge.visible_to_sellers.length > 0 && (
                      <div className="text-xs text-gray-600 mb-2">
                        👤 Visible pour : {(Array.isArray(challenge.visible_to_sellers) ? challenge.visible_to_sellers : []).map(sellerId => {
                          const seller = (Array.isArray(sellers) ? sellers : []).find(s => s.id === sellerId);
                          return seller ? seller.name : 'Inconnu';
                        }).join(', ')}
                      </div>
                    )}


                    {/* Display challenge details based on type */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3 mb-3">
                      {/* KPI Standard challenges */}
                      {challenge.challenge_type === 'kpi_standard' && (
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-blue-700 block mb-2">
                            📊 KPI: {
                              challenge.kpi_name === 'ca' ? '💰 CA' :
                              challenge.kpi_name === 'ventes' ? '🛍️ Ventes' :
                              challenge.kpi_name === 'articles' ? '📦 Articles' :
                              challenge.kpi_name
                            }
                          </span>
                          {challenge.target_value && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs sm:text-sm mt-2 pt-2 border-t border-gray-200">
                              <span className="text-gray-700">
                                🎯 Cible: {challenge.target_value?.toLocaleString('fr-FR')} {challenge.unit || ''}
                              </span>
                              <span className="text-gray-700">
                                📊 Actuel: {(challenge.current_value || 0)?.toLocaleString('fr-FR')} {challenge.unit || ''}
                              </span>
                              <span className="text-blue-600 font-semibold">
                                ⏳ Restant: {Math.max(0, (challenge.target_value || 0) - (challenge.current_value || 0))?.toLocaleString('fr-FR')} {challenge.unit || ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Product Focus challenges */}
                      {challenge.challenge_type === 'product_focus' && (
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-green-700 block mb-2">📦 Focus Produit</span>
                          <div className="bg-white rounded px-2 sm:px-3 py-2">
                            <p className="text-xs text-gray-600">Produit ciblé :</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-800">{challenge.product_name}</p>
                            {challenge.target_value && (
                              <p className="text-xs text-gray-600 mt-1">
                                Objectif : <span className="font-semibold text-green-700">{challenge.target_value.toLocaleString('fr-FR')} {challenge.unit || ''}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Custom challenges */}
                      {challenge.challenge_type === 'custom' && (
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-purple-700 block mb-2">✨ Challenge personnalisé</span>
                          {challenge.custom_description && (
                            <p className="text-xs text-gray-600">{challenge.custom_description}</p>
                          )}
                          {challenge.target_value && (
                            <div className="text-xs sm:text-sm mt-2">
                              <span className="text-gray-700">Objectif : </span>
                              <span className="font-bold text-purple-700">{challenge.target_value.toLocaleString('fr-FR')} {challenge.unit || ''}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Old format challenges (with multiple targets) */}
                      {!challenge.challenge_type && (
                        <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600">
                          {challenge.ca_target && <span className="whitespace-nowrap">💰 CA: {challenge.ca_target.toLocaleString('fr-FR')}€</span>}
                          {challenge.ventes_target && <span className="whitespace-nowrap">📈 Ventes: {challenge.ventes_target}</span>}
                          {challenge.clients_target && <span className="whitespace-nowrap">👥 Clients: {challenge.clients_target}</span>}
                          {challenge.articles_target && <span className="whitespace-nowrap">📦 Articles: {challenge.articles_target}</span>}
                          {challenge.panier_moyen_target && <span className="whitespace-nowrap">🛒 PM: {challenge.panier_moyen_target.toLocaleString('fr-FR')}€</span>}
                          {challenge.indice_vente_target && <span className="whitespace-nowrap">💎 Indice: {challenge.indice_vente_target}</span>}
                          {challenge.taux_transformation_target && <span className="whitespace-nowrap">📊 Taux: {challenge.taux_transformation_target}%</span>}
                        </div>
                      )}

                      {/* Responsible indicator */}
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          challenge.data_entry_responsible === 'seller'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}>
                          {challenge.data_entry_responsible === 'seller' ? '🧑‍💼 Saisie Vendeur' : '👨‍💼 Saisie Manager'}
                        </span>
                      </div>
                    </div>

                    {/* Barres de progression par KPI */}
                    {(() => {
                      const kpiProgressions = [];

                      if (challenge.ca_target && challenge.ca_target > 0) {
                        const progress_ca = challenge.progress_ca || 0;
                        const percent = Math.min(Math.round((progress_ca / challenge.ca_target) * 100), 100);
                        kpiProgressions.push({
                          label: '💰 CA',
                          current: progress_ca.toLocaleString('fr-FR'),
                          target: challenge.ca_target.toLocaleString('fr-FR'),
                          unit: '€',
                          percent
                        });
                      }
                      if (challenge.ventes_target && challenge.ventes_target > 0) {
                        const progress_ventes = challenge.progress_ventes || 0;
                        const percent = Math.min(Math.round((progress_ventes / challenge.ventes_target) * 100), 100);
                        kpiProgressions.push({
                          label: '📈 Ventes',
                          current: progress_ventes,
                          target: challenge.ventes_target,
                          unit: '',
                          percent
                        });
                      }
                      if (challenge.articles_target && challenge.articles_target > 0) {
                        const progress_articles = challenge.progress_articles || 0;
                        const percent = Math.min(Math.round((progress_articles / challenge.articles_target) * 100), 100);
                        kpiProgressions.push({
                          label: '📦 Articles',
                          current: progress_articles,
                          target: challenge.articles_target,
                          unit: '',
                          percent
                        });
                      }
                      if (challenge.panier_moyen_target && challenge.panier_moyen_target > 0) {
                        const progress_pm = challenge.progress_panier_moyen || 0;
                        const percent = Math.min(Math.round((progress_pm / challenge.panier_moyen_target) * 100), 100);
                        kpiProgressions.push({
                          label: '🛒 Panier Moyen',
                          current: progress_pm.toFixed(2),
                          target: challenge.panier_moyen_target.toFixed(2),
                          unit: '€',
                          percent
                        });
                      }
                      if (challenge.indice_vente_target && challenge.indice_vente_target > 0) {
                        const progress_iv = challenge.progress_indice_vente || 0;
                        const percent = Math.min(Math.round((progress_iv / challenge.indice_vente_target) * 100), 100);
                        kpiProgressions.push({
                          label: '💎 Indice',
                          current: progress_iv.toFixed(2),
                          target: challenge.indice_vente_target.toFixed(2),
                          unit: '',
                          percent
                        });
                      }

                      return kpiProgressions.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-semibold text-gray-600 mb-2">📊 Progression par KPI</div>
                          {(Array.isArray(kpiProgressions) ? kpiProgressions : []).map((kpi, index) => {
                            let progressColor = 'bg-red-500';
                            if (kpi.percent >= 75) progressColor = 'bg-green-500';
                            else if (kpi.percent >= 50) progressColor = 'bg-yellow-500';
                            else if (kpi.percent >= 25) progressColor = 'bg-orange-500';

                            return (
                              <div key={index} className="bg-gray-50 rounded-lg p-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-700">{kpi.label}</span>
                                  <span className="text-xs text-gray-600">
                                    {kpi.current}{kpi.unit} / {kpi.target}{kpi.unit} ({kpi.percent}%)
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`${progressColor} h-2 rounded-full transition-all duration-300`}
                                    style={{ width: `${kpi.percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}

                    {/* Progress Update Button - Only for manager-responsible challenges */}
                    {challenge.data_entry_responsible === 'manager' && (
                      <div className="mt-3">
                        {updatingProgressChallengeId === challenge.id ? (
                          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-orange-300">
                            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Mettre à jour la progression :</p>

                            {/* Challenge with target_value (kpi_standard, product_focus) */}
                            {challenge.target_value && !challenge.ca_target && !challenge.ventes_target ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    name={`challenge_progress_${challenge.id}`}
                                    autoComplete="new-password"
                                    placeholder="Saisir la progression (ex: 200)"
                                    value={challengeProgressValue}
                                    onChange={(e) => setChallengeProgressValue(e.target.value)}
                                    className="w-32 sm:flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-xs sm:text-sm"
                                  />
                                  {challenge.unit && (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">{challenge.unit}</span>
                                  )}
                                </div>
                                {challenge.target_value && (
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs">
                                    <span className="text-gray-500">
                                      🎯 Cible: {challenge.target_value?.toLocaleString('fr-FR')} {challenge.unit || ''}
                                    </span>
                                    <span className="text-gray-500">
                                      📊 Actuel: {(challenge.current_value || 0)?.toLocaleString('fr-FR')} {challenge.unit || ''}
                                    </span>
                                    <span className="text-blue-600 font-semibold">
                                      ⏳ Restant: {Math.max(0, (challenge.target_value || 0) - (challenge.current_value || 0))?.toLocaleString('fr-FR')} {challenge.unit || ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Challenge with multiple targets */
                              <div className="space-y-2">
                                {challenge.ca_target && challenge.ca_target > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <label className="text-xs text-gray-600 w-16 sm:w-24 flex-shrink-0">💰 CA :</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Valeur"
                                    defaultValue=""
                                    className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-xs sm:text-sm"
                                    onBlur={(e) => {
                                      const val = Number.parseFloat(e.target.value) || 0;
                                      challenge.progress_ca = val;
                                    }}
                                  />
                                  <span className="text-xs text-gray-500">€</span>
                                </div>
                              )}
                              {challenge.ventes_target && challenge.ventes_target > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <label className="text-xs text-gray-600 w-16 sm:w-24 flex-shrink-0">📈 Ventes :</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Nombre"
                                    defaultValue=""
                                    className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-xs sm:text-sm"
                                    onBlur={(e) => {
                                      const val = Number.parseInt(e.target.value) || 0;
                                      challenge.progress_ventes = val;
                                    }}
                                  />
                                </div>
                              )}
                              {challenge.clients_target && challenge.clients_target > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <label className="text-xs text-gray-600 w-16 sm:w-24 flex-shrink-0">👥 Clients :</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Nombre"
                                    defaultValue=""
                                    className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-xs sm:text-sm"
                                    onBlur={(e) => {
                                      const val = Number.parseInt(e.target.value) || 0;
                                      challenge.progress_clients = val;
                                    }}
                                  />
                                </div>
                              )}
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={async () => {
                                  try {
                                    // For challenges with target_value (kpi_standard, product_focus)
                                    if (challenge.target_value && !challenge.ca_target && !challenge.ventes_target) {
                                      await api.post(
                                        `/manager/challenges/${challenge.id}/progress${storeParam}`,
                                        {
                                          current_value: Number.parseFloat(challengeProgressValue) || challenge.current_value || 0
                                        }
                                      );
                                    } else {
                                      // For challenges with multiple targets
                                      await api.post(
                                        `/manager/challenges/${challenge.id}/progress${storeParam}`,
                                        {
                                          progress_ca: challenge.progress_ca,
                                          progress_ventes: challenge.progress_ventes,
                                          progress_clients: challenge.progress_clients
                                        }
                                      );
                                    }
                                    toast.success('Progression mise à jour');
                                    setUpdatingProgressChallengeId(null);
                                    setChallengeProgressValue('');
                                    fetchData();
                                    if (onUpdate) onUpdate();
                                  } catch (err) {
                                    logger.error('Error:', err);
                                    toast.error('Erreur');
                                  }
                                }}
                                className="flex-1 px-2 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-xs sm:text-sm"
                              >
                                ✅ Valider
                              </button>
                              <button
                                onClick={() => {
                                  setUpdatingProgressChallengeId(null);
                                }}
                                className="px-2 sm:px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all text-xs sm:text-sm"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setUpdatingProgressChallengeId(challenge.id);
                              // Champ vide à l'ouverture
                              setChallengeProgressValue('');
                            }}
                            className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-semibold flex items-center justify-center gap-2"
                          >
                            📝 Mettre à jour la progression
                          </button>
                        )}

                        {/* Historique des mises à jour (sous le bouton) */}
                        {Array.isArray(challenge.progress_history) && challenge.progress_history.length > 0 && (
                          <div className="mt-2 bg-white/70 rounded-lg p-2 border border-gray-200">
                              <p className="text-xs font-semibold text-gray-600 mb-1">📜 Historique des progression</p>
                            <div className="max-h-28 overflow-y-auto space-y-1">
                              {(Array.isArray(challenge.progress_history) ? challenge.progress_history : []).slice(-10).reverse().map((entry, idx) => {
                                const dt = entry?.date;
                                const label = dt ? new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                                const who = entry?.updated_by_name ? ` • ${entry.updated_by_name}` : '';
                                const val = entry?.value ?? '';
                                const valLabel = typeof val === 'number' ? val.toLocaleString('fr-FR') : val;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-2 text-[11px] text-gray-700">
                                    <span className="text-gray-600 truncate">{label}{who}</span>
                                    <span className="font-semibold whitespace-nowrap">{valLabel} {challenge.unit || ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingChallenge(challenge);
                        // Basculer vers l'onglet "Nouveau challenge"
                        setActiveTab('create_challenge');
                        // Scroll vers le formulaire de challenge
                        setTimeout(() => {
                          const challengeSection = document.querySelector('#challenge-form-section');
                          if (challengeSection) {
                            challengeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-all"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteChallenge(challenge.id, challenge.title)}
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
