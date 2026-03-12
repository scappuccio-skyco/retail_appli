import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Service IA — encapsule tous les appels /ai/* et les endpoints d'analyse IA
 */
const aiService = {
  // ─── Diagnostic DISC ────────────────────────────────────────────────────────

  analyzeDiagnostic: (responses) =>
    api.post('/ai/diagnostic', responses).then((r) => r.data),

  // ─── Analyse équipe ──────────────────────────────────────────────────────────

  analyzeTeam: (storeId) => {
    const param = storeId ? `?store_id=${storeId}` : '';
    return api.post(`/manager/analyze-team${param}`).then((r) => r.data);
  },

  getTeamAnalysesHistory: (storeId) => {
    const param = storeId ? `?store_id=${storeId}` : '';
    return api.get(`/manager/team-analyses-history${param}`).then((r) => toArray(r.data));
  },

  deleteTeamAnalysis: (analysisId, storeId) => {
    const param = storeId ? `?store_id=${storeId}` : '';
    return api.delete(`/manager/team-analysis/${analysisId}${param}`).then((r) => r.data);
  },

  // ─── Analyse KPI store ───────────────────────────────────────────────────────

  analyzeStoreKpis: (endpoint, payload) =>
    api.post(endpoint, payload).then((r) => r.data),

  // ─── Bilan équipe ────────────────────────────────────────────────────────────

  generateTeamBilan: (startDate, endDate) =>
    api.post(`/manager/team-bilan?start_date=${startDate}&end_date=${endDate}`).then((r) => r.data),

  getLatestTeamBilan: () =>
    api.get('/manager/team-bilan/latest').then((r) => r.data),

  // ─── Morning Brief ───────────────────────────────────────────────────────────

  generateMorningBrief: (payload) =>
    api.post('/briefs/morning', payload).then((r) => r.data),

  // ─── Conseil relationnel & résolution de conflits ────────────────────────────

  getRelationshipAdvice: (url) =>
    api.get(url).then((r) => r.data),

  submitConflictResolution: (url, payload) =>
    api.post(url, payload).then((r) => r.data),

  // ─── Performance vendeur (coaching IA) ───────────────────────────────────────

  generatePerformanceAnalysis: (payload) =>
    api.post('/seller/performance-analysis', payload).then((r) => r.data),

  // ─── Super Admin IA ──────────────────────────────────────────────────────────

  getAdminConversations: () =>
    api.get('/superadmin/ai-assistant/conversations').then((r) => toArray(r.data)),

  getAdminConversation: (convId) =>
    api.get(`/superadmin/ai-assistant/conversation/${convId}`).then((r) => r.data),

  deleteAdminConversation: (convId) =>
    api.delete(`/superadmin/ai-assistant/conversation/${convId}`).then((r) => r.data),

  sendAdminMessage: (payload) =>
    api.post('/superadmin/ai-assistant/message', payload).then((r) => r.data),

  startAdminConversation: (payload) =>
    api.post('/superadmin/ai-assistant/start', payload).then((r) => r.data),
};

export default aiService;
