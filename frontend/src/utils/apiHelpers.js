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

