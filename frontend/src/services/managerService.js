import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Construit le paramètre ?store_id=X ou '' si absent.
 * @param {string|null} storeId
 * @param {boolean} isFirst - true si c'est le premier param (préfixe '?'), false pour '&'
 */
const storeParam = (storeId, isFirst = true) =>
  storeId ? `${isFirst ? '?' : '&'}store_id=${storeId}` : '';

/**
 * Service Manager — encapsule tous les appels /manager/* et /manager-diagnostic/*
 */
const managerService = {
  // ─── Équipe ──────────────────────────────────────────────────────────────────

  getSellers: (storeId) =>
    api.get(`/manager/sellers${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getArchivedSellers: (storeId) =>
    api.get(`/manager/sellers/archived${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getInvitations: (storeId) =>
    api.get(`/manager/invitations${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getSellerStats: (sellerId, storeId) =>
    api.get(`/manager/seller/${sellerId}/stats${storeParam(storeId)}`).then((r) => r.data),

  getSellerDiagnostic: (sellerId, storeId) =>
    api.get(`/manager/seller/${sellerId}/diagnostic${storeParam(storeId)}`).then((r) => r.data),

  getSellerDebriefs: (sellerId, storeId) =>
    api.get(`/manager/debriefs/${sellerId}${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getSellerCompetencesHistory: (sellerId, storeId) =>
    api.get(`/manager/competences-history/${sellerId}${storeParam(storeId)}`).then((r) => toArray(r.data)),

  // ─── KPI Manager ─────────────────────────────────────────────────────────────

  getKpiConfig: (storeId) =>
    api.get(`/manager/kpi-config${storeParam(storeId)}`).then((r) => r.data),

  updateKpiConfig: (payload, storeId) =>
    api.put(`/manager/kpi-config${storeParam(storeId)}`, payload).then((r) => r.data),

  getStoreKpiStats: (storeId) =>
    api.get(`/manager/store-kpi/stats${storeParam(storeId)}`).then((r) => r.data),

  createStoreKpi: (payload) =>
    api.post('/manager/store-kpi', payload).then((r) => r.data),

  createManagerKpi: (payload, storeId) =>
    api.post(`/manager/manager-kpi${storeParam(storeId)}`, payload).then((r) => r.data),

  getSellerKpiEntries: (sellerId, days, storeId) => {
    const dayParam = days ? `days=${days}` : '';
    const storeP = storeId ? `store_id=${storeId}` : '';
    const query = [dayParam, storeP].filter(Boolean).join('&');
    return api.get(`/manager/kpi-entries/${sellerId}${query ? `?${query}` : ''}`).then((r) => toArray(r.data));
  },

  getDatesWithData: (storeId) =>
    api.get(`/manager/dates-with-data${storeParam(storeId)}`).then((r) => r.data),

  getKpiEnabled: (storeId) =>
    api.get(`/seller/kpi-enabled${storeParam(storeId)}`).then((r) => r.data),

  // ─── Objectifs ───────────────────────────────────────────────────────────────

  getActiveObjectives: (storeId) =>
    api.get(`/manager/objectives/active${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getObjectives: (storeId) =>
    api.get(`/manager/objectives${storeParam(storeId)}`).then((r) => toArray(r.data)),

  createObjective: (payload, storeId) =>
    api.post(`/manager/objectives${storeParam(storeId)}`, payload).then((r) => r.data),

  updateObjective: (objectiveId, payload, storeId) =>
    api.put(`/manager/objectives/${objectiveId}${storeParam(storeId)}`, payload).then((r) => r.data),

  deleteObjective: (objectiveId, storeId) =>
    api.delete(`/manager/objectives/${objectiveId}${storeParam(storeId)}`).then((r) => r.data),

  updateObjectiveProgress: (objectiveId, value, storeId) =>
    api
      .post(`/manager/objectives/${objectiveId}/progress${storeParam(storeId)}`, {
        current_value: Number.parseFloat(value),
        mode: 'add',
      })
      .then((r) => r.data),

  // ─── Challenges ──────────────────────────────────────────────────────────────

  getActiveChallenges: (storeId) =>
    api.get(`/manager/challenges/active${storeParam(storeId)}`).then((r) => toArray(r.data)),

  getChallenges: (storeId) =>
    api.get(`/manager/challenges${storeParam(storeId)}`).then((r) => toArray(r.data)),

  createChallenge: (payload, storeId) =>
    api.post(`/manager/challenges${storeParam(storeId)}`, payload).then((r) => r.data),

  updateChallenge: (challengeId, payload, storeId) =>
    api.put(`/manager/challenges/${challengeId}${storeParam(storeId)}`, payload).then((r) => r.data),

  deleteChallenge: (challengeId, storeId) =>
    api.delete(`/manager/challenges/${challengeId}${storeParam(storeId)}`).then((r) => r.data),

  updateChallengeProgress: (challengeId, value, mode = 'add', storeId) =>
    api
      .post(`/manager/challenges/${challengeId}/progress${storeParam(storeId)}`, {
        current_value: Number.parseFloat(value),
        mode,
      })
      .then((r) => r.data),

  // ─── Bilan IA équipe ─────────────────────────────────────────────────────────

  getLatestTeamBilan: () =>
    api.get('/manager/team-bilan/latest').then((r) => r.data),

  generateTeamBilan: (startDate, endDate) =>
    api
      .post(`/manager/team-bilan?start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.data),

  getAllTeamBilans: (storeId) =>
    api.get(`/manager/team-bilans/all${storeParam(storeId)}`).then((r) => toArray(r.data)),

  // ─── Analyses IA équipe ──────────────────────────────────────────────────────

  getTeamAnalysesHistory: (storeId) =>
    api.get(`/manager/team-analyses-history${storeParam(storeId)}`).then((r) => toArray(r.data)),

  deleteTeamAnalysis: (analysisId, storeId) =>
    api.delete(`/manager/team-analysis/${analysisId}${storeParam(storeId)}`).then((r) => r.data),

  analyzeTeam: (storeId) =>
    api.post(`/manager/analyze-team${storeParam(storeId)}`).then((r) => r.data),

  analyzeStoreKpis: (payload, storeId) =>
    api.post(`/manager/analyze-store-kpis${storeParam(storeId)}`, payload).then((r) => r.data),

  // ─── Diagnostic Manager ──────────────────────────────────────────────────────

  getMyDiagnostic: (storeId) =>
    api.get(`/manager-diagnostic/me${storeParam(storeId)}`).then((r) => r.data),

  getSellerDiagnosticByManager: (sellerId, storeId) =>
    api.get(`/manager-diagnostic/seller/${sellerId}${storeParam(storeId)}`).then((r) => r.data),

  submitDiagnostic: (payload) =>
    api.post('/manager-diagnostic', payload).then((r) => r.data),

  // ─── Morning Brief ───────────────────────────────────────────────────────────

  getMorningBriefs: (storeId) =>
    api.get(`/briefs/morning/history${storeParam(storeId)}`).then((r) => toArray(r.data)),

  generateMorningBrief: (payload) =>
    api.post('/briefs/morning', payload).then((r) => r.data),

  deleteMorningBrief: (briefId, storeId) =>
    api.delete(`/briefs/morning/${briefId}${storeParam(storeId)}`).then((r) => r.data),

  // ─── Relations & Conflits ─────────────────────────────────────────────────────

  getRelationshipAdvice: (url) =>
    api.get(url).then((r) => r.data),

  deleteRelationshipAdvice: (url) =>
    api.delete(url).then((r) => r.data),

  getConflictResolution: (url) =>
    api.get(url).then((r) => r.data),

  submitConflictResolution: (payload) =>
    api.post('/manager/conflict-resolution', payload).then((r) => r.data),

  // ─── Abonnement ──────────────────────────────────────────────────────────────

  getSubscriptionHistory: () =>
    api.get('/manager/subscription-history').then((r) => toArray(r.data)),

  getSubscriptionStatus: (storeId) =>
    api.get(`/manager/subscription-status${storeParam(storeId)}`).then((r) => r.data),

  // ─── Sync mode ───────────────────────────────────────────────────────────────

  getSyncMode: (storeId) =>
    api.get(`/manager/sync-mode${storeParam(storeId)}`).then((r) => r.data),
};

export default managerService;
