import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

const EMPTY_OBJECTIVE = { ca_target: '', indice_vente_target: '', panier_moyen_target: '', period_start: '', period_end: '' };
const EMPTY_CHALLENGE = { title: '', description: '', type: 'collective', seller_id: '', ca_target: '', ventes_target: '', indice_vente_target: '', panier_moyen_target: '', start_date: '', end_date: '' };

export default function useManagerSettingsPage() {
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newObjective, setNewObjective] = useState(EMPTY_OBJECTIVE);
  const [newChallenge, setNewChallenge] = useState(EMPTY_CHALLENGE);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [configRes, objectivesRes, challengesRes] = await Promise.all([
        api.get('/manager/kpi-config'),
        api.get('/manager/objectives'),
        api.get('/manager/challenges'),
      ]);
      logger.log('KPI Config loaded:', configRes.data);
      setKpiConfig(configRes.data);
      setObjectives(objectivesRes.data);
      setChallenges(challengesRes.data);
    } catch (err) {
      logger.error('Error loading data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const updateKPIConfig = async (field, value) => {
    try {
      const res = await api.put('/manager/kpi-config', { [field]: value });
      setKpiConfig(res.data);
      toast.success('Configuration mise à jour');
    } catch (err) {
      logger.error('Error updating config:', err);
      toast.error('Erreur de mise à jour');
    }
  };

  const createObjective = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ca_target: newObjective.ca_target ? Number.parseFloat(newObjective.ca_target) : null,
        indice_vente_target: newObjective.indice_vente_target ? Number.parseFloat(newObjective.indice_vente_target) : null,
        panier_moyen_target: newObjective.panier_moyen_target ? Number.parseFloat(newObjective.panier_moyen_target) : null,
        period_start: newObjective.period_start,
        period_end: newObjective.period_end,
      };
      await api.post('/manager/objectives', data);
      toast.success('Objectif créé');
      fetchData();
      setNewObjective(EMPTY_OBJECTIVE);
    } catch (err) {
      logger.error('Error creating objective:', err);
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
        ca_target: newChallenge.ca_target ? Number.parseFloat(newChallenge.ca_target) : null,
        ventes_target: newChallenge.ventes_target ? parseInt(newChallenge.ventes_target) : null,
        indice_vente_target: newChallenge.indice_vente_target ? Number.parseFloat(newChallenge.indice_vente_target) : null,
        panier_moyen_target: newChallenge.panier_moyen_target ? Number.parseFloat(newChallenge.panier_moyen_target) : null,
        start_date: newChallenge.start_date,
        end_date: newChallenge.end_date,
      };
      await api.post('/manager/challenges', data);
      toast.success('Challenge créé');
      fetchData();
      setNewChallenge(EMPTY_CHALLENGE);
    } catch (err) {
      logger.error('Error creating challenge:', err);
      toast.error('Erreur de création du challenge');
    }
  };

  return {
    loading, kpiConfig, objectives, challenges,
    newObjective, setNewObjective,
    newChallenge, setNewChallenge,
    updateKPIConfig, createObjective, createChallenge,
  };
}
