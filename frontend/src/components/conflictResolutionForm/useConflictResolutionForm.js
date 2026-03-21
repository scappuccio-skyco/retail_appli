import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage, getApiPrefixByRole, normalizeHistoryResponse } from '../../utils/apiHelpers';
import { useAuth } from '../../contexts';

const EMPTY_FORM = {
  contexte: '',
  comportement_observe: '',
  impact: '',
  tentatives_precedentes: '',
  description_libre: '',
};

export default function useConflictResolutionForm({ sellerId }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [conflictHistory, setConflictHistory] = useState([]);
  const [expandedHistoryItems, setExpandedHistoryItems] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchConflictHistory();
  }, [sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchConflictHistory = async () => {
    setLoadingHistory(true);
    try {
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);
      const url = userRole === 'seller'
        ? `${apiPrefix}/conflict-history`
        : `${apiPrefix}/conflict-history/${sellerId}`;
      const response = await api.get(url);
      setConflictHistory(normalizeHistoryResponse(response.data));
    } catch (err) {
      logger.error('Error loading conflict history:', err);
      toast.error("Erreur de chargement de l'historique");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contexte || !formData.comportement_observe || !formData.impact) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setShowForm(false);
    setLoading(true);
    const loadingToast = toast.loading('🤖 Génération des recommandations IA...');
    try {
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);
      const payload = userRole === 'seller' ? formData : { seller_id: sellerId, ...formData };
      const response = await api.post(`${apiPrefix}/conflict-resolution`, payload);
      toast.dismiss(loadingToast);
      toast.success('Recommandations générées avec succès');
      setTimeout(() => {
        setAiRecommendations(response.data);
        fetchConflictHistory();
      }, 500);
      setFormData(EMPTY_FORM);
    } catch (err) {
      logger.error('Error creating conflict resolution:', err);
      toast.dismiss(loadingToast);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de la génération des recommandations');
    } finally {
      setLoading(false);
    }
  };

  const toggleHistoryItem = (id) => {
    setExpandedHistoryItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBack = () => {
    setShowForm(false);
    setAiRecommendations(null);
  };

  return {
    formData, loading, aiRecommendations,
    conflictHistory, expandedHistoryItems, loadingHistory,
    showForm, setShowForm,
    handleChange, handleSubmit, toggleHistoryItem, handleBack,
  };
}
