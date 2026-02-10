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

/** Évite d'afficher plusieurs toasts 403 d'affilée (plusieurs requêtes en parallèle). */
let last403ToastAt = 0;
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
  // Note: withCredentials is NOT needed since we use Authorization Bearer token
  // withCredentials: true would require stricter CORS configuration
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor pour auth (centralisé) + protection URL
apiClient.interceptors.request.use((config) => {
  // Protection: nettoyer l'URL si elle contient /api/api/
  if (config.url) {
    const originalUrl = config.url;
    config.url = cleanUrl(config.url);
    if (config.url !== originalUrl && process.env.NODE_ENV === 'development') {
      logger.warn(`[apiClient] URL corrigée dans interceptor: ${originalUrl} -> ${config.url}`);
    }
  }
  
  // Ajouter token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor pour erreurs globales
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log en dev seulement
    if (process.env.NODE_ENV === 'development') {
      logger.error('API Error:', error.response?.data || error.message);
    }

    // Gestion erreurs 401 (logout)
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      globalThis.location.href = '/login';
      return Promise.reject(error);
    }

    // Gestion 403 : afficher une fois un message clair (abonnement ou accès refusé)
    if (error.response?.status === 403) {
      const data = error.response?.data || {};
      const detail = typeof data.detail === 'string' ? data.detail : 'Accès refusé';
      const code = data.error_code;
      const now = Date.now();
      const isSubscriptionInactive = code === 'SUBSCRIPTION_INACTIVE';
      const alreadyShownSubscription = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SUBSCRIPTION_INACTIVE_SHOWN_KEY) === '1';

      if (isSubscriptionInactive && !alreadyShownSubscription) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SUBSCRIPTION_INACTIVE_SHOWN_KEY, '1');
        toast.error(detail, {
          description: 'Le gérant peut réactiver l\'abonnement depuis son tableau de bord.',
          duration: 8000,
        });
      } else if (!isSubscriptionInactive && now - last403ToastAt > 3000) {
        last403ToastAt = now;
        toast.error(detail, { duration: 5000 });
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

