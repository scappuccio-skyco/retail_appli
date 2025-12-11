import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Décode le payload d'un JWT (sans vérification de signature)
 * @param {string} token - Le JWT token
 * @returns {object|null} - Le payload décodé ou null si erreur
 */
const decodeJWTPayload = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

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
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Décoder le JWT pour obtenir le rôle utilisateur
      const payload = decodeJWTPayload(token);
      const userRole = payload?.role || null;
      console.log('🔐 useSyncMode - Decoded role from JWT:', userRole);

      // Récupérer le mode sync (seulement pour les rôles qui en ont besoin)
      try {
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
      if (userRole === 'seller' || userRole === 'manager') {
        try {
          const endpoint = userRole === 'seller' 
            ? `${API}/seller/subscription-status`
            : `${API}/manager/subscription-status`;
          
          console.log('📡 useSyncMode - Fetching subscription status from:', endpoint);
          
          const subResponse = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('✅ useSyncMode - Subscription response:', subResponse.data);
          
          setParentSubscriptionStatus(subResponse.data.status);
          setIsSubscriptionExpired(subResponse.data.isReadOnly === true);
        } catch (error) {
          console.error('Error fetching subscription status:', error);
          // En cas d'erreur, on reste permissif (pas de blocage)
        }
      }
      
      setLoading(false);
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
