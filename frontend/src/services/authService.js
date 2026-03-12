import { api } from '../lib/apiClient';

/**
 * Normalise une réponse paginée ou tableau brut en tableau.
 * @param {*} data
 * @returns {Array}
 */
const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

const authService = {
  /** Récupère l'utilisateur connecté */
  getMe: () => api.get('/auth/me').then((r) => r.data),

  /** Connexion — retourne { access_token, token_type } */
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  /** Déconnexion côté serveur (si endpoint existe) */
  logout: () => api.post('/auth/logout').then((r) => r.data).catch(() => null),

  /** Vérifie si le diagnostic vendeur est complété */
  getSellerDiagnosticStatus: () =>
    api.get('/seller/diagnostic/me').then((r) => r.data).catch(() => null),
};

export { toArray };
export default authService;
