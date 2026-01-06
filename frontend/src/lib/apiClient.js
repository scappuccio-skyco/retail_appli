/**
 * API Client unifié
 * Remplace tous les appels axios dispersés
 * 
 * Usage:
 *   import { api } from '../lib/apiClient';
 *   const response = await api.get('/manager/objectives');
 */
import axios from 'axios';
import { API_BASE } from './api';
import { logger } from '../utils/logger';

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
      window.location.href = '/login';
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

