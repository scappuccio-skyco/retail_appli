import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Hook pour vérifier si l'utilisateur est en mode synchronisation automatique (Enterprise).
 * 
 * Retourne:
 * - syncMode: "manual" | "api_sync" | "scim_sync"
 * - isEnterprise: boolean
 * - isReadOnly: boolean (true si sync_mode != "manual")
 * - canEditKPIConfig: boolean (false en mode entreprise)
 * - canEditObjectives: boolean (true même en mode entreprise)
 * - loading: boolean
 */
export const useSyncMode = () => {
  const [syncMode, setSyncMode] = useState('manual');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [companyName, setCompanyName] = useState(null);
  const [canEditKPI, setCanEditKPI] = useState(true);
  const [canEditObjectives, setCanEditObjectives] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncMode = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API}/manager/sync-mode`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setSyncMode(response.data.sync_mode || 'manual');
        setIsEnterprise(response.data.is_enterprise || false);
        setCompanyName(response.data.company_name || null);
        setCanEditKPI(response.data.can_edit_kpi !== false);
        setCanEditObjectives(response.data.can_edit_objectives !== false);
      } catch (error) {
        console.error('Error fetching sync mode:', error);
        // Par défaut, mode manuel si erreur
        setSyncMode('manual');
        setIsEnterprise(false);
        setCanEditKPI(true);
        setCanEditObjectives(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSyncMode();
  }, []);

  const isReadOnly = syncMode !== 'manual';

  return {
    syncMode,
    isEnterprise,
    companyName,
    isReadOnly,
    canEditKPI,
    canEditKPIConfig: canEditKPI,
    canEditObjectives,
    loading
  };
};
