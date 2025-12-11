import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Hook pour vérifier si l'utilisateur est en mode synchronisation automatique (Enterprise)
 * ET si l'abonnement du gérant parent est actif.
 * 
 * Retourne:
 * - syncMode: "manual" | "api_sync" | "scim_sync"
 * - isEnterprise: boolean
 * - isReadOnly: boolean (true si sync_mode != "manual" OU abonnement expiré)
 * - canEditKPIConfig: boolean (false en mode entreprise)
 * - canEditObjectives: boolean (true même en mode entreprise)
 * - isSubscriptionExpired: boolean (true si l'abonnement du gérant parent est expiré)
 * - loading: boolean
 */
export const useSyncMode = () => {
  const [syncMode, setSyncMode] = useState('manual');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [companyName, setCompanyName] = useState(null);
  const [canEditKPI, setCanEditKPI] = useState(true);
  const [canEditObjectives, setCanEditObjectives] = useState(true);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);
  const [parentSubscriptionStatus, setParentSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncMode = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Récupérer le mode sync
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
        setSyncMode('manual');
        setIsEnterprise(false);
        setCanEditKPI(true);
        setCanEditObjectives(true);
      }

      // Vérifier le statut de l'abonnement du gérant parent (pour vendeurs/managers)
      try {
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');
        
        if (token && (userRole === 'seller' || userRole === 'manager')) {
          const endpoint = userRole === 'seller' 
            ? `${API}/seller/subscription-status`
            : `${API}/manager/subscription-status`;
          
          const subResponse = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setParentSubscriptionStatus(subResponse.data.status);
          setIsSubscriptionExpired(subResponse.data.isReadOnly === true);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
        // En cas d'erreur, on reste permissif (pas de blocage)
      } finally {
        setLoading(false);
      }
    };

    fetchSyncMode();
  }, []);

  // isReadOnly est true si :
  // 1. Mode sync != manual (Enterprise)
  // 2. OU l'abonnement du gérant parent est expiré
  const isReadOnly = syncMode !== 'manual' || isSubscriptionExpired;

  return {
    syncMode,
    isEnterprise,
    companyName,
    isReadOnly,
    canEditKPI,
    canEditKPIConfig: canEditKPI,
    canEditObjectives,
    isSubscriptionExpired,
    parentSubscriptionStatus,
    loading
  };
};
