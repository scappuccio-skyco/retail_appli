import { api } from '../lib/apiClient';

const toArray = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

/**
 * Service Super Admin — encapsule tous les appels /superadmin/*
 */
const superadminService = {
  // ─── Admins ──────────────────────────────────────────────────────────────────

  getAdmins: () =>
    api.get('/superadmin/admins').then((r) => toArray(r.data)),

  createAdmin: (payload) =>
    api.post('/superadmin/admins', payload).then((r) => r.data),

  deleteAdmin: (adminId) =>
    api.delete(`/superadmin/admins/${adminId}`).then((r) => r.data),

  // ─── Invitations ─────────────────────────────────────────────────────────────

  getInvitations: (url) =>
    api.get(url).then((r) => toArray(r.data)),

  deleteInvitation: (invitationId) =>
    api.delete(`/superadmin/invitations/${invitationId}`).then((r) => r.data),

  createInvitation: (payload) =>
    api.post('/superadmin/invitations', payload).then((r) => r.data),

  patchInvitation: (invitationId, payload) =>
    api.patch(`/superadmin/invitations/${invitationId}`, payload).then((r) => r.data),

  // ─── Abonnements ─────────────────────────────────────────────────────────────

  getSubscriptionsOverview: () =>
    api.get('/superadmin/subscriptions/overview').then((r) => r.data),

  getGerantSubscriptionDetails: (gerantId) =>
    api.get(`/superadmin/subscriptions/${gerantId}/details`).then((r) => r.data),

  // ─── Périodes d'essai ────────────────────────────────────────────────────────

  getTrials: () =>
    api.get('/superadmin/gerants/trials').then((r) => toArray(r.data)),

  patchTrial: (gerantId, payload) =>
    api.patch(`/superadmin/trials/${gerantId}`, payload).then((r) => r.data),
};

export default superadminService;
