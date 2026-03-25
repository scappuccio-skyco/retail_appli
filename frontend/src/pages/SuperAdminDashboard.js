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
import ToolsTab from './superAdminDashboard/ToolsTab';
import UsersTab from './superAdminDashboard/UsersTab';
import useSuperAdminDashboard from './superAdminDashboard/useSuperAdminDashboard';
import {
  Users, Building2, TrendingUp, Activity,
  ShieldCheck, AlertCircle, Sparkles, Clock, Wrench
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const s = useSuperAdminDashboard();

  if (s.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white p-6 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1E40AF] mb-1 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8" />
              SuperAdmin Dashboard
            </h1>
            <p className="text-gray-500 text-sm">Tableau de bord d'administration de la plateforme</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => { await logout(); globalThis.location.href = '/login'; }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all text-sm font-medium"
            >
              Déconnexion
            </button>
            <button
              onClick={() => globalThis.location.href = '/'}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-lg transition-all text-sm font-medium"
            >
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* System Health Alert */}
      {s.health && s.health.status !== 'ok' && s.health.status !== 'healthy' && s.health.errors_10min > 0 && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${
          s.health.status === 'critical' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'
        }`}>
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-6 h-6 ${s.health.status === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
            <div>
              <h3 className="font-bold text-gray-800">
                {s.health.status === 'critical' ? '🚨 Alerte Critique' : '⚠️ Attention'}
              </h3>
              <p className="text-sm text-gray-600">
                {s.health.errors_10min > 0 && `${s.health.errors_10min} erreurs dans les 10 dernières minutes. `}
                {s.health.errors_24h > 0 && `${s.health.errors_24h} erreurs au total sur 24h.`}
              </p>
              {s.health.last_error && (
                <p className="text-xs text-gray-500 mt-1">Dernière erreur: {s.health.last_error.message}</p>
              )}
            </div>
            <button
              onClick={() => s.setActiveTab('system-logs')}
              className="ml-auto px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm"
            >
              Voir les logs
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {s.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Building2 className="w-8 h-8 text-[#1E40AF]" />
              <span className="text-xs text-gray-400 font-medium">Entreprises</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mb-1">{s.stats.workspaces.active}</div>
            <div className="text-sm text-gray-500">{s.stats.workspaces.total} total · {s.stats.workspaces.trial} en essai</div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-green-600" />
              <span className="text-xs text-gray-400 font-medium">Utilisateurs actifs</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mb-1">{s.stats.users.total_active}</div>
            <div className="text-sm text-gray-500">{s.stats.users.active_managers} managers · {s.stats.users.active_sellers} vendeurs</div>
            {s.stats.users.inactive > 0 && (
              <div className="text-xs text-gray-400 mt-1">+{s.stats.users.inactive} inactifs</div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-orange-500" />
              <span className="text-xs text-gray-400 font-medium">Opérations IA</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mb-1">{s.stats.usage.total_ai_operations}</div>
            <div className="text-sm text-gray-500">{s.stats.usage.analyses_ventes} analyses · {s.stats.usage.diagnostics} diagnostics</div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <span className="text-xs text-gray-400 font-medium">MRR</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mb-1">{s.stats.revenue.mrr}€</div>
            <div className="text-sm text-gray-500">{s.stats.revenue.active_subscriptions} payants · {s.stats.revenue.trial_subscriptions} essais</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 bg-white rounded-xl p-2 border border-gray-200 shadow-sm">
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
                s.activeTab === id ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => s.setActiveTab('system-logs')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'system-logs' ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
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
              s.activeTab === 'ai-assistant' ? 'bg-gradient-to-r from-[#1E40AF] to-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Assistant IA
          </button>
          <button
            onClick={() => s.setActiveTab('trials')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'trials' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Gestion des Essais
          </button>
          <button
            onClick={() => s.setActiveTab('subscriptions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'subscriptions' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Abonnements Stripe
          </button>
          <button
            onClick={() => s.setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'users' ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Utilisateurs
          </button>
          <button
            onClick={() => s.setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              s.activeTab === 'tools' ? 'bg-[#1E40AF] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Outils
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
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
        {s.activeTab === 'users' && <UsersTab />}
        {s.activeTab === 'tools' && <ToolsTab />}
      </div>
    </div>
  );
}
