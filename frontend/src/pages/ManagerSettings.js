import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Settings, Target, Trophy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerSettings() {
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // New objective form
  const [newObjective, setNewObjective] = useState({
    ca_target: '',
    indice_vente_target: '',
    panier_moyen_target: '',
    period_start: '',
    period_end: ''
  });
  
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, objectivesRes, challengesRes] = await Promise.all([
        axios.get(`${API}/manager/kpi-config`, { headers }),
        axios.get(`${API}/manager/objectives`, { headers }),
        axios.get(`${API}/manager/challenges`, { headers })
      ]);
      
      console.log('KPI Config loaded:', configRes.data);
      setKpiConfig(configRes.data);
      setObjectives(objectivesRes.data);
      setChallenges(challengesRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const updateKPIConfig = async (field, value) => {
    try {
      const res = await axios.put(`${API}/manager/kpi-config`, {
        [field]: value
      }, { headers });
      setKpiConfig(res.data);
      toast.success('Configuration mise à jour');
    } catch (err) {
      console.error('Error updating config:', err);
      toast.error('Erreur de mise à jour');
    }
  };

  const createObjective = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ca_target: newObjective.ca_target ? parseFloat(newObjective.ca_target) : null,
        indice_vente_target: newObjective.indice_vente_target ? parseFloat(newObjective.indice_vente_target) : null,
        panier_moyen_target: newObjective.panier_moyen_target ? parseFloat(newObjective.panier_moyen_target) : null,
        period_start: newObjective.period_start,
        period_end: newObjective.period_end
      };
      
      await axios.post(`${API}/manager/objectives`, data, { headers });
      toast.success('Objectif créé');
      fetchData();
      setNewObjective({
        ca_target: '',
        indice_vente_target: '',
        panier_moyen_target: '',
        period_start: '',
        period_end: ''
      });
    } catch (err) {
      console.error('Error creating objective:', err);
      toast.error('Erreur de création');
    }
  };

  const createChallenge = async (e) => {
    e.preventDefault();
    try {
      const data = {
        title: newChallenge.title,
        description: newChallenge.description || null,
        type: newChallenge.type,
        seller_id: newChallenge.type === 'individual' ? newChallenge.seller_id : null,
        ca_target: newChallenge.ca_target ? parseFloat(newChallenge.ca_target) : null,
        ventes_target: newChallenge.ventes_target ? parseInt(newChallenge.ventes_target) : null,
        indice_vente_target: newChallenge.indice_vente_target ? parseFloat(newChallenge.indice_vente_target) : null,
        panier_moyen_target: newChallenge.panier_moyen_target ? parseFloat(newChallenge.panier_moyen_target) : null,
        start_date: newChallenge.start_date,
        end_date: newChallenge.end_date
      };
      
      await axios.post(`${API}/manager/challenges`, data, { headers });
      toast.success('Challenge créé');
      fetchData();
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
    } catch (err) {
      console.error('Error creating challenge:', err);
      toast.error('Erreur de création du challenge');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">
    <div className="text-xl font-medium text-gray-600">Chargement...</div>
  </div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header avec bouton retour */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-xl">←</span>
              <span>Retour</span>
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-2xl font-bold text-gray-800">Configuration & Challenges</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* KPI Configuration */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-[#ffd871]" />
          <h2 className="text-2xl font-bold">Configuration des KPI</h2>
        </div>
        
        {kpiConfig ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Debug: track_ca={String(kpiConfig.track_ca)}, track_ventes={String(kpiConfig.track_ventes)}
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={kpiConfig.track_ca === true}
                onChange={(e) => updateKPIConfig('track_ca', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-lg">Chiffre d'affaires (CA)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={kpiConfig.track_ventes === true}
                onChange={(e) => updateKPIConfig('track_ventes', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-lg">Nombre de ventes</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={kpiConfig.track_clients === true}
                onChange={(e) => updateKPIConfig('track_clients', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-lg">Nombre de clients</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={kpiConfig.track_articles === true}
                onChange={(e) => updateKPIConfig('track_articles', e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-lg">Nombre d'articles</span>
            </label>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>KPI calculés automatiquement :</strong> Panier moyen, Taux de transformation, Indice de vente (CA / nb articles)
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Chargement de la configuration...</p>
        )}
      </div>

      {/* Manager Objectives */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-[#ffd871]" />
          <h2 className="text-2xl font-bold">Mes Objectifs</h2>
        </div>
        
        <form onSubmit={createObjective} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="CA cible (€)"
              value={newObjective.ca_target}
              onChange={(e) => setNewObjective({...newObjective, ca_target: e.target.value})}
              className="p-3 border rounded-lg"
            />
            
            <input
              type="number"
              step="0.01"
              placeholder="Indice de vente cible"
              value={newObjective.indice_vente_target}
              onChange={(e) => setNewObjective({...newObjective, indice_vente_target: e.target.value})}
              className="p-3 border rounded-lg"
            />
            
            <input
              type="number"
              step="0.01"
              placeholder="Panier moyen cible (€)"
              value={newObjective.panier_moyen_target}
              onChange={(e) => setNewObjective({...newObjective, panier_moyen_target: e.target.value})}
              className="p-3 border rounded-lg"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={newObjective.period_start}
              onChange={(e) => setNewObjective({...newObjective, period_start: e.target.value})}
              className="p-3 border rounded-lg"
              required
            />
            
            <input
              type="date"
              value={newObjective.period_end}
              onChange={(e) => setNewObjective({...newObjective, period_end: e.target.value})}
              className="p-3 border rounded-lg"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-[#ffd871] hover:bg-yellow-400 text-gray-800 font-semibold py-3 rounded-lg"
          >
            Créer un objectif
          </button>
        </form>
        
        <div className="space-y-2">
          {objectives.map((obj) => (
            <div key={obj.id} className="p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold">Période : {obj.period_start} → {obj.period_end}</p>
              {obj.ca_target && <p>CA : {obj.ca_target}€</p>}
              {obj.indice_vente_target && <p>Indice vente : {obj.indice_vente_target}</p>}
              {obj.panier_moyen_target && <p>Panier moyen : {obj.panier_moyen_target}€</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Challenges */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-[#ffd871]" />
          <h2 className="text-2xl font-bold">Challenges</h2>
        </div>
        
        <form onSubmit={createChallenge} className="space-y-4 mb-6">
          <input
            type="text"
            placeholder="Titre du challenge"
            value={newChallenge.title}
            onChange={(e) => setNewChallenge({...newChallenge, title: e.target.value})}
            className="w-full p-3 border rounded-lg"
            required
          />
          
          <textarea
            placeholder="Description (optionnel)"
            value={newChallenge.description}
            onChange={(e) => setNewChallenge({...newChallenge, description: e.target.value})}
            className="w-full p-3 border rounded-lg"
            rows="2"
          />
          
          <select
            value={newChallenge.type}
            onChange={(e) => setNewChallenge({...newChallenge, type: e.target.value})}
            className="w-full p-3 border rounded-lg"
          >
            <option value="collective">Collectif (toute l'équipe)</option>
            <option value="individual">Individuel</option>
          </select>
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="CA cible (€)"
              value={newChallenge.ca_target}
              onChange={(e) => setNewChallenge({...newChallenge, ca_target: e.target.value})}
              className="p-3 border rounded-lg"
            />
            
            <input
              type="number"
              placeholder="Ventes cibles"
              value={newChallenge.ventes_target}
              onChange={(e) => setNewChallenge({...newChallenge, ventes_target: e.target.value})}
              className="p-3 border rounded-lg"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={newChallenge.start_date}
              onChange={(e) => setNewChallenge({...newChallenge, start_date: e.target.value})}
              className="p-3 border rounded-lg"
              required
            />
            
            <input
              type="date"
              value={newChallenge.end_date}
              onChange={(e) => setNewChallenge({...newChallenge, end_date: e.target.value})}
              className="p-3 border rounded-lg"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-[#ffd871] hover:bg-yellow-400 text-gray-800 font-semibold py-3 rounded-lg"
          >
            Créer le challenge
          </button>
        </form>
        
        <div className="space-y-2">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-[#ffd871]">
              <h3 className="font-bold text-lg">{challenge.title}</h3>
              <p className="text-sm text-gray-600">{challenge.description}</p>
              <p className="mt-2">Type : <span className="font-semibold">{challenge.type === 'collective' ? 'Collectif' : 'Individuel'}</span></p>
              <p>Période : {challenge.start_date} → {challenge.end_date}</p>
              <p className="mt-2">
                Statut : <span className={`font-semibold ${
                  challenge.status === 'active' ? 'text-blue-600' :
                  challenge.status === 'completed' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {challenge.status === 'active' ? 'En cours' : challenge.status === 'completed' ? 'Réussi' : 'Échoué'}
                </span>
              </p>
              {challenge.ca_target && (
                <p className="mt-1">CA : {challenge.progress_ca?.toFixed(2) || 0}€ / {challenge.ca_target}€</p>
              )}
              {challenge.ventes_target && (
                <p>Ventes : {challenge.progress_ventes || 0} / {challenge.ventes_target}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
