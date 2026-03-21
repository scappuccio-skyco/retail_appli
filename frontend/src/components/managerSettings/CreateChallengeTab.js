import React from 'react';
import { Plus } from 'lucide-react';
import { logger } from '../../utils/logger';

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
  return (
    <div className="space-y-6">
      <div id="challenge-form-section" className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {editingChallenge ? '✏️ Modifier le Challenge' : '➕ Créer un Challenge'}
        </h3>

        <form onSubmit={editingChallenge ? handleUpdateChallenge : handleCreateChallenge} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Titre *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-64 sm:w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                    <div className="font-semibold mb-1">💡 Conseil :</div>
                    Donnez un nom accrocheur à votre challenge (ex: "Challenge Parfums", "Top Vendeur du Mois")
                  </div>
                </div>
              </div>
              <input
                type="text"
                required
                value={newChallenge.title}
                onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                placeholder="Ex: Challenge Parfums"
              />
            </div>

            {/* Description du challenge */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
              <textarea
                rows="2"
                value={newChallenge.description}
                onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none resize-none"
                placeholder="Décrivez brièvement ce challenge..."
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Type *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 sm:left-auto sm:right-0 top-7 z-10 w-72 sm:w-80 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                    <div className="font-semibold mb-2">🎯 Différence entre les types :</div>
                    <div className="space-y-2">
                      <div><strong>🏆 Collectif :</strong> Toute l'équipe travaille ensemble vers l'objectif commun</div>
                      <div><strong>👤 Individuel :</strong> Challenge personnel pour un vendeur spécifique</div>
                    </div>
                  </div>
                </div>
              </div>
              <select
                required
                value={editingChallenge ? editingChallenge.type : newChallenge.type}
                onChange={(e) => editingChallenge
                  ? setEditingChallenge({ ...editingChallenge, type: e.target.value, seller_id: '' })
                  : setNewChallenge({ ...newChallenge, type: e.target.value, seller_id: '' })
                }
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
              >
                <option value="collective">🏆 Collectif (toute l'équipe)</option>
                <option value="individual">👤 Individuel (un vendeur)</option>
              </select>
            </div>

            {(editingChallenge?.type === 'individual' || newChallenge.type === 'individual') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                <select
                  required
                  value={editingChallenge ? editingChallenge.seller_id : newChallenge.seller_id}
                  onChange={(e) => editingChallenge
                    ? setEditingChallenge({ ...editingChallenge, seller_id: e.target.value })
                    : setNewChallenge({ ...newChallenge, seller_id: e.target.value })
                  }
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                >
                  <option value="">Sélectionner un vendeur</option>
                  {(Array.isArray(sellers) ? sellers : []).map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name} ({seller.email})
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
                    checked={newChallenge.visible !== false}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setNewChallenge({ ...newChallenge, visible: isChecked });
                      if (!isChecked) {
                        setSelectedVisibleSellersChallenge([]);
                        setIsChallengeSellerDropdownOpen(false);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm sm:text-base">👁️ Visible par les vendeurs</p>
                    <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir ce challenge</p>
                  </div>
                </label>

                {/* Seller selection dropdown - only for collective challenges */}
                {newChallenge.visible !== false && newChallenge.type === 'collective' && (
                  <div className="flex-1 w-full p-3 sm:p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                      <p className="text-xs sm:text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedVisibleSellersChallenge.length === sellers.length) {
                            setSelectedVisibleSellersChallenge([]);
                          } else {
                            setSelectedVisibleSellersChallenge((Array.isArray(sellers) ? sellers : []).map(s => s.id));
                          }
                        }}
                        className="text-xs px-2 sm:px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all whitespace-nowrap"
                      >
                        {selectedVisibleSellersChallenge.length === sellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Si aucun vendeur n'est sélectionné, tous les vendeurs verront ce challenge
                    </p>

                    {/* Custom Dropdown with Checkboxes */}
                    <div className="relative" ref={challengeSellerDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsChallengeSellerDropdownOpen(!isChallengeSellerDropdownOpen)}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
                      >
                        <span className="text-gray-700">
                          {selectedVisibleSellersChallenge.length === 0
                            ? 'Sélectionner les vendeurs...'
                            : `${selectedVisibleSellersChallenge.length} vendeur${selectedVisibleSellersChallenge.length > 1 ? 's' : ''} sélectionné${selectedVisibleSellersChallenge.length > 1 ? 's' : ''}`
                          }
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${isChallengeSellerDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isChallengeSellerDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {(Array.isArray(sellers) ? sellers : []).map((seller) => (
                            <label
                              key={seller.id}
                              className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedVisibleSellersChallenge.includes(seller.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedVisibleSellersChallenge([...selectedVisibleSellersChallenge, seller.id]);
                                  } else {
                                    setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== seller.id));
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
                    {selectedVisibleSellersChallenge.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Array.isArray(selectedVisibleSellersChallenge) ? selectedVisibleSellersChallenge : []).map(sellerId => {
                          const seller = (Array.isArray(sellers) ? sellers : []).find(s => s.id === sellerId);
                          return seller ? (
                            <span
                              key={sellerId}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                            >
                              {seller.name}
                              <button
                                type="button"
                                onClick={() => setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== sellerId))}
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
                <label className="block text-sm font-semibold text-gray-700">Date de début *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                    <div className="font-semibold mb-1">📅 Info :</div>
                    Le challenge peut commencer dans le futur. Il apparaîtra dans le dashboard avec un badge "Commence dans X jours"
                  </div>
                </div>
              </div>
              <input
                type="date"
                required
                value={editingChallenge ? editingChallenge.start_date : newChallenge.start_date}
                onChange={(e) => editingChallenge
                  ? setEditingChallenge({ ...editingChallenge, start_date: e.target.value })
                  : setNewChallenge({ ...newChallenge, start_date: e.target.value })
                }
                onFocus={(e) => {
                  // Ouvrir le calendrier au focus
                  try {
                    if (typeof e.target.showPicker === 'function') {
                      e.target.showPicker();
                    }
                  } catch (error) {
                    logger.log('showPicker not supported');
                  }
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700">Date de fin *</label>
                <div className="group relative">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                    ?
                  </div>
                  <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                    <div className="font-semibold mb-1">📅 Info :</div>
                    Date limite du challenge. Après cette date, le challenge sera marqué comme terminé
                  </div>
                </div>
              </div>
              <input
                type="date"
                required
                min={editingChallenge ? editingChallenge.start_date : newChallenge.start_date}
                value={editingChallenge ? editingChallenge.end_date : newChallenge.end_date}
                onChange={(e) => editingChallenge
                  ? setEditingChallenge({ ...editingChallenge, end_date: e.target.value })
                  : setNewChallenge({ ...newChallenge, end_date: e.target.value })
                }
                onFocus={(e) => {
                  // Ouvrir le calendrier au focus
                  try {
                    if (typeof e.target.showPicker === 'function') {
                      e.target.showPicker();
                    }
                  } catch (error) {
                    logger.log('showPicker not supported');
                  }
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer"
              />
            </div>

            {/* NEW FLEXIBLE CHALLENGE SYSTEM (same as objectives) */}
            <div className="md:col-span-2">
              <div className="mb-3">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  Type de challenge
                </h4>
              </div>

              {/* Challenge Type Selection - Horizontal Radio Buttons */}
              <div className="mb-4 flex flex-wrap gap-3">
                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'kpi_standard'
                    ? 'bg-yellow-50 border-yellow-500 shadow-md'
                    : 'bg-white border-gray-300 hover:border-yellow-300'
                }`}>
                  <input
                    type="radio"
                    name="challenge_type"
                    value="kpi_standard"
                    checked={(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'kpi_standard'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const currentKpiName = editingChallenge ? editingChallenge.kpi_name : newChallenge.kpi_name;
                      const unit = currentKpiName === 'ca' ? '€' :
                                   currentKpiName === 'ventes' ? 'ventes' :
                                   currentKpiName === 'articles' ? 'articles' : '';
                      editingChallenge
                        ? setEditingChallenge({ ...editingChallenge, challenge_type: newType, unit })
                        : setNewChallenge({ ...newChallenge, challenge_type: newType, unit });
                    }}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <span className={`font-semibold ${
                    (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'kpi_standard' ? 'text-yellow-700' : 'text-gray-700'
                  }`}>
                    📊 KPI Standard
                  </span>
                </label>

                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'product_focus'
                    ? 'bg-green-50 border-green-500 shadow-md'
                    : 'bg-white border-gray-300 hover:border-green-300'
                }`}>
                  <input
                    type="radio"
                    name="challenge_type"
                    value="product_focus"
                    checked={(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'product_focus'}
                    onChange={(e) => {
                      editingChallenge
                        ? setEditingChallenge({ ...editingChallenge, challenge_type: e.target.value, unit: '' })
                        : setNewChallenge({ ...newChallenge, challenge_type: e.target.value, unit: '' });
                    }}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className={`font-semibold ${
                    (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'product_focus' ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    📦 Focus Produit
                  </span>
                </label>

                <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'custom'
                    ? 'bg-purple-50 border-purple-500 shadow-md'
                    : 'bg-white border-gray-300 hover:border-purple-300'
                }`}>
                  <input
                    type="radio"
                    name="challenge_type"
                    value="custom"
                    checked={(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'custom'}
                    onChange={(e) => {
                      editingChallenge
                        ? setEditingChallenge({ ...editingChallenge, challenge_type: e.target.value, unit: '' })
                        : setNewChallenge({ ...newChallenge, challenge_type: e.target.value, unit: '' });
                    }}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className={`font-semibold ${
                    (editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'custom' ? 'text-purple-700' : 'text-gray-700'
                  }`}>
                    ✨ Autre (personnalisé)
                  </span>
                </label>
              </div>

              {/* Conditional Fields Based on Challenge Type */}
              {(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'kpi_standard' && (
                <div className="mb-4 bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                  <select
                    required
                    value={editingChallenge ? editingChallenge.kpi_name : newChallenge.kpi_name}
                    onChange={(e) => {
                      const kpiName = e.target.value;
                      let unit = '';
                      if (kpiName === 'ca') unit = '€';
                      else if (kpiName === 'ventes') unit = 'ventes';
                      else if (kpiName === 'articles') unit = 'articles';
                      editingChallenge
                        ? setEditingChallenge({ ...editingChallenge, kpi_name: kpiName, unit })
                        : setNewChallenge({ ...newChallenge, kpi_name: kpiName, unit });
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="ca">💰 Chiffre d'affaires</option>
                    <option value="ventes">🛍️ Nombre de ventes</option>
                    <option value="articles">📦 Nombre d'articles</option>
                  </select>
                </div>
              )}

              {(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'product_focus' && (
                <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                  <input
                    type="text"
                    required
                    value={editingChallenge ? editingChallenge.product_name : newChallenge.product_name}
                    onChange={(e) => editingChallenge
                      ? setEditingChallenge({ ...editingChallenge, product_name: e.target.value })
                      : setNewChallenge({ ...newChallenge, product_name: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                    placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..."
                  />
                  <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                </div>
              )}

              {(editingChallenge ? editingChallenge.challenge_type : newChallenge.challenge_type) === 'custom' && (
                <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description du challenge *</label>
                  <textarea
                    required
                    rows="3"
                    value={editingChallenge ? editingChallenge.custom_description : newChallenge.custom_description}
                    onChange={(e) => editingChallenge
                      ? setEditingChallenge({ ...editingChallenge, custom_description: e.target.value })
                      : setNewChallenge({ ...newChallenge, custom_description: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                    placeholder="Ex: Améliorer la satisfaction client, Augmenter les ventes croisées..."
                  />
                  <p className="text-xs text-gray-600 mt-2">✨ Décrivez votre challenge personnalisé</p>
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
                    value={editingChallenge ? editingChallenge.target_value : newChallenge.target_value}
                    onChange={(e) => editingChallenge
                      ? setEditingChallenge({ ...editingChallenge, target_value: e.target.value })
                      : setNewChallenge({ ...newChallenge, target_value: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
                    placeholder="Ex: 50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                  <input
                    type="text"
                    value={editingChallenge ? editingChallenge.unit : newChallenge.unit}
                    onChange={(e) => editingChallenge
                      ? setEditingChallenge({ ...editingChallenge, unit: e.target.value })
                      : setNewChallenge({ ...newChallenge, unit: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
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
                    onClick={() => setNewChallenge({ ...newChallenge, data_entry_responsible: 'seller' })}
                    className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                      newChallenge.data_entry_responsible === 'seller'
                        ? 'bg-cyan-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    title="Vendeur"
                  >
                    🧑‍💼
                  </button>
                  <span className={`text-sm font-medium ${
                    newChallenge.data_entry_responsible === 'seller' ? 'text-cyan-700' : 'text-gray-500'
                  }`}>
                    Vendeur
                  </span>

                  <div className="mx-4 h-8 w-px bg-gray-300"></div>

                  <button
                    type="button"
                    onClick={() => setNewChallenge({ ...newChallenge, data_entry_responsible: 'manager' })}
                    className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                      newChallenge.data_entry_responsible === 'manager'
                        ? 'bg-orange-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    title="Manager"
                  >
                    👨‍💼
                  </button>
                  <span className={`text-sm font-medium ${
                    newChallenge.data_entry_responsible === 'manager' ? 'text-orange-700' : 'text-gray-500'
                  }`}>
                    Manager
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  {newChallenge.data_entry_responsible === 'seller'
                    ? '🧑‍💼 Le vendeur pourra saisir la progression de ce challenge'
                    : '👨‍💼 Vous (manager) saisirez la progression de ce challenge'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
            >
              {editingChallenge ? '💾 Enregistrer les modifications' : '➕ Créer le Challenge'}
            </button>
            {editingChallenge && (
              <button
                type="button"
                onClick={() => setEditingChallenge(null)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
