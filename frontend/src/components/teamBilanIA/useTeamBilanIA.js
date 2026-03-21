import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage } from '../../utils/apiHelpers';
import { useAuth } from '../../contexts';

export default function useTeamBilanIA() {
  const { user } = useAuth();
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showDataSources, setShowDataSources] = useState(false);

  useEffect(() => { fetchBilan(); }, []);

  const fetchBilan = async () => {
    try {
      const res = await api.get('/manager/team-bilan/latest');
      if (res.data.status === 'success') setBilan(res.data.bilan);
    } catch (err) {
      logger.error('Error fetching bilan:', err);
    }
  };

  const generateNewBilan = async () => {
    setLoading(true);
    try {
      const res = await api.post('/manager/team-bilan');
      setBilan(res.data);
      toast.success('Bilan IA généré ! 🤖');
    } catch (err) {
      logger.error('Error generating bilan:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de la génération du bilan');
    } finally {
      setLoading(false);
    }
  };

  return { bilan, loading, expanded, setExpanded, showDataSources, setShowDataSources, generateNewBilan };
}
