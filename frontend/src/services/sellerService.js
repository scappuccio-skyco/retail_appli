import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Service Vendeur — encapsule tous les appels /seller/* + debriefs + evaluations
 */
const sellerService = {
  // ─── KPI ────────────────────────────────────────────────────────────────────

  /** Vérifie si la saisie KPI est activée pour ce vendeur */
  getKpiEnabled: (storeId) => {
    const param = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/seller/kpi-enabled${param}`).then((r) => r.data);
  },

  /** Récupère la config KPI du vendeur */
  getKpiConfig: (storeId) => {
    const param = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/seller/kpi-config${param}`).then((r) => r.data);
  },

  /** Récupère les entrées KPI. days=null = tout, days=7/30/90/365 = filtre */
  getKpiEntries: (days) => {
    const param = days ? `?days=${days}` : '';
    return api.get(`/seller/kpi-entries${param}`).then((r) => toArray(r.data));
  },

  /** Soumet une entrée KPI journalière */
  createKpiEntry: (payload) =>
    api.post('/seller/kpi-entry', payload).then((r) => r.data),

  // ─── Objectifs & Challenges ─────────────────────────────────────────────────

  getActiveObjectives: () =>
    api.get('/seller/objectives/active').then((r) => toArray(r.data)),

  getObjectivesHistory: () =>
    api.get('/seller/objectives/history').then((r) => toArray(r.data)),

  getActiveChallenges: () =>
    api.get('/seller/challenges/active').then((r) => toArray(r.data)),

  getChallengesHistory: () =>
    api.get('/seller/challenges/history').then((r) => toArray(r.data)),

  // ─── Daily Challenge ─────────────────────────────────────────────────────────

  getDailyChallenge: () =>
    api.get('/seller/daily-challenge').then((r) => r.data),

  getDailyChallengeStats: () =>
    api.get('/seller/daily-challenge/stats').then((r) => r.data),

  getDailyChallengeHistory: () =>
    api.get('/seller/daily-challenge/history').then((r) => toArray(r.data)),

  completeDailyChallenge: (payload) =>
    api.post('/seller/daily-challenge/complete', payload).then((r) => r.data),

  refreshDailyChallenge: () =>
    api.post('/seller/daily-challenge/refresh', {}).then((r) => r.data),

  // ─── Diagnostic DISC ─────────────────────────────────────────────────────────

  getMyDiagnostic: () =>
    api.get('/seller/diagnostic/me').then((r) => r.data),

  getMyLiveScores: () =>
    api.get('/seller/diagnostic/me/live-scores').then((r) => r.data),

  submitDiagnostic: (payload) =>
    api.post('/seller/diagnostic', payload).then((r) => r.data),

  submitAiDiagnostic: (responses) =>
    api.post('/ai/diagnostic', responses).then((r) => r.data),

  // ─── Bilan individuel ────────────────────────────────────────────────────────

  getAllBilans: () =>
    api.get('/seller/bilan-individuel/all').then((r) => toArray(r.data)),

  // ─── Tâches ──────────────────────────────────────────────────────────────────

  getTasks: () =>
    api.get('/seller/tasks').then((r) => toArray(r.data)),

  // ─── Notes d'entretien ───────────────────────────────────────────────────────

  getInterviewNotes: () =>
    api.get('/seller/interview-notes').then((r) => toArray(r.data)),

  createInterviewNote: (payload) =>
    api.post('/seller/interview-notes', payload).then((r) => r.data),

  updateInterviewNote: (noteId, payload) =>
    api.put(`/seller/interview-notes/${noteId}`, payload).then((r) => r.data),

  deleteInterviewNote: (noteId) =>
    api.delete(`/seller/interview-notes/${noteId}`).then((r) => r.data),

  // ─── Abonnement ──────────────────────────────────────────────────────────────

  getSubscriptionStatus: () =>
    api.get('/seller/subscription-status').then((r) => r.data),

  // ─── Magasin ─────────────────────────────────────────────────────────────────

  getStoreInfo: (storeId) =>
    api.get(`/stores/${storeId}/info`).then((r) => r.data),
};

// ─── Debriefs (vendeur) ──────────────────────────────────────────────────────

export const debriefService = {
  getAll: () =>
    api.get('/debriefs').then((r) => toArray(r.data)),

  create: (payload) =>
    api.post('/debriefs', payload).then((r) => r.data),

  update: (debriefId, payload) =>
    api.patch(`/debriefs/${debriefId}`, payload).then((r) => r.data),

  delete: (debriefId) =>
    api.delete(`/debriefs/${debriefId}`).then((r) => r.data),

  generateCoaching: (debriefId) =>
    api.post(`/debriefs/${debriefId}/generate-coaching`).then((r) => r.data),

  generatePerformance: (debriefId) =>
    api.post(`/debriefs/${debriefId}/generate-performance`).then((r) => r.data),
};

// ─── Évaluations & Ventes (vendeur) ─────────────────────────────────────────

export const evaluationService = {
  getAll: () =>
    api.get('/evaluations').then((r) => toArray(r.data)),

  create: (payload) =>
    api.post('/evaluations', payload).then((r) => r.data),

  createSale: (payload) =>
    api.post('/sales', payload).then((r) => r.data),

  getSales: () =>
    api.get('/sales').then((r) => toArray(r.data)),

  // Note : OpportuniteManqueeForm et VenteConclueForm postent sur /debriefs
  // avec vente_conclue=false/true → utiliser debriefService.create()
};

export default sellerService;
