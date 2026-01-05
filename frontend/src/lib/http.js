/**
 * HTTP client centralisé (wrapper Axios)
 * Utilise API_BASE pour toutes les requêtes
 */
import axios from "axios";
import { API_BASE } from "./api";

// Créer une instance Axios configurée
const http = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false, // Les tokens sont dans localStorage, pas cookies
});

// Interceptor pour ajouter le token JWT depuis localStorage
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor pour gérer les erreurs globales
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Gérer les erreurs 401 (non authentifié)
    if (error.response?.status === 401) {
      // Optionnel : rediriger vers login si nécessaire
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default http;

