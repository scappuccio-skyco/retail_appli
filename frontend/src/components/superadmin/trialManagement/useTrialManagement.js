import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';
import { toast } from 'sonner';

const normalizeGerantsResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.gerants)) return data.gerants;
  return [];
};

export function calculateDaysRemaining(trialEnd) {
  if (!trialEnd) return null;
  const end = new Date(trialEnd);
  const now = new Date();
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let diff = Math.floor((endDate - nowDate) / (1000 * 60 * 60 * 24));
  if (diff === 0 && end >= now) diff = 1;
  return diff;
}

export function getGerantStatus(gerant) {
  if (gerant.subscription_status === 'active') return 'subscribed';
  if (gerant.subscription_status === 'trialing') {
    const daysRemaining = gerant.days_left !== undefined ? gerant.days_left : calculateDaysRemaining(gerant.trial_end);
    if (daysRemaining === null || daysRemaining < 0) return 'expired';
    if (daysRemaining <= 7) return 'expiring_soon';
    return 'active_trial';
  }
  if (!gerant.trial_end) return 'no_trial';
  const daysRemaining = calculateDaysRemaining(gerant.trial_end);
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'expiring_soon';
  return 'active_trial';
}

export default function useTrialManagement({ onTrialUpdated }) {
  const [gerants, setGerants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTrial, setEditingTrial] = useState(null);
  const [newTrialEnd, setNewTrialEnd] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { fetchGerants(); }, []);

  const fetchGerants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/gerants/trials');
      setGerants(normalizeGerantsResponse(response.data));
    } catch (error) {
      logger.error('Error fetching gerants:', error);
      toast.error('Erreur lors du chargement des gérants');
      setGerants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTrial = async (gerantId) => {
    if (!newTrialEnd) { toast.error('Veuillez sélectionner une date'); return; }
    try {
      const trialEndISO = new Date(newTrialEnd + 'T23:59:59.999Z').toISOString();
      await api.patch(`/superadmin/gerants/${gerantId}/trial`, { trial_end: trialEndISO });
      toast.success("Période d'essai mise à jour avec succès");
      setEditingTrial(null);
      setNewTrialEnd('');
      await fetchGerants();
      setRefreshKey(prev => prev + 1);
      if (onTrialUpdated) setTimeout(() => onTrialUpdated(), 500);
    } catch (error) {
      logger.error('Error updating trial:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const gerantList = Array.isArray(gerants) ? gerants : [];

  const filteredGerants = gerantList.filter(g => {
    const matchesSearch = g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'all') return matchesSearch;
    const status = getGerantStatus(g);
    switch (statusFilter) {
      case 'active_trial': return matchesSearch && (status === 'active_trial' || status === 'expiring_soon');
      case 'expiring_soon': return matchesSearch && status === 'expiring_soon';
      case 'expired': return matchesSearch && status === 'expired';
      case 'no_trial': return matchesSearch && status === 'no_trial';
      case 'subscribed': return matchesSearch && status === 'subscribed';
      default: return matchesSearch;
    }
  });

  const statusCounts = {
    all: gerantList.length,
    active_trial: gerantList.filter(g => { const s = getGerantStatus(g); return s === 'active_trial' || s === 'expiring_soon'; }).length,
    expiring_soon: gerantList.filter(g => getGerantStatus(g) === 'expiring_soon').length,
    expired: gerantList.filter(g => getGerantStatus(g) === 'expired').length,
    no_trial: gerantList.filter(g => getGerantStatus(g) === 'no_trial').length,
    subscribed: gerantList.filter(g => getGerantStatus(g) === 'subscribed').length,
  };

  return {
    loading, refreshKey,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    filteredGerants, statusCounts,
    editingTrial, setEditingTrial,
    newTrialEnd, setNewTrialEnd,
    handleUpdateTrial,
  };
}
