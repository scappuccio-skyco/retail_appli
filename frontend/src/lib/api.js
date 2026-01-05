/**
 * Centralized API configuration
 * Point de vérité pour l'URL du backend API
 */

/**
 * Base URL de l'API backend
 * Utilise la variable d'environnement REACT_APP_BACKEND_URL
 * Fallback par défaut vers le nouveau domaine API
 */
export const API_BASE = process.env.REACT_APP_BACKEND_URL || "https://api.retailperformerai.com";

/**
 * Construit l'URL complète pour un endpoint API
 * @param {string} path - Chemin de l'endpoint (ex: "/auth/login" ou "/api/auth/login")
 * @returns {string} URL complète
 */
export function getApiUrl(path) {
  // Si le path commence déjà par http, retourner tel quel
  if (path.startsWith("http")) {
    return path;
  }
  
  // Si le path commence par /api, l'utiliser directement
  if (path.startsWith("/api")) {
    return `${API_BASE}${path}`;
  }
  
  // Sinon, ajouter /api
  return `${API_BASE}/api${path.startsWith("/") ? path : `/${path}`}`;
}

