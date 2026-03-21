import React from 'react';
import { Plus } from 'lucide-react';
import { logger } from '../../utils/logger';

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
  return (
    <div className="space-y-6">
        <div id="objective-form-section" className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-300">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {editingObjective ? '✏️ Modifier l\'Objectif' : '➕ Créer un Objectif'}
          </h3>

        <form onSubmit={editingObjective ? handleUpdateObjective : handleCreateObjective} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Type d'objectif — en premier */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type d'objectif *</label>
              <div className="flex gap-3">
                {[
                  { value: 'collective', label: "👥 Objectif d'Équipe", desc: 'Pour toute l\'équipe' },
                  { value: 'individual', label: '👤 Objectif Individuel', desc: 'Pour un vendeur spécifique' },
                ].map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNewObjective({ ...newObjective, type: value, seller_id: value === 'collective' ? '' : newObjective.seller_id })}
                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                      newObjective.type === value
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <div className="font-semibold text-gray-800 text-sm">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Étape 2 — Catégorie d'objectif (visible après sélection du type) */}
            {newObjective.type && (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Catégorie d'objectif *</label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setNewObjective({ ...newObjective, objective_type: 'kpi_standard', unit: newObjective.kpi_name === 'ca' ? '€' : newObjective.kpi_name === 'ventes' ? 'ventes' : newObjective.kpi_name === 'articles' ? 'articles' : '' })}
                  className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'kpi_standard' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50'}`}
                >
                  <div className="font-semibold text-gray-800 text-sm">📊 KPI Standard</div>
                  <div className="text-xs text-gray-500 mt-0.5">CA, ventes, articles</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewObjective({ ...newObjective, objective_type: 'product_focus', unit: '' })}
                  className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'product_focus' ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50'}`}
                >
                  <div className="font-semibold text-gray-800 text-sm">📦 Focus Produit</div>
                  <div className="text-xs text-gray-500 mt-0.5">Mettre en avant un produit</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewObjective({ ...newObjective, objective_type: 'custom', unit: '' })}
                  className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${newObjective.objective_type === 'custom' ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50'}`}
                >
                  <div className="font-semibold text-gray-800 text-sm">✨ Autre</div>
                  <div className="text-xs text-gray-500 mt-0.5">Objectif personnalisé</div>
                </button>
              </div>
            </div>
            )}

            {/* Étape 3 — Reste du formulaire (visible après les deux premières sélections) */}
            {newObjective.type && newObjective.objective_type && (<>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Nom de l'objectif *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-64 sm:w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                    <div className="font-semibold mb-1">💡 Conseil :</div>
                    Donnez un nom à votre objectif (ex: "Objectifs Décembre 2025", "Q1 2025")
                  </div>
                </div>
              </div>
              <input
                type="text"
                required
                value={newObjective.title}
                onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                placeholder="Ex: Objectifs Décembre 2025"
              />
            </div>

            {/* Description de l'objectif */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
              <textarea
                rows="2"
                value={newObjective.description}
                onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none resize-none"
                placeholder="Décrivez brièvement cet objectif..."
              />
            </div>

            {/* Seller selection for individual objectives */}
            {newObjective.type === 'individual' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                <select
                  required
                  value={newObjective.seller_id}
                  onChange={(e) => setNewObjective({ ...newObjective, seller_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  <option value="">Sélectionner un vendeur</option>
                  {(Array.isArray(sellers) ? sellers : []).map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visibilité - Layout responsive */}
            <div className="md:col-span-2">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Checkbox Visible */}
                <label className="flex items-center gap-3 p-3 sm:p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all flex-shrink-0 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    checked={newObjective.visible !== false}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setNewObjective({ ...newObjective, visible: isChecked });
                      if (!isChecked) {
                        setSelectedVisibleSellers([]);
                        setIsSellerDropdownOpen(false);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">👁️ Visible par les vendeurs</p>
                    <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir cet objectif</p>
                  </div>
                </label>

                {/* Seller selection dropdown - only for collective objectives */}
                {newObjective.visible !== false && newObjective.type === 'collective' && (
                  <div className="flex-1 w-full p-3 sm:p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                      <p className="text-xs sm:text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedVisibleSellers.length === sellers.length) {
                            setSelectedVisibleSellers([]);
                          } else {
                            setSelectedVisibleSellers((Array.isArray(sellers) ? sellers : []).map(s => s.id));
                          }
                        }}
                        className="text-xs px-2 sm:px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all whitespace-nowrap"
                      >
                        {selectedVisibleSellers.length === sellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Si aucun vendeur n'est sélectionné, tous les vendeurs verront cet objectif
                    </p>

                    {/* Custom Dropdown with Checkboxes */}
                    <div className="relative" ref={sellerDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
                      >
                        <span className="text-gray-700">
                          {selectedVisibleSellers.length === 0
                            ? 'Sélectionner les vendeurs...'
                            : `${selectedVisibleSellers.length} vendeur${selectedVisibleSellers.length > 1 ? 's' : ''} sélectionné${selectedVisibleSellers.length > 1 ? 's' : ''}`
                          }
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${isSellerDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isSellerDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {(Array.isArray(sellers) ? sellers : []).map((seller) => (
                            <label
                              key={seller.id}
                              className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedVisibleSellers.includes(seller.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedVisibleSellers([...selectedVisibleSellers, seller.id]);
                                  } else {
                                    setSelectedVisibleSellers((Array.isArray(selectedVisibleSellers) ? selectedVisibleSellers : []).filter(id => id !== seller.id));
                                  }
                                }}
                                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              />
                              <span className="text-sm text-gray-700 font-medium">{seller.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected sellers badges */}
                    {(Array.isArray(selectedVisibleSellers) ? selectedVisibleSellers : []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Array.isArray(selectedVisibleSellers) ? selectedVisibleSellers : []).map(sellerId => {
                          const seller = (Array.isArray(sellers) ? sellers : []).find(s => s.id === sellerId);
                          return seller ? (
                            <span
                              key={sellerId}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                            >
                              {seller.name}
                              <button
                                type="button"
                                onClick={() => setSelectedVisibleSellers((Array.isArray(selectedVisibleSellers) ? selectedVisibleSellers : []).filter(id => id !== sellerId))}
                                className="ml-1 hover:text-green-900 font-bold text-lg leading-none"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Période de début *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-64 sm:w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                    <div className="font-semibold mb-1">📅 Début de période :</div>
                    Date de début pour la mesure des objectifs (ex: 1er du mois)
                  </div>
                </div>
              </div>
              <input
                type="date"
                required
                value={newObjective.period_start}
                onChange={(e) => setNewObjective({ ...newObjective, period_start: e.target.value })}
                onFocus={(e) => {
                  // Ouvrir le calendrier au focus
                  try {
                    if (typeof e.target.showPicker === 'function') {
                      e.target.showPicker();
                    }
                  } catch (error) {
                    // showPicker n'est pas supporté par ce navigateur
                    logger.log('showPicker not supported');
                  }
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Période de fin *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                    <div className="font-semibold mb-1">📅 Fin de période :</div>
                    Date de fin de la période de mesure (ex: dernier jour du mois)
                  </div>
                </div>
              </div>
              <input
                type="date"
                required
                min={newObjective.period_start}
                value={newObjective.period_end}
                onChange={(e) => setNewObjective({ ...newObjective, period_end: e.target.value })}
                onFocus={(e) => {
                  // Ouvrir le calendrier au focus
                  try {
                    if (typeof e.target.showPicker === 'function') {
                      e.target.showPicker();
                    }
                  } catch (error) {
                    // showPicker n'est pas supporté par ce navigateur
                    logger.log('showPicker not supported');
                  }
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Détails selon la catégorie choisie */}
            <div className="md:col-span-2">
              {newObjective.objective_type === 'kpi_standard' && (
                <div className="mb-4 bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                  <select
                    required
                    value={newObjective.kpi_name}
                    onChange={(e) => {
                      const kpiName = e.target.value;
                      let unit = '';
                      if (kpiName === 'ca') unit = '€';
                      else if (kpiName === 'ventes') unit = 'ventes';
                      else if (kpiName === 'articles') unit = 'articles';
                      setNewObjective({ ...newObjective, kpi_name: kpiName, unit });
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none"
                  >
                    <option value="ca">💰 Chiffre d'affaires</option>
                    <option value="ventes">🛍️ Nombre de ventes</option>
                    <option value="articles">📦 Nombre d'articles</option>
                  </select>
                </div>
              )}

              {newObjective.objective_type === 'product_focus' && (
                <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                  <input
                    type="text"
                    required
                    value={newObjective.product_name}
                    onChange={(e) => setNewObjective({ ...newObjective, product_name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                    placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..."
                  />
                  <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                </div>
              )}

              {/* Target Value */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Valeur cible *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newObjective.target_value}
                    onChange={(e) => setNewObjective({ ...newObjective, target_value: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                    placeholder="Ex: 50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                  <input
                    type="text"
                    value={newObjective.unit}
                    onChange={(e) => setNewObjective({ ...newObjective, unit: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                    placeholder="€, ventes, %..."
                  />
                </div>
              </div>

              {/* Data Entry Responsible - TOGGLES STYLE MAGASIN */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border-2 border-orange-200">
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  📝 Qui saisit la progression ? *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewObjective({ ...newObjective, data_entry_responsible: 'seller' })}
                    className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                      newObjective.data_entry_responsible === 'seller'
                        ? 'bg-cyan-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    title="Vendeur"
                  >
                    🧑‍💼
                  </button>
                  <span className={`text-sm font-medium ${
                    newObjective.data_entry_responsible === 'seller' ? 'text-cyan-700' : 'text-gray-500'
                  }`}>
                    Vendeur
                  </span>

                  <div className="mx-4 h-8 w-px bg-gray-300"></div>

                  <button
                    type="button"
                    onClick={() => setNewObjective({ ...newObjective, data_entry_responsible: 'manager' })}
                    className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                      newObjective.data_entry_responsible === 'manager'
                        ? 'bg-orange-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    title="Manager"
                  >
                    👨‍💼
                  </button>
                  <span className={`text-sm font-medium ${
                    newObjective.data_entry_responsible === 'manager' ? 'text-orange-700' : 'text-gray-500'
                  }`}>
                    Manager
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  {newObjective.data_entry_responsible === 'seller'
                    ? '🧑‍💼 Le vendeur pourra saisir la progression de cet objectif'
                    : '👨‍💼 Vous (manager) saisirez la progression de cet objectif'}
                </p>
              </div>
            </div>
            </>)}
          </div>

          {newObjective.type && newObjective.objective_type && (
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
            >
              {editingObjective ? '💾 Enregistrer les modifications' : '➕ Créer l\'Objectif'}
            </button>
            {editingObjective && (
              <button
                type="button"
                onClick={() => setEditingObjective(null)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
              >
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
