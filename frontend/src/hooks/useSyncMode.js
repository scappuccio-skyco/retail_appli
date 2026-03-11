import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts';

/**
 * Hook pour vérifier si l'utilisateur est en mode synchronisation automatique (Enterprise)
 * ET si l'abonnement du gérant parent est actif.
 * 
 * @param {string} storeId - Optional store_id for gerant viewing as manager
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
export const useSyncMode = (storeId = null) => {
  const { user } = useAuth();
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
      if (!user) {
        setLoading(false);
        return;
      }

      const userRole = user.role || null;
      
      // Get store_id from URL if not passed as prop (for gerant viewing as manager)
      const urlParams = new URLSearchParams(globalThis.location.search);
      const effectiveStoreId = storeId || urlParams.get('store_id');
      const storeIdParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

      // Récupérer le mode sync (manager/gerant uniquement ; les vendeurs n'ont pas accès à /manager/sync-mode → 403)
      if (userRole === 'seller') {
        setSyncMode('manual');
        setIsEnterprise(false);
        setCanEditKPI(true);
        setCanEditObjectives(true);
      } else {
        try {
          const response = await api.get(`/manager/sync-mode${storeIdParam}`);
          setSyncMode(response.data.sync_mode || 'manual');
          setIsEnterprise(response.data.is_enterprise || false);
          setCompanyName(response.data.company_name || null);
          setCanEditKPI(response.data.can_edit_kpi !== false);
          setCanEditObjectives(response.data.can_edit_objectives !== false);
        } catch (error) {
          logger.error('Error fetching sync mode:', error);
          setSyncMode('manual');
          setIsEnterprise(false);
          setCanEditKPI(true);
          setCanEditObjectives(true);
        }
      }

      // Vérifier le statut de l'abonnement du gérant parent (pour vendeurs/managers)
      // Skip for gerant role viewing manager dashboard
      if (userRole === 'seller' || userRole === 'manager') {
        try {
          const endpoint = userRole === 'seller' 
            ? `/seller/subscription-status`
            : `/manager/subscription-status${storeIdParam}`;
          
          const subResponse = await api.get(endpoint);
          
          setParentSubscriptionStatus(subResponse.data.status);
          setIsSubscriptionExpired(subResponse.data.isReadOnly === true);
        } catch (error) {
          logger.error('Error fetching subscription status:', error);
          // En cas d'erreur, on reste permissif (pas de blocage)
        }
      } else if (userRole === 'gerant' || userRole === 'gérant') {
        // Gérant viewing as manager - check their own subscription but don't block
        setIsSubscriptionExpired(false);
        setParentSubscriptionStatus('active');
      }
      
      setLoading(false);
    };

    fetchSyncMode();
  }, [storeId, user]);

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
