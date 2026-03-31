/**
 * API Client unifié
 * Remplace tous les appels axios dispersés
 * 
 * Usage:
 *   import { api } from '../lib/apiClient';
 *   const response = await api.get('/manager/objectives');
 */
import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE } from './api';
import { logger } from '../utils/logger';

/** Évite d'afficher plusieurs toasts du même type en rafale (requêtes parallèles). */
let last403ToastAt = 0;
let last429ToastAt = 0;
let last5xxToastAt = 0;
let lastNetworkToastAt = 0;
const DEDUP_MS = 5000; // 5 s entre deux toasts du même type
const SUBSCRIPTION_INACTIVE_SHOWN_KEY = 'apiClient_subscription_inactive_toast_shown';

/**
 * Nettoie l'URL pour éviter les doubles /api/api/
 * @param {string} url - URL à nettoyer
 * @returns {string} URL nettoyée
 */
function cleanUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  let cleaned = url;
  
  // Si contient /api/api/, corriger
  if (cleaned.includes('/api/api/')) {
    cleaned = cleaned.replace(/\/api\/api\//g, '/api/');
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`[apiClient] URL corrigée (double /api/api/): ${url} -> ${cleaned}`);
    }
  }
  
  // Si commence par /api/, enlever le préfixe
  if (cleaned.startsWith('/api/')) {
    cleaned = cleaned.substring(4); // Enlever '/api'
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`[apiClient] Préfixe /api/ retiré: ${url} -> ${cleaned}`);
    }
  }
  
  // S'assurer que l'URL commence par /
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  
  return cleaned;
}

// Instance axios configurée
const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
  // withCredentials: true is required to send/receive httpOnly cookies (JWT auth)
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor URL protection (double /api/api/ guard)
apiClient.interceptors.request.use((config) => {
  if (config.url) {
    const originalUrl = config.url;
    config.url = cleanUrl(config.url);
    if (config.url !== originalUrl && process.env.NODE_ENV === 'development') {
      logger.warn(`[apiClient] URL corrigée dans interceptor: ${originalUrl} -> ${config.url}`);
    }
  }
  return config;
});

// Interceptor pour erreurs globales
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Requête annulée volontairement (AbortController) — ne pas afficher de toast
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    // Log en dev seulement
    if (process.env.NODE_ENV === 'development') {
      logger.error('API Error:', error.response?.data || error.message);
    }

    // Gestion erreurs 401 (session expirée)
    // /auth/me est le check de démarrage : on ne redirige pas, AuthContext gère l'état
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      if (!requestUrl.includes('/auth/me')) {
        globalThis.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Gestion 403 : afficher une fois un message clair (abonnement ou accès refusé)
    if (error.response?.status === 403) {
      const data = error.response?.data || {};
      const detail = typeof data.detail === 'string' ? data.detail : 'Accès refusé';
      const code = data.error_code;
      const now = Date.now();
      const isSubscriptionIssue = code === 'SUBSCRIPTION_INACTIVE' || code === 'TRIAL_EXPIRED';
      const isDemoReadOnly = code === 'DEMO_READ_ONLY';
      const alreadyShownSubscription = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SUBSCRIPTION_INACTIVE_SHOWN_KEY) === '1';

      if (isDemoReadOnly) {
        if (now - last403ToastAt > 3000) {
          last403ToastAt = now;
          toast.info('Fonctionnalité disponible après inscription', {
            description: 'Créez un compte pour accéder à toutes les fonctionnalités en temps réel.',
            duration: 5000,
            icon: '✨',
          });
        }
      } else if (isSubscriptionIssue && !alreadyShownSubscription) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SUBSCRIPTION_INACTIVE_SHOWN_KEY, '1');
        const description = code === 'TRIAL_EXPIRED'
          ? 'La période d\'essai est terminée. Le gérant peut souscrire depuis son tableau de bord.'
          : 'L\'abonnement a expiré. Le gérant peut le renouveler depuis son tableau de bord.';
        toast.error(detail, { description, duration: 8000 });
      } else if (!isSubscriptionIssue && now - last403ToastAt > 3000) {
        last403ToastAt = now;
        toast.error(detail, { duration: 5000 });
      }
    }

    // 429 — Rate limit
    if (error.response?.status === 429) {
      const now = Date.now();
      if (now - last429ToastAt > DEDUP_MS) {
        last429ToastAt = now;
        const retryAfter = error.response.headers?.['retry-after'];
        toast.warning(
          retryAfter
            ? `Trop de requêtes. Réessayez dans ${retryAfter}s.`
            : 'Trop de requêtes. Veuillez patienter quelques secondes.',
          { duration: 5000, icon: '⏳' }
        );
      }
    }

    // 5xx — Erreur serveur
    if (error.response?.status >= 500) {
      const now = Date.now();
      if (now - last5xxToastAt > DEDUP_MS) {
        last5xxToastAt = now;
        toast.error('Erreur serveur. Veuillez réessayer.', {
          duration: 6000,
          description: process.env.NODE_ENV === 'development'
            ? `${error.response.status} — ${error.response?.data?.detail || error.message}`
            : undefined,
        });
      }
    }

    // Réseau hors ligne (pas de réponse HTTP)
    if (!error.response && error.request) {
      const now = Date.now();
      if (now - lastNetworkToastAt > DEDUP_MS) {
        lastNetworkToastAt = now;
        toast.error('Impossible de joindre le serveur. Vérifiez votre connexion.', {
          duration: 6000,
          icon: '📡',
        });
      }
    }

    return Promise.reject(error);
  }
);

// Helpers pour méthodes courantes avec protection URL
export const api = {
  get: (url, config) => {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl !== url && process.env.NODE_ENV === 'development') {
      logger.warn(`[api.get] URL corrigée: ${url} -> ${cleanedUrl}`);
    }
    return apiClient.get(cleanedUrl, config);
  },
  post: (url, data, config) => {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl !== url && process.env.NODE_ENV === 'development') {
      logger.warn(`[api.post] URL corrigée: ${url} -> ${cleanedUrl}`);
    }
    return apiClient.post(cleanedUrl, data, config);
  },
  put: (url, data, config) => {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl !== url && process.env.NODE_ENV === 'development') {
      logger.warn(`[api.put] URL corrigée: ${url} -> ${cleanedUrl}`);
    }
    return apiClient.put(cleanedUrl, data, config);
  },
  patch: (url, data, config) => {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl !== url && process.env.NODE_ENV === 'development') {
      logger.warn(`[api.patch] URL corrigée: ${url} -> ${cleanedUrl}`);
    }
    return apiClient.patch(cleanedUrl, data, config);
  },
  delete: (url, config) => {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl !== url && process.env.NODE_ENV === 'development') {
      logger.warn(`[api.delete] URL corrigée: ${url} -> ${cleanedUrl}`);
    }
    return apiClient.delete(cleanedUrl, config);
  },
  
  // Helpers spécialisés
  getBlob: (url, config) => {
    const cleanedUrl = cleanUrl(url);
    return apiClient.get(cleanedUrl, { ...config, responseType: 'blob' });
  },
  postFormData: (url, data, config) => {
    const cleanedUrl = cleanUrl(url);
    return apiClient.post(cleanedUrl, data, { 
      ...config, 
      headers: { 'Content-Type': 'multipart/form-data' } 
    });
  },
};

export default apiClient;

