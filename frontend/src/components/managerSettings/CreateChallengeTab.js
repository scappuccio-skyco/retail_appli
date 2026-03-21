import React from 'react';
import { logger } from '../../utils/logger';
import SellerVisibilityDropdown from './shared/SellerVisibilityDropdown';
import DataEntryResponsibleToggle from './shared/DataEntryResponsibleToggle';

function InfoTooltip({ children }) {
  return (
    <div className="group relative">
      <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
        ?
      </div>
      <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-64 sm:w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
        {children}
      </div>
    </div>
  );
}

function showPicker(e) {
  try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch { logger.log('showPicker not supported'); }
}

// Returns the auto-unit for a given kpi_name
function kpiUnit(name) {
  return name === 'ca' ? '€' : name === 'ventes' ? 'ventes' : name === 'articles' ? 'articles' : '';
}

export default function CreateChallengeTab({
  editingChallenge,
  setEditingChallenge,
  newChallenge,
  setNewChallenge,
  sellers,
  selectedVisibleSellersChallenge,
  setSelectedVisibleSellersChallenge,
  isChallengeSellerDropdownOpen,
  setIsChallengeSellerDropdownOpen,
  challengeSellerDropdownRef,
  handleCreateChallenge,
  handleUpdateChallenge,
}) {
  const ch = editingChallenge || newChallenge;
  const setCh = (patch) => editingChallenge
    ? setEditingChallenge({ ...editingChallenge, ...patch })
    : setNewChallenge({ ...newChallenge, ...patch });

  return (
    <div className="space-y-6">
      <div id="challenge-form-section" className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editingChallenge ? '✏️ Modifier le Challenge' : '➕ Créer un Challenge'}
        </h3>

        <form onSubmit={editingChallenge ? handleUpdateChallenge : handleCreateChallenge} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Titre */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Titre *</label>
                <InfoTooltip><div className="font-semibold mb-1">💡 Conseil :</div>Donnez un nom accrocheur (ex: "Challenge Parfums", "Top Vendeur du Mois")</InfoTooltip>
              </div>
              <input type="text" required value={newChallenge.title} onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none" placeholder="Ex: Challenge Parfums" />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
              <textarea rows="2" value={newChallenge.description} onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none resize-none" placeholder="Décrivez brièvement ce challenge..." />
            </div>

            {/* Type collectif / individuel */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Type *</label>
                <InfoTooltip>
                  <div className="font-semibold mb-2">🎯 Différence entre les types :</div>
                  <div className="space-y-2">
                    <div><strong>🏆 Collectif :</strong> Toute l'équipe travaille ensemble</div>
                    <div><strong>👤 Individuel :</strong> Challenge personnel pour un vendeur</div>
                  </div>
                </InfoTooltip>
              </div>
              <select required value={ch.type} onChange={(e) => setCh({ type: e.target.value, seller_id: '' })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none">
                <option value="collective">🏆 Collectif (toute l'équipe)</option>
                <option value="individual">👤 Individuel (un vendeur)</option>
              </select>
            </div>

            {ch.type === 'individual' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                <select required value={ch.seller_id} onChange={(e) => setCh({ seller_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none">
                  <option value="">Sélectionner un vendeur</option>
                  {(Array.isArray(sellers) ? sellers : []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Visibilité (collective only) */}
            {newChallenge.type === 'collective' && (
              <div className="md:col-span-2">
                <SellerVisibilityDropdown
                  visible={newChallenge.visible}
                  onVisibleChange={(v) => setNewChallenge({ ...newChallenge, visible: v })}
                  sellers={sellers}
                  selectedSellers={selectedVisibleSellersChallenge}
                  setSelectedSellers={setSelectedVisibleSellersChallenge}
                  dropdownRef={challengeSellerDropdownRef}
                  isDropdownOpen={isChallengeSellerDropdownOpen}
                  setIsDropdownOpen={setIsChallengeSellerDropdownOpen}
                />
              </div>
            )}

            {/* Dates */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Date de début *</label>
                <InfoTooltip><div className="font-semibold mb-1">📅 Info :</div>Le challenge peut commencer dans le futur. Il apparaîtra avec un badge "Commence dans X jours"</InfoTooltip>
              </div>
              <input type="date" required value={ch.start_date} onChange={(e) => setCh({ start_date: e.target.value })} onFocus={showPicker}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Date de fin *</label>
                <InfoTooltip><div className="font-semibold mb-1">📅 Info :</div>Date limite du challenge. Après cette date, le challenge sera marqué comme terminé</InfoTooltip>
              </div>
              <input type="date" required min={ch.start_date} value={ch.end_date} onChange={(e) => setCh({ end_date: e.target.value })} onFocus={showPicker}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer" />
            </div>

            {/* Challenge type */}
            <div className="md:col-span-2">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><span className="text-lg">🎯</span>Type de challenge</h4>
              <div className="mb-4 flex flex-wrap gap-3">
                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${ch.challenge_type === 'kpi_standard' ? 'bg-yellow-50 border-yellow-500 shadow-md' : 'bg-white border-gray-300 hover:border-yellow-300'}`}>
                  <input type="radio" name="challenge_type" value="kpi_standard" checked={ch.challenge_type === 'kpi_standard'}
                    onChange={(e) => setCh({ challenge_type: e.target.value, unit: kpiUnit(ch.kpi_name) })} className="w-4 h-4 text-yellow-600" />
                  <span className={`font-semibold ${ch.challenge_type === 'kpi_standard' ? 'text-yellow-700' : 'text-gray-700'}`}>📊 KPI Standard</span>
                </label>
                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${ch.challenge_type === 'product_focus' ? 'bg-green-50 border-green-500 shadow-md' : 'bg-white border-gray-300 hover:border-green-300'}`}>
                  <input type="radio" name="challenge_type" value="product_focus" checked={ch.challenge_type === 'product_focus'}
                    onChange={(e) => setCh({ challenge_type: e.target.value, unit: '' })} className="w-4 h-4 text-green-600" />
                  <span className={`font-semibold ${ch.challenge_type === 'product_focus' ? 'text-green-700' : 'text-gray-700'}`}>📦 Focus Produit</span>
                </label>
                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${ch.challenge_type === 'custom' ? 'bg-purple-50 border-purple-500 shadow-md' : 'bg-white border-gray-300 hover:border-purple-300'}`}>
                  <input type="radio" name="challenge_type" value="custom" checked={ch.challenge_type === 'custom'}
                    onChange={(e) => setCh({ challenge_type: e.target.value, unit: '' })} className="w-4 h-4 text-purple-600" />
                  <span className={`font-semibold ${ch.challenge_type === 'custom' ? 'text-purple-700' : 'text-gray-700'}`}>✨ Autre (personnalisé)</span>
                </label>
              </div>

              {ch.challenge_type === 'kpi_standard' && (
                <div className="mb-4 bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                  <select required value={ch.kpi_name} onChange={(e) => setCh({ kpi_name: e.target.value, unit: kpiUnit(e.target.value) })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none">
                    <option value="ca">💰 Chiffre d'affaires</option>
                    <option value="ventes">🛍️ Nombre de ventes</option>
                    <option value="articles">📦 Nombre d'articles</option>
                  </select>
                </div>
              )}

              {ch.challenge_type === 'product_focus' && (
                <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                  <input type="text" required value={ch.product_name} onChange={(e) => setCh({ product_name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                    placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..." />
                  <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                </div>
              )}

              {ch.challenge_type === 'custom' && (
                <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description du challenge *</label>
                  <textarea required rows="3" value={ch.custom_description} onChange={(e) => setCh({ custom_description: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                    placeholder="Ex: Améliorer la satisfaction client, Augmenter les ventes croisées..." />
                  <p className="text-xs text-gray-600 mt-2">✨ Décrivez votre challenge personnalisé</p>
                </div>
              )}

              {/* Valeur cible + unité */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Valeur cible *</label>
                  <input type="number" step="0.01" min="0" required value={ch.target_value} onChange={(e) => setCh({ target_value: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none" placeholder="Ex: 50000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                  <input type="text" value={ch.unit} onChange={(e) => setCh({ unit: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none" placeholder="€, ventes, %..." />
                </div>
              </div>

              <DataEntryResponsibleToggle
                value={newChallenge.data_entry_responsible}
                onChange={(v) => setNewChallenge({ ...newChallenge, data_entry_responsible: v })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all">
              {editingChallenge ? '💾 Enregistrer les modifications' : '➕ Créer le Challenge'}
            </button>
            {editingChallenge && (
              <button type="button" onClick={() => setEditingChallenge(null)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all">
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
