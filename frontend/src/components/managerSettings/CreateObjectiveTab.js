import React from 'react';
import { logger } from '../../utils/logger';
import SellerVisibilityDropdown from './shared/SellerVisibilityDropdown';
import DataEntryResponsibleToggle from './shared/DataEntryResponsibleToggle';

function InfoTooltip({ children }) {
  return (
    <div className="group relative">
      <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
        ?
      </div>
      <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-64 sm:w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
        {children}
      </div>
    </div>
  );
}

function showPicker(e) {
  try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch { logger.log('showPicker not supported'); }
}

function kpiUnit(name) {
  return name === 'ca' ? '€' : name === 'ventes' ? 'ventes' : name === 'articles' ? 'articles' : '';
}

export default function CreateObjectiveTab({
  editingObjective,
  setEditingObjective,
  newObjective,
  setNewObjective,
  sellers,
  selectedVisibleSellers,
  setSelectedVisibleSellers,
  isSellerDropdownOpen,
  setIsSellerDropdownOpen,
  sellerDropdownRef,
  handleCreateObjective,
  handleUpdateObjective,
  setActiveTab,
}) {
  const set = (patch) => setNewObjective({ ...newObjective, ...patch });

  return (
    <div className="space-y-6">
      <div id="objective-form-section" className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-300">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editingObjective ? '✏️ Modifier l\'Objectif' : '➕ Créer un Objectif'}
        </h3>

        <form onSubmit={editingObjective ? handleUpdateObjective : handleCreateObjective} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Type collectif / individuel */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type d'objectif *</label>
              <div className="flex gap-3">
                {[
                  { value: 'collective', label: "👥 Objectif d'Équipe", desc: "Pour toute l'équipe" },
                  { value: 'individual', label: '👤 Objectif Individuel', desc: 'Pour un vendeur spécifique' },
                ].map(({ value, label, desc }) => (
                  <button key={value} type="button"
                    onClick={() => set({ type: value, seller_id: value === 'collective' ? '' : newObjective.seller_id })}
                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${newObjective.type === value ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'}`}
                  >
                    <div className="font-semibold text-gray-800 text-sm">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Catégorie */}
            {newObjective.type && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catégorie d'objectif *</label>
                <div className="flex flex-wrap gap-3">
                  <button type="button"
                    onClick={() => set({ objective_type: 'kpi_standard', unit: kpiUnit(newObjective.kpi_name) })}
                    className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'kpi_standard' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50'}`}
                  >
                    <div className="font-semibold text-gray-800 text-sm">📊 KPI Standard</div>
                    <div className="text-xs text-gray-500 mt-0.5">CA, ventes, articles</div>
                  </button>
                  <button type="button"
                    onClick={() => set({ objective_type: 'product_focus', unit: '' })}
                    className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'product_focus' ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50'}`}
                  >
                    <div className="font-semibold text-gray-800 text-sm">📦 Focus Produit</div>
                    <div className="text-xs text-gray-500 mt-0.5">Mettre en avant un produit</div>
                  </button>
                  <button type="button"
                    onClick={() => set({ objective_type: 'custom', unit: '' })}
                    className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'custom' ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50'}`}
                  >
                    <div className="font-semibold text-gray-800 text-sm">✨ Autre</div>
                    <div className="text-xs text-gray-500 mt-0.5">Objectif personnalisé</div>
                  </button>
                </div>
              </div>
            )}

            {/* Reste du formulaire — visible après les 2 premières sélections */}
            {newObjective.type && newObjective.objective_type && (<>

              {/* Nom */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Nom de l'objectif *</label>
                  <InfoTooltip><div className="font-semibold mb-1">💡 Conseil :</div>Donnez un nom à votre objectif (ex: "Objectifs Décembre 2025", "Q1 2025")</InfoTooltip>
                </div>
                <input type="text" required value={newObjective.title} onChange={(e) => set({ title: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Ex: Objectifs Décembre 2025" />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
                <textarea rows="2" value={newObjective.description} onChange={(e) => set({ description: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none resize-none" placeholder="Décrivez brièvement cet objectif..." />
              </div>

              {/* Vendeur (individuel) */}
              {newObjective.type === 'individual' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                  <select required value={newObjective.seller_id} onChange={(e) => set({ seller_id: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none">
                    <option value="">Sélectionner un vendeur</option>
                    {(Array.isArray(sellers) ? sellers : []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Visibilité (collective only) */}
              {newObjective.type === 'collective' && (
                <div className="md:col-span-2">
                  <SellerVisibilityDropdown
                    visible={newObjective.visible}
                    onVisibleChange={(v) => set({ visible: v })}
                    sellers={sellers}
                    selectedSellers={selectedVisibleSellers}
                    setSelectedSellers={setSelectedVisibleSellers}
                    dropdownRef={sellerDropdownRef}
                    isDropdownOpen={isSellerDropdownOpen}
                    setIsDropdownOpen={setIsSellerDropdownOpen}
                  />
                </div>
              )}

              {/* Dates */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Période de début *</label>
                  <InfoTooltip><div className="font-semibold mb-1">📅 Début de période :</div>Date de début pour la mesure des objectifs (ex: 1er du mois)</InfoTooltip>
                </div>
                <input type="date" required value={newObjective.period_start} onChange={(e) => set({ period_start: e.target.value })} onFocus={showPicker}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Période de fin *</label>
                  <InfoTooltip><div className="font-semibold mb-1">📅 Fin de période :</div>Date de fin de la période de mesure (ex: dernier jour du mois)</InfoTooltip>
                </div>
                <input type="date" required min={newObjective.period_start} value={newObjective.period_end} onChange={(e) => set({ period_end: e.target.value })} onFocus={showPicker}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer" />
              </div>

              {/* Détails selon catégorie */}
              <div className="md:col-span-2">
                {newObjective.objective_type === 'kpi_standard' && (
                  <div className="mb-4 bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                    <select required value={newObjective.kpi_name} onChange={(e) => set({ kpi_name: e.target.value, unit: kpiUnit(e.target.value) })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none">
                      <option value="ca">💰 Chiffre d'affaires</option>
                      <option value="ventes">🛍️ Nombre de ventes</option>
                      <option value="articles">📦 Nombre d'articles</option>
                    </select>
                  </div>
                )}

                {newObjective.objective_type === 'product_focus' && (
                  <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                    <input type="text" required value={newObjective.product_name} onChange={(e) => set({ product_name: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                      placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..." />
                    <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                  </div>
                )}

                {/* Valeur cible + unité */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Valeur cible *</label>
                    <input type="number" step="0.01" min="0" required value={newObjective.target_value} onChange={(e) => set({ target_value: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="Ex: 50000" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                    <input type="text" value={newObjective.unit} onChange={(e) => set({ unit: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none" placeholder="€, ventes, %..." />
                  </div>
                </div>

                <DataEntryResponsibleToggle
                  value={newObjective.data_entry_responsible}
                  onChange={(v) => set({ data_entry_responsible: v })}
                />
              </div>
            </>)}
          </div>

          {newObjective.type && newObjective.objective_type && (
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all">
                {editingObjective ? '💾 Enregistrer les modifications' : "➕ Créer l'Objectif"}
              </button>
              {editingObjective && (
                <button type="button" onClick={() => setEditingObjective(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all">
                  Annuler
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
