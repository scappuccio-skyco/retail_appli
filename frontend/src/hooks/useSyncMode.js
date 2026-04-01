import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts';

/**
 * Hook pour vérifier le mode sync (Enterprise) et l'état de l'abonnement.
 *
 * @param {string} storeId - Optional store_id for gerant viewing as manager
 *
 * Retourne:
 * - syncMode: "manual" | "api_sync" | "scim_sync"
 * - isEnterprise: boolean
 * - isReadOnly: boolean (true si sync_mode != "manual" OU abonnement expiré)
 * - canEditKPIConfig: boolean
 * - canEditObjectives: boolean
 * - isSubscriptionExpired: boolean (true si subscriptionBlockCode !== null)
 * - subscriptionBlockCode: null | "TRIAL_EXPIRED" | "SUBSCRIPTION_INACTIVE"
 * - loading: boolean
 */
export const useSyncMode = (storeId = null) => {
  const { user } = useAuth();
  const [syncMode, setSyncMode] = useState('manual');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [companyName, setCompanyName] = useState(null);
  const [canEditKPI, setCanEditKPI] = useState(true);
  const [canEditObjectives, setCanEditObjectives] = useState(true);
  const [subscriptionBlockCode, setSubscriptionBlockCode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncMode = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const userRole = user.role || null;

      const urlParams = new URLSearchParams(globalThis.location.search);
      const effectiveStoreId = storeId || urlParams.get('store_id');
      const storeIdParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

      // Sync mode (manager/gerant only — sellers use manual by default)
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

      // Subscription status (seller + manager — gérant handles it independently)
      if (userRole === 'seller' || userRole === 'manager') {
        try {
          const endpoint = userRole === 'seller'
            ? '/seller/subscription-status'
            : `/manager/subscription-status${storeIdParam}`;

          const subResponse = await api.get(endpoint);
          const data = subResponse.data;

          if (data.isReadOnly) {
            // Use explicit blockCode when available (new API), fall back to status field
            const code = data.blockCode
              || (data.status === 'trial_expired' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_INACTIVE');
            setSubscriptionBlockCode(code);
          } else {
            setSubscriptionBlockCode(null);
          }
        } catch (error) {
          logger.error('Error fetching subscription status:', error);
          // Fallback: infer from 403 error_code if endpoint itself is blocked
          const code = error.response?.data?.error_code;
          if (code === 'TRIAL_EXPIRED' || code === 'SUBSCRIPTION_INACTIVE') {
            setSubscriptionBlockCode(code);
          }
        }
      } else if (userRole === 'gerant') {
        setSubscriptionBlockCode(null);
      }

      setLoading(false);
    };

    fetchSyncMode();
  }, [storeId, user]);

  const isSubscriptionExpired = subscriptionBlockCode !== null;
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
    subscriptionBlockCode,
    loading,
  };
};
