import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Settings, Target, Trophy, Edit2, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerSettingsModal({ isOpen, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('kpi'); // 'kpi', 'objectives', 'challenges'
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // New challenge form
  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '',
    type: 'collective',
    seller_id: '',
    ca_target: '',
    ventes_target: '',
    indice_vente_target: '',
    panier_moyen_target: '',
    start_date: '',
    end_date: ''
  });

  // New objective form
  const [newObjective, setNewObjective] = useState({
    ca_target: '',
    indice_vente_target: '',
    panier_moyen_target: '',
    period_start: '',
    period_end: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, objectivesRes, challengesRes, sellersRes] = await Promise.all([
        axios.get(`${API}/manager/kpi-config`, { headers }),
        axios.get(`${API}/manager/objectives`, { headers }),
        axios.get(`${API}/manager/challenges`, { headers }),
        axios.get(`${API}/manager/sellers`, { headers })
      ]);
      
      setKpiConfig(configRes.data);
      setObjectives(objectivesRes.data);
      setChallenges(challengesRes.data);
      setSellers(sellersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleKPIConfigUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/manager/kpi-config`, kpiConfig, { headers });
      toast.success('Configuration KPI mise à jour');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/manager/challenges`, newChallenge, { headers });
      toast.success('Challenge créé avec succès');
      setNewChallenge({
        title: '',
        description: '',
        type: 'collective',
        seller_id: '',
        ca_target: '',
        ventes_target: '',
        indice_vente_target: '',
        panier_moyen_target: '',
        start_date: '',
        end_date: ''
      });
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error creating challenge:', err);
      toast.error('Erreur lors de la création du challenge');
    }
  };

  const handleUpdateChallenge = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/manager/challenges/${editingChallenge.id}`, editingChallenge, { headers });
      toast.success('Challenge modifié avec succès');
      setEditingChallenge(null);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating challenge:', err);
      toast.error('Erreur lors de la modification du challenge');
    }
  };

  const handleDeleteChallenge = async (challengeId, challengeTitle) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le challenge "${challengeTitle}" ?`)) {
      try {
        await axios.delete(`${API}/manager/challenges/${challengeId}`, { headers });
        toast.success('Challenge supprimé avec succès');
        fetchData();
        if (onUpdate) onUpdate();
      } catch (err) {
        console.error('Error deleting challenge:', err);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-800" />
            <h2 className="text-3xl font-bold text-gray-800">⚙️ Configuration & Défis</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-800 hover:text-gray-600 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => setActiveTab('kpi')}
            className={`px-6 py-4 font-semibold transition-all ${
              activeTab === 'kpi'
                ? 'border-b-4 border-[#ffd871] text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Configuration KPI
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-6 py-4 font-semibold transition-all ${
              activeTab === 'challenges'
                ? 'border-b-4 border-[#ffd871] text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🏆 Défis & Challenges
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Chargement...</div>
          ) : (
            <>
              {/* KPI Configuration Tab */}
              {activeTab === 'kpi' && kpiConfig && (
                <form onSubmit={handleKPIConfigUpdate} className="space-y-6">
                  <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📈 KPI à suivre</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Sélectionnez les KPI que vos vendeurs devront renseigner quotidiennement
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_ca}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_ca: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">💰 Chiffre d'Affaires</p>
                          <p className="text-xs text-gray-500">CA journalier réalisé</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_ventes}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_ventes: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">🛍️ Nombre de Ventes</p>
                          <p className="text-xs text-gray-500">Transactions réalisées</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_clients}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_clients: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">👥 Nombre de Clients</p>
                          <p className="text-xs text-gray-500">Clients accueillis</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_articles}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_articles: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">📦 Nombre d'Articles</p>
                          <p className="text-xs text-gray-500">Articles vendus</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
                  >
                    💾 Enregistrer la Configuration
                  </button>
                </form>
              )}

              {/* Challenges Tab */}
              {activeTab === 'challenges' && (
                <div className="space-y-6">
                  {/* Create/Edit Challenge Form */}
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-[#ffd871]">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      {editingChallenge ? '✏️ Modifier le Challenge' : '➕ Créer un Challenge'}
                    </h3>
                    
                    <form onSubmit={editingChallenge ? handleUpdateChallenge : handleCreateChallenge} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Titre *</label>
                          <input
                            type="text"
                            required
                            value={editingChallenge ? editingChallenge.title : newChallenge.title}
                            onChange={(e) => editingChallenge 
                              ? setEditingChallenge({ ...editingChallenge, title: e.target.value })
                              : setNewChallenge({ ...newChallenge, title: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: Challenge Parfums"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                          <textarea
                            value={editingChallenge ? editingChallenge.description : newChallenge.description}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, description: e.target.value })
                              : setNewChallenge({ ...newChallenge, description: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            rows="3"
                            placeholder="Description du challenge..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Type *</label>
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
                              {sellers.map((seller) => (
                                <option key={seller.id} value={seller.id}>
                                  {seller.name} ({seller.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Date de début *</label>
                          <input
                            type="date"
                            required
                            value={editingChallenge ? editingChallenge.start_date : newChallenge.start_date}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, start_date: e.target.value })
                              : setNewChallenge({ ...newChallenge, start_date: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Date de fin *</label>
                          <input
                            type="date"
                            required
                            value={editingChallenge ? editingChallenge.end_date : newChallenge.end_date}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, end_date: e.target.value })
                              : setNewChallenge({ ...newChallenge, end_date: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">💰 Objectif CA (€)</label>
                          <input
                            type="number"
                            value={editingChallenge ? editingChallenge.ca_target : newChallenge.ca_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, ca_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, ca_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 10000"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🛍️ Objectif Ventes</label>
                          <input
                            type="number"
                            value={editingChallenge ? editingChallenge.ventes_target : newChallenge.ventes_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, ventes_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, ventes_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 50"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🛒 Objectif Panier Moyen (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingChallenge ? editingChallenge.panier_moyen_target : newChallenge.panier_moyen_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, panier_moyen_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, panier_moyen_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 150"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">💎 Objectif Indice Vente</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editingChallenge ? editingChallenge.indice_vente_target : newChallenge.indice_vente_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, indice_vente_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, indice_vente_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 2.5"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
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

                  {/* Challenges List */}
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Liste des Challenges</h3>
                    
                    {challenges.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucun challenge créé pour le moment</p>
                    ) : (
                      <div className="space-y-3">
                        {challenges.map((challenge) => (
                          <div
                            key={challenge.id}
                            className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-[#ffd871] transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-gray-800">{challenge.title}</h4>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    challenge.type === 'collective'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {challenge.type === 'collective' ? '🏆 Collectif' : '👤 Individuel'}
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    challenge.status === 'active'
                                      ? 'bg-blue-100 text-blue-700'
                                      : challenge.status === 'completed'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {challenge.status === 'active' ? '✅ Actif' : challenge.status === 'completed' ? '✔️ Terminé' : '❌ Échoué'}
                                  </span>
                                </div>
                                {challenge.description && (
                                  <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                  <span>📅 Du {new Date(challenge.start_date).toLocaleDateString('fr-FR')} au {new Date(challenge.end_date).toLocaleDateString('fr-FR')}</span>
                                  {challenge.ca_target && <span>💰 CA: {challenge.ca_target}€</span>}
                                  {challenge.ventes_target && <span>🛍️ Ventes: {challenge.ventes_target}</span>}
                                  {challenge.panier_moyen_target && <span>🛒 PM: {challenge.panier_moyen_target}€</span>}
                                  {challenge.indice_vente_target && <span>💎 IV: {challenge.indice_vente_target}</span>}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => setEditingChallenge(challenge)}
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
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
