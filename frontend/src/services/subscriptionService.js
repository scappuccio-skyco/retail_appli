import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Service Abonnement Stripe — checkout, upgrade, downgrade, cancel, seats
 * Utilisé principalement par SubscriptionModal.js
 */
const subscriptionService = {
  // ─── Plans disponibles ───────────────────────────────────────────────────────

  getPlans: (endpoint) =>
    api.get(endpoint).then((r) => r.data),

  getAvailablePlans: (endpoint) =>
    api.get(endpoint).then((r) => r.data),

  // ─── Checkout ────────────────────────────────────────────────────────────────

  createCheckoutSession: (payload) =>
    api.post('/checkout/create-session', payload).then((r) => r.data),

  // ─── Abonnement courant ──────────────────────────────────────────────────────

  getStatus: (endpoint) =>
    api.get(endpoint).then((r) => r.data),

  getHistory: () =>
    api.get('/manager/subscription-history').then((r) => toArray(r.data)),

  // ─── Modifications ───────────────────────────────────────────────────────────

  upgrade: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  downgrade: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  cancel: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  reactivate: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  updateSeats: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  /** Appel générique POST vers n'importe quel endpoint subscription */
  post: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),
};

export default subscriptionService;
