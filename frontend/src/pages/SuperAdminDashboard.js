import React from 'react';
import { useAuth } from '../contexts';
import AdminManagement from '../components/superadmin/AdminManagement';
import AIAssistant from '../components/superadmin/AIAssistant';
import InvitationsManagement from '../components/superadmin/InvitationsManagement';
import TrialManagement from '../components/superadmin/TrialManagement';
import StripeSubscriptionsView from '../components/superadmin/StripeSubscriptionsView';
import WorkspacesTab from './superAdminDashboard/WorkspacesTab';
import LogsTab from './superAdminDashboard/LogsTab';
import SystemLogsTab from './superAdminDashboard/SystemLogsTab';
import OverviewTab from './superAdminDashboard/OverviewTab';
import useSuperAdminDashboard from './superAdminDashboard/useSuperAdminDashboard';
import {
  Users, Building2, TrendingUp, Activity,
  ShieldCheck, AlertCircle, Sparkles, Clock
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const s = useSuperAdminDashboard();

  if (s.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              <ShieldCheck className="inline-block mr-3 w-10 h-10" />
              SuperAdmin Dashboard
            </h1>
            <p className="text-purple-200">Tableau de bord d'administration de la plateforme</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => { await logout(); globalThis.location.href = '/login'; }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-all"
            >
              Déconnexion
            </button>
            <button
              onClick={() => globalThis.location.href = '/'}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* System Health Alert */}
      {s.health && s.health.status !== 'ok' && s.health.status !== 'healthy' && s.health.errors_10min > 0 && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${
          s.health.status === 'critical' ? 'bg-red-500/20 border-red-500' : 'bg-yellow-500/20 border-yellow-500'
        }`}>
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-6 h-6 ${s.health.status === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
            <div>
              <h3 className="text-white font-bold">
                {s.health.status === 'critical' ? '🚨 Alerte Critique' : '⚠️ Attention'}
              </h3>
              <p className="text-sm text-purple-200">
                {s.health.errors_10min > 0 && `${s.health.errors_10min} erreurs dans les 10 dernières minutes. `}
                {s.health.errors_24h > 0 && `${s.health.errors_24h} erreurs au total sur 24h.`}
              </p>
              {s.health.last_error && (
                <p className="text-xs text-purple-300 mt-1">Dernière erreur: {s.health.last_error.message}</p>
              )}
            </div>
            <button
              onClick={() => s.setActiveTab('system-logs')}
              className="ml-auto px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm"
            >
              Voir les logs
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {s.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Building2 className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-purple-200">Entreprises</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{s.stats.workspaces.active}</div>
            <div className="text-sm text-purple-200">{s.stats.workspaces.total} total ({s.stats.workspaces.trial} en essai)</div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-green-400" />
              <span className="text-xs text-purple-200">Utilisateurs actifs</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{s.stats.users.total_active}</div>
            <div className="text-sm text-purple-200">{s.stats.users.active_managers} managers · {s.stats.users.active_sellers} vendeurs</div>
            {s.stats.users.inactive > 0 && (
              <div className="text-xs text-purple-300 mt-1">+{s.stats.users.inactive} inactifs</div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-yellow-400" />
              <span className="text-xs text-purple-200">Opérations IA</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{s.stats.usage.total_ai_operations}</div>
            <div className="text-sm text-purple-200">{s.stats.usage.analyses_ventes} analyses · {s.stats.usage.diagnostics} diagnostics</div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-purple-200">MRR</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{s.stats.revenue.mrr}€</div>
            <div className="text-sm text-purple-200">{s.stats.revenue.active_subscriptions} payants · {s.stats.revenue.trial_subscriptions} essais</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 bg-white/10 backdrop-blur-lg rounded-lg p-2 border border-white/20">
          {[
            { id: 'overview', label: "Vue d'ensemble" },
            { id: 'workspaces', label: 'Workspaces' },
            { id: 'logs', label: "Logs d'audit" },
            { id: 'admins', label: 'Gestion Admins' },
            { id: 'invitations', label: 'Invitations' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => s.setActiveTab(id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                s.activeTab === id ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => s.setActiveTab('system-logs')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'system-logs' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Logs Système
            {s.health && s.health.errors_24h > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{s.health.errors_24h}</span>
            )}
          </button>
          <button
            onClick={() => s.setActiveTab('ai-assistant')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'ai-assistant' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Assistant IA
          </button>
          <button
            onClick={() => s.setActiveTab('trials')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'trials' ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg' : 'text-orange-200 hover:bg-white/10'
            }`}
          >
            <Clock className="w-4 h-4" />
            Gestion des Essais
          </button>
          <button
            onClick={() => s.setActiveTab('subscriptions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'subscriptions' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' : 'text-green-200 hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Abonnements Stripe
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        {s.activeTab === 'overview' && <OverviewTab stats={s.stats} />}

        {s.activeTab === 'workspaces' && (
          <WorkspacesTab
            workspaces={s.workspaces}
            workspaceFilter={s.workspaceFilter}
            setWorkspaceFilter={s.setWorkspaceFilter}
            expandedWorkspaces={s.expandedWorkspaces}
            selectedWorkspaces={s.selectedWorkspaces}
            setSelectedWorkspaces={s.setSelectedWorkspaces}
            bulkActionLoading={s.bulkActionLoading}
            getNormalizedSubscriptionStatus={s.getNormalizedSubscriptionStatus}
            getSubscriptionStatusLabel={s.getSubscriptionStatusLabel}
            getSubscriptionStatusClasses={s.getSubscriptionStatusClasses}
            toggleWorkspace={s.toggleWorkspace}
            toggleWorkspaceSelection={s.toggleWorkspaceSelection}
            toggleSelectAll={s.toggleSelectAll}
            areAllSelected={s.areAllSelected}
            getFilteredWorkspaces={s.getFilteredWorkspaces}
            handleWorkspaceStatusChange={s.handleWorkspaceStatusChange}
            handleBulkStatusChange={s.handleBulkStatusChange}
          />
        )}

        {s.activeTab === 'logs' && (
          <LogsTab
            logs={s.logs}
            auditLogData={s.auditLogData}
            auditFilters={s.auditFilters}
            setAuditFilters={s.setAuditFilters}
            fetchAuditLogs={s.fetchAuditLogs}
          />
        )}

        {s.activeTab === 'system-logs' && (
          <SystemLogsTab
            systemLogs={s.systemLogs}
            logFilters={s.logFilters}
            setLogFilters={s.setLogFilters}
            fetchSystemLogs={s.fetchSystemLogs}
          />
        )}

        {s.activeTab === 'admins' && <AdminManagement />}
        {s.activeTab === 'invitations' && <InvitationsManagement />}
        {s.activeTab === 'ai-assistant' && <AIAssistant />}

        {s.activeTab === 'trials' && (
          <TrialManagement onTrialUpdated={() => { s.fetchStats(); s.fetchWorkspaces(); }} />
        )}

        {s.activeTab === 'subscriptions' && <StripeSubscriptionsView />}
      </div>
    </div>
  );
}
