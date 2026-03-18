/**
 * API Helpers
 * Utility functions for API calls based on user role
 */

/**
 * Get API prefix based on user role
 * @param {string} role - User role ('seller', 'manager', 'gerant', etc.)
 * @returns {string} - API prefix ('/api/seller' or '/api/manager')
 */
export const getApiPrefixByRole = (role) => {
  if (role === 'seller') {
    return '/api/seller';
  }
  // manager, gerant, etc. use manager routes
  return '/api/manager';
};

const SUBSCRIPTION_MESSAGES = {
  TRIAL_EXPIRED: {
    gerant:  "Votre essai est terminé 🔒 Passez à un abonnement pour continuer à profiter des analyses IA.",
    manager: "Cette fonctionnalité est bloquée — l'essai est écoulé. Signalez-le à votre gérant pour débloquer l'accès ✨",
    seller:  "Votre période d'essai est terminée 🔒 Parlez-en à votre responsable pour rétablir l'accès.",
  },
  SUBSCRIPTION_INACTIVE: {
    gerant:  "Votre abonnement est suspendu 🔒 Réactivez-le depuis votre dashboard pour continuer.",
    manager: "Cette fonctionnalité est temporairement bloquée. Contactez votre gérant pour le réactiver.",
    seller:  "Cette fonctionnalité est temporairement bloquée. Contactez votre manager pour le réactiver.",
  },
};

/**
 * Return a user-friendly message for subscription-related 403 errors.
 * Returns null if the error is not a subscription block (caller should use its own fallback).
 * @param {Error} err - Axios error
 * @param {string} [role] - User role: 'gerant' | 'manager' | 'seller'
 * @returns {string|null}
 */
export const getSubscriptionErrorMessage = (err, role = 'seller') => {
  const code = err.response?.data?.error_code;
  const messages = SUBSCRIPTION_MESSAGES[code];
  if (!messages) return null;
  return messages[role] ?? messages.seller;
};

/**
 * Normalize history response (handles both array and wrapper formats)
 * @param {Object|Array} responseData - API response data
 * @returns {Array} - Normalized array of consultations
 */
export const normalizeHistoryResponse = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }
  if (responseData?.consultations) {
    return responseData.consultations;
  }
  return [];
};

