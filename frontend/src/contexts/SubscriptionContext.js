import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * SubscriptionContext — source de vérité pour le statut d'abonnement.
 *
 * Ce contexte est "passif" : il stocke les données et expose un setter.
 * Chaque dashboard (gérant, manager, vendeur) le peuple via setSubscription()
 * après avoir récupéré les données (useSyncMode, useGerantDashboardData, etc.).
 *
 * Expose :
 *   subscription      — objet brut du statut d'abonnement (ou null)
 *   isReadOnly        — true si l'abonnement est expiré ou inactif
 *   isSubscriptionExpired — alias plus explicite
 *   syncMode          — 'manual' | 'api_sync' | 'scim_sync' (manager/seller)
 *   canEditKpiConfig  — booléen (false en mode enterprise)
 *   setSubscription() — peuple le contexte depuis n'importe quel composant
 *   reset()           — réinitialise (au logout)
 */

const SubscriptionContext = createContext(null);

const DEFAULT_STATE = {
  subscription: null,
  isReadOnly: false,
  isSubscriptionExpired: false,
  syncMode: 'manual',
  canEditKpiConfig: true,
  canEditObjectives: true,
  isEnterprise: false,
  companyName: null,
  status: null, // 'active' | 'trialing' | 'inactive' | 'canceled' | null
};

export function SubscriptionProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);

  /**
   * Peuple le contexte depuis useSyncMode (manager/seller).
   * @param {object} syncData - données retournées par useSyncMode
   */
  const setFromSyncMode = useCallback((syncData) => {
    if (!syncData) return;
    setState((prev) => ({
      ...prev,
      syncMode: syncData.syncMode ?? prev.syncMode,
      isReadOnly: syncData.isReadOnly ?? prev.isReadOnly,
      isSubscriptionExpired: syncData.isSubscriptionExpired ?? prev.isSubscriptionExpired,
      canEditKpiConfig: syncData.canEditKPIConfig ?? prev.canEditKpiConfig,
      canEditObjectives: syncData.canEditObjectives ?? prev.canEditObjectives,
      isEnterprise: syncData.isEnterprise ?? prev.isEnterprise,
      companyName: syncData.companyName ?? prev.companyName,
      status: syncData.parentSubscriptionStatus ?? prev.status,
    }));
  }, []);

  /**
   * Peuple le contexte depuis la réponse brute /gerant/subscription/status.
   * @param {object} subscriptionData - réponse de gerantService.getSubscriptionStatus()
   */
  const setFromGerant = useCallback((subscriptionData) => {
    if (!subscriptionData) return;

    const status = subscriptionData.status;
    let isExpired = true;

    if (status === 'active') {
      isExpired = false;
    } else if (status === 'trialing' && subscriptionData.trial_end) {
      isExpired = new Date(subscriptionData.trial_end) < new Date();
    }

    setState((prev) => ({
      ...prev,
      subscription: subscriptionData,
      status,
      isReadOnly: isExpired,
      isSubscriptionExpired: isExpired,
      // Gérant ne dépend pas du sync mode
      syncMode: 'manual',
      canEditKpiConfig: true,
      canEditObjectives: true,
    }));
  }, []);

  /**
   * Setter générique — utilisé si les deux helpers spécifiques ne conviennent pas.
   */
  const setSubscription = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /** Reset au logout */
  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const value = {
    ...state,
    setFromSyncMode,
    setFromGerant,
    setSubscription,
    reset,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook pour consommer SubscriptionContext.
 * @example
 *   const { isReadOnly, isSubscriptionExpired } = useSubscription();
 */
export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within a <SubscriptionProvider>');
  }
  return ctx;
}

export default SubscriptionContext;
