import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Service Gérant — encapsule tous les appels /gerant/* et /checkout/*
 */
const gerantService = {
  // ─── Magasins ────────────────────────────────────────────────────────────────

  getStores: () =>
    api.get('/gerant/stores').then((r) => toArray(r.data)),

  createStore: (payload) =>
    api.post('/gerant/stores', payload).then((r) => r.data),

  updateStore: (storeId, payload) =>
    api.put(`/gerant/stores/${storeId}`, payload).then((r) => r.data),

  deleteStore: (storeId) =>
    api.delete(`/gerant/stores/${storeId}`).then((r) => r.data),

  getStoreStats: (storeId, periodType, periodOffset) =>
    api
      .get(`/gerant/stores/${storeId}/stats?period_type=${periodType}&period_offset=${periodOffset}`)
      .then((r) => r.data),

  getStoreKpiHistory: (storeId, days) =>
    api.get(`/gerant/stores/${storeId}/kpi-history?days=${days}`).then((r) => r.data),

  getStoreAvailableYears: (storeId) =>
    api.get(`/gerant/stores/${storeId}/available-years`).then((r) => toArray(r.data)),

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  getDashboardStats: () =>
    api.get('/gerant/dashboard/stats').then((r) => r.data),

  // ─── Staff ───────────────────────────────────────────────────────────────────

  getManagers: () =>
    api.get('/gerant/managers').then((r) => toArray(r.data)),

  getSellers: () =>
    api.get('/gerant/sellers').then((r) => toArray(r.data)),

  getInvitations: () =>
    api.get('/gerant/invitations').then((r) => toArray(r.data)).catch(() => []),

  createInvitation: (payload) =>
    api.post('/gerant/invitations', payload).then((r) => r.data),

  resendInvitation: (invitationId) =>
    api.post(`/gerant/invitations/${invitationId}/resend`, {}).then((r) => r.data),

  deleteInvitation: (invitationId) =>
    api.delete(`/gerant/invitations/${invitationId}`).then((r) => r.data),

  updateStaff: (userId, payload) =>
    api.put(`/gerant/staff/${userId}`, payload).then((r) => r.data),

  /** Action sur un manager : archive | restore | delete */
  patchManager: (managerId, action) =>
    api.patch(`/gerant/managers/${managerId}/${action}`, {}).then((r) => r.data),

  /** Action sur un vendeur : archive | restore | delete */
  patchSeller: (sellerId, action) =>
    api.patch(`/gerant/sellers/${sellerId}/${action}`, {}).then((r) => r.data),

  deleteSeller: (sellerId) =>
    api.delete(`/gerant/sellers/${sellerId}`).then((r) => r.data),

  transferManager: (managerId, newStoreId) =>
    api.post(`/gerant/managers/${managerId}/transfer`, { new_store_id: newStoreId }).then((r) => r.data),

  transferSeller: (sellerId, newStoreId) =>
    api.post(`/gerant/sellers/${sellerId}/transfer`, { new_store_id: newStoreId }).then((r) => r.data),

  // ─── Profil Gérant ───────────────────────────────────────────────────────────

  getProfile: () =>
    api.get('/gerant/profile').then((r) => r.data),

  updateProfile: (payload) =>
    api.put('/gerant/profile', payload).then((r) => r.data),

  changePassword: (payload) =>
    api.put('/gerant/profile/change-password', payload).then((r) => r.data),

  // ─── Profil de facturation ───────────────────────────────────────────────────

  getBillingProfile: () =>
    api.get('/gerant/billing-profile').then((r) => r.data),

  updateBillingProfile: (payload) =>
    api.post('/gerant/billing-profile', payload).then((r) => r.data),

  // ─── Abonnement ──────────────────────────────────────────────────────────────

  getSubscriptionStatus: () =>
    api.get('/gerant/subscription/status').then((r) => r.data),

  // ─── Clés API ────────────────────────────────────────────────────────────────

  getApiKeys: () =>
    api.get('/gerant/api-keys').then((r) => toArray(r.data)),

  createApiKey: (payload) =>
    api.post('/gerant/api-keys', payload).then((r) => r.data),

  deleteApiKey: (keyId) =>
    api.delete(`/gerant/api-keys/${keyId}`).then((r) => r.data),

  permanentDeleteApiKey: (keyId) =>
    api.delete(`/gerant/api-keys/${keyId}/permanent`).then((r) => r.data),

  // ─── Checkout / Stripe ───────────────────────────────────────────────────────

  getCheckoutStatus: (sessionId) =>
    api.get(`/checkout/status/${sessionId}`).then((r) => r.data),
};

export default gerantService;
