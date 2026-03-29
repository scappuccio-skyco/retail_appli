import React, { useState } from 'react';
import { Edit3, Sparkles } from 'lucide-react';
import { logger } from '../../utils/logger';

// Fonction utilitaire pour formater les dates
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function SaisieTab({
  editingEntry, savingKPI, saveMessage,
  kpiConfig, isReadOnly,
  handleDirectSaveKPI,
  setEditingEntry, setActiveTab,
}) {
  return (
            <div className="px-6 py-6">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200 mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  {editingEntry ? 'Modifier mes chiffres' : 'Saisir mes chiffres du jour'}
                </h3>
                <p className="text-sm text-gray-600">
                  {editingEntry
                    ? `Modification des données du ${formatDate(editingEntry.date)}`
                    : 'Renseignez vos données quotidiennes. Vous pourrez les retrouver et corriger dans l\'onglet "Mon bilan".'
                  }
                </p>
              </div>

              {/* Message de feedback */}
              {saveMessage && (
                <div className={`mb-4 p-4 rounded-lg border-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-green-50 border-green-400 text-green-800'
                    : 'bg-red-50 border-red-400 text-red-800'
                }`}>
                  <p className="font-semibold">{saveMessage.text}</p>
                </div>
              )}

              {/* Formulaire de saisie */}
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const data = {
                    date: formData.get('date'),
                    ca_journalier: kpiConfig?.track_ca ? (Number.parseFloat(formData.get('ca_journalier')) || 0) : 0,
                    nb_ventes: kpiConfig?.track_ventes ? (parseInt(formData.get('nb_ventes')) || 0) : 0,
                    nb_articles: kpiConfig?.track_articles ? (parseInt(formData.get('nb_articles')) || 0) : 0,
                    nb_prospects: kpiConfig?.track_prospects ? (parseInt(formData.get('nb_prospects')) || 0) : 0
                  };

                  // Sauvegarde directe sans ouvrir de modal
                  handleDirectSaveKPI(data);
                }} className="space-y-6">
                  {/* Sélecteur de date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      defaultValue={editingEntry?.date || new Date().toISOString().split('T')[0]}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-gray-800 font-medium"
                      required
                      readOnly={!!editingEntry}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editingEntry
                        ? 'La date ne peut pas être modifiée'
                        : 'Sélectionnez le jour pour lequel vous souhaitez saisir vos données'
                      }
                    </p>
                  </div>

                  {/* KPIs en grille - Affichage basé sur track_* (déjà mappé depuis seller_track_* par le backend) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CA - Affiché uniquement si seller_track_ca = true */}
                    {kpiConfig?.track_ca && (
                      <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                        <label className="block text-sm font-semibold text-orange-900 mb-2">
                          💰 Chiffre d'Affaires (€)
                        </label>
                        <input
                          type="number"
                          name="ca_journalier"
                          step="0.01"
                          min="0"
                          defaultValue={editingEntry?.ca_journalier || ''}
                          placeholder="Ex: 1250.50"
                          className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Ventes - Affiché uniquement si seller_track_ventes = true */}
                    {kpiConfig?.track_ventes && (
                      <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                        <label className="block text-sm font-semibold text-green-900 mb-2">
                          🛒 Nombre de Ventes
                        </label>
                        <input
                          type="number"
                          name="nb_ventes"
                          min="0"
                          defaultValue={editingEntry?.nb_ventes || ''}
                          placeholder="Ex: 15"
                          className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Articles - Affiché uniquement si seller_track_articles = true */}
                    {kpiConfig?.track_articles && (
                      <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                        <label className="block text-sm font-semibold text-blue-900 mb-2">
                          📦 Nombre d'Articles
                        </label>
                        <input
                          type="number"
                          name="nb_articles"
                          min="0"
                          defaultValue={editingEntry?.nb_articles || ''}
                          placeholder="Ex: 20"
                          className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Prospects - Affiché uniquement si seller_track_prospects = true */}
                    {kpiConfig?.track_prospects && (
                      <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                        <label className="block text-sm font-semibold text-purple-900 mb-2">
                          🚶 Nombre de Prospects
                        </label>
                        <input
                          type="number"
                          name="nb_prospects"
                          min="0"
                          defaultValue={editingEntry?.nb_prospects || ''}
                          placeholder="Ex: 30"
                          className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-4">
                    {editingEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntry(null);
                          setActiveTab('kpi');
                        }}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                      >
                        ❌ Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingKPI}
                      className={`flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg ${
                        savingKPI
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:from-orange-700 hover:to-amber-700'
                      }`}
                    >
                      {savingKPI
                        ? '⏳ Enregistrement...'
                        : editingEntry
                        ? '💾 Enregistrer les modifications'
                        : '💾 Enregistrer mes chiffres'
                      }
                    </button>
                    {!editingEntry && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('kpi')}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                      >
                        📊 Voir l'historique
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Aide et conseils */}
              <div className="mt-6 bg-orange-50 rounded-lg p-4 border-l-4 border-orange-400">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-1">💡 Astuce</p>
                    <p className="text-sm text-orange-800">
                      Saisissez vos chiffres chaque jour pour suivre vos progrès !
                      Pour corriger une saisie, allez dans l'onglet "Historique" et cliquez sur la journée à modifier.
                    </p>
                  </div>
                </div>
              </div>
            </div>
  );
}
