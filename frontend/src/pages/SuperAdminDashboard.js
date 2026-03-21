import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { useAuth } from '../contexts';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import AdminManagement from '../components/superadmin/AdminManagement';
import AIAssistant from '../components/superadmin/AIAssistant';
import InvitationsManagement from '../components/superadmin/InvitationsManagement';
import TrialManagement from '../components/superadmin/TrialManagement';
import StripeSubscriptionsView from '../components/superadmin/StripeSubscriptionsView';
import WorkspacesTab from './superAdminDashboard/WorkspacesTab';
import LogsTab from './superAdminDashboard/LogsTab';
import SystemLogsTab from './superAdminDashboard/SystemLogsTab';
import {
  Users, Building2, TrendingUp, Activity,
  ShieldCheck, AlertCircle, CheckCircle, Sparkles, Clock
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [logs, setLogs] = useState([]);
  const [auditLogData, setAuditLogData] = useState({ logs: [], available_actions: [], available_admins: [] });
  const [systemLogs, setSystemLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [logFilters, setLogFilters] = useState({ level: '', type: '', hours: 24 });
  const [auditFilters, setAuditFilters] = useState({ action: '', admin_emails: [], days: 7 });
  const [workspaceFilter, setWorkspaceFilter] = useState('active'); // 'all', 'active', 'trial', 'expired', 'payment_failed', 'deleted'
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({});
  const [selectedWorkspaces, setSelectedWorkspaces] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const getSubscriptionStatus = (workspace) => {
    return workspace?.subscription?.status || workspace?.subscription_status || 'inactive';
  };

  const getNormalizedSubscriptionStatus = (workspace) => {
    const status = getSubscriptionStatus(workspace);
    if (status === 'trialing') return 'trial';
    if (status === 'past_due') return 'payment_failed';
    if (['trial_expired', 'expired', 'inactive', 'canceled'].includes(status)) return 'expired';
    return status || 'expired';
  };

  const getSubscriptionStatusLabel = (normalizedStatus) => {
    if (normalizedStatus === 'active') return 'Actif';
    if (normalizedStatus === 'trial') return 'Essai';
    if (normalizedStatus === 'payment_failed') return 'Paiement échoué';
    return 'Expiré';
  };

  const getSubscriptionStatusClasses = (normalizedStatus) => {
    if (normalizedStatus === 'active') return 'bg-green-500/20 text-green-200';
    if (normalizedStatus === 'trial') return 'bg-yellow-500/20 text-yellow-200';
    if (normalizedStatus === 'payment_failed') return 'bg-red-500/20 text-red-200';
    return 'bg-gray-500/20 text-gray-200';
  };

  const toggleWorkspace = (workspaceId) => {
    setExpandedWorkspaces(prev => ({
      ...prev,
      [workspaceId]: !prev[workspaceId]
    }));
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Rafraîchir les stats et workspaces quand on revient sur l'onglet overview
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
      fetchWorkspaces();
    }
  }, [activeTab]);

  // Refetch workspaces when showDeletedWorkspaces changes
  // Normalize API response: backend returns paginated { items, total, page, size, pages }
  const normalizeWorkspacesResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  };

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await api.get('/superadmin/workspaces', { 
          params: { include_deleted: true } // Always fetch all, filter client-side
        });
        setWorkspaces(normalizeWorkspacesResponse(res.data));
      } catch (error) {
        logger.error('Error fetching workspaces:', error);
        setWorkspaces([]);
      }
    };
    fetchWorkspaces();
  }, [workspaceFilter]);

  useEffect(() => {
    if (activeTab === 'system-logs') {
      fetchSystemLogs();
    } else if (activeTab === 'logs') {
      fetchAuditLogs();
    }
  }, [activeTab, logFilters, auditFilters]);

  const fetchStats = async () => {
    try {
      const statsRes = await api.get('/superadmin/stats');
      setStats(statsRes.data);
    } catch (error) {
      logger.error('Error fetching stats:', error);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const workspacesRes = await api.get('/superadmin/workspaces', { 
        params: { include_deleted: true } 
      });
      setWorkspaces(normalizeWorkspacesResponse(workspacesRes.data));
    } catch (error) {
      logger.error('Error fetching workspaces:', error);
      setWorkspaces([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [statsRes, workspacesRes, logsRes, healthRes] = await Promise.all([
        api.get('/superadmin/stats'),
        api.get('/superadmin/workspaces', { params: { include_deleted: true } }),
        api.get('/superadmin/logs', { params: { limit: 50, days: 7 } }),
        api.get('/superadmin/health')
      ]);

      setStats(statsRes.data);
      setWorkspaces(normalizeWorkspacesResponse(workspacesRes.data));
      setAuditLogData(logsRes.data);
      setLogs(logsRes.data.logs || logsRes.data);
      setHealth(healthRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Accès refusé - SuperAdmin requis');
        globalThis.location.href = '/';
      } else {
        toast.error('Erreur lors du chargement des données');
      }
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const healthRes = await api.get('/superadmin/health');
      setHealth(healthRes.data);
    } catch (error) {
      logger.error('Error fetching health:', error);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const params = {
        limit: 100,
        hours: logFilters.hours,
        ...(logFilters.level && { level: logFilters.level }),
        ...(logFilters.type && { type: logFilters.type })
      };
      const res = await api.get('/superadmin/system-logs', { params });
      setSystemLogs(res.data);
    } catch (error) {
      logger.error('Error fetching system logs:', error);
      toast.error('Erreur lors du chargement des logs');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const params = {
        limit: 100,
        days: auditFilters.days,
        ...(auditFilters.action && { action: auditFilters.action }),
        ...(auditFilters.admin_emails && auditFilters.admin_emails.length > 0 && { 
          admin_emails: auditFilters.admin_emails.join(',') 
        })
      };
      const res = await api.get('/superadmin/logs', { params });
      setAuditLogData(res.data);
      setLogs(res.data.logs || res.data);
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      toast.error('Erreur lors du chargement des logs d\'audit');
    }
  };

  const handleWorkspaceStatusChange = async (workspaceId, newStatus) => {
    try {
      logger.info(`🔄 Changing workspace ${workspaceId} status to ${newStatus}`);
      
      // Utiliser query parameter dans l'URL directement
      const url = `/superadmin/workspaces/${workspaceId}/status?status=${encodeURIComponent(newStatus)}`;
      logger.info(`📡 Sending PATCH request to: ${url}`);
      
      const response = await api.patch(url);
      
      logger.info(`✅ Workspace status change response:`, response.data);
      
      const statusMessage = newStatus === 'active' ? 'activé' : 'supprimé';
      
      // Vérifier si le statut n'a pas changé (déjà à cette valeur)
      if (response.data?.status_unchanged) {
        toast.info(`Le workspace est déjà ${statusMessage}`);
      } else {
        toast.success(`Workspace ${statusMessage} avec succès`);
      }
      
      // Rafraîchir les données
      fetchData();
    } catch (error) {
      logger.error('❌ Error changing workspace status:', error);
      logger.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      const errorMessage = error.response?.data?.detail || error.message || 'Erreur lors de la modification';
      toast.error(`Erreur: ${errorMessage}`);
    }
  };


  // ===== BULK SELECTION FUNCTIONS =====
  
  // Get filtered workspaces for current view (workspaces may be paginated object from API)
  const workspaceList = Array.isArray(workspaces) ? workspaces : [];
  const getFilteredWorkspaces = () => {
    return workspaceList.filter(workspace => {
      if (workspaceFilter === 'all') return true;
      if (workspaceFilter === 'deleted') {
        return (workspace.status || 'active') === 'deleted';
      }
      return getNormalizedSubscriptionStatus(workspace) === workspaceFilter;
    });
  };

  // Toggle single workspace selection
  const toggleWorkspaceSelection = (workspaceId) => {
    setSelectedWorkspaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId);
      } else {
        newSet.add(workspaceId);
      }
      return newSet;
    });
  };

  // Select/Deselect all visible workspaces
  const toggleSelectAll = () => {
    const filteredIds = getFilteredWorkspaces().map(w => w.id);
    const allSelected = filteredIds.every(id => selectedWorkspaces.has(id));
    
    if (allSelected) {
      // Deselect all
      setSelectedWorkspaces(new Set());
    } else {
      // Select all filtered
      setSelectedWorkspaces(new Set(filteredIds));
    }
  };

  // Check if all visible workspaces are selected
  const areAllSelected = () => {
    const filteredIds = getFilteredWorkspaces().map(w => w.id);
    return filteredIds.length > 0 && filteredIds.every(id => selectedWorkspaces.has(id));
  };

  // Bulk status change
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedWorkspaces.size === 0) {
      toast.error('Aucun workspace sélectionné');
      return;
    }

    const statusLabel = newStatus === 'active' ? 'réactiver' : 'supprimer';
    const confirmMessage = newStatus === 'deleted' 
      ? `⚠️ Êtes-vous sûr de vouloir SUPPRIMER ${selectedWorkspaces.size} workspace(s) ?\n\nCette action est IRRÉVERSIBLE !`
      : `Voulez-vous ${statusLabel} ${selectedWorkspaces.size} workspace(s) ?`;

    if (!globalThis.confirm(confirmMessage)) return;

    setBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Use bulk endpoint if available, otherwise loop
      const response = await api.patch(
        `/superadmin/workspaces/bulk/status`,
        { 
          workspace_ids: Array.from(selectedWorkspaces),
          status: newStatus 
        }
      );
      
      successCount = response.data.success_count || selectedWorkspaces.size;
      errorCount = response.data.error_count || 0;
    } catch (error) {
      // Fallback to individual requests if bulk endpoint doesn't exist
      if (error.response?.status === 404) {
        for (const workspaceId of selectedWorkspaces) {
          try {
            await api.patch(
              `/superadmin/workspaces/${workspaceId}/status?status=${newStatus}`
            );
            successCount++;
          } catch (err) {
            errorCount++;
            logger.error(`Error updating workspace ${workspaceId}:`, err);
          }
        }
      } else {
        toast.error('Erreur lors de l\'action groupée');
        logger.error('Bulk action error:', error);
        setBulkActionLoading(false);
        return;
      }
    }

    setBulkActionLoading(false);
    setSelectedWorkspaces(new Set());
    
    if (errorCount === 0) {
      const action = newStatus === 'active' ? 'réactivé(s)' : 'supprimé(s)';
      toast.success(`${successCount} workspace(s) ${action} avec succès`);
    } else {
      toast.warning(`${successCount} réussi(s), ${errorCount} échec(s)`);
    }
    
    fetchData();
  };

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedWorkspaces(new Set());
  }, [workspaceFilter]);

  if (loading) {
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
              onClick={async () => {
                await logout();
                globalThis.location.href = '/login';
              }}
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

      {/* System Health Alert - Only shows when there are actual issues */}
      {health && health.status !== 'ok' && health.status !== 'healthy' && health.errors_10min > 0 && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${
          health.status === 'critical' 
            ? 'bg-red-500/20 border-red-500' 
            : 'bg-yellow-500/20 border-yellow-500'
        }`}>
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-6 h-6 ${
              health.status === 'critical' ? 'text-red-400' : 'text-yellow-400'
            }`} />
            <div>
              <h3 className="text-white font-bold">
                {health.status === 'critical' ? '🚨 Alerte Critique' : '⚠️ Attention'}
              </h3>
              <p className="text-sm text-purple-200">
                {health.errors_10min > 0 && `${health.errors_10min} erreurs dans les 10 dernières minutes. `}
                {health.errors_24h > 0 && `${health.errors_24h} erreurs au total sur 24h.`}
              </p>
              {health.last_error && (
                <p className="text-xs text-purple-300 mt-1">
                  Dernière erreur: {health.last_error.message}
                </p>
              )}
            </div>
            <button
              onClick={() => setActiveTab('system-logs')}
              className="ml-auto px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm"
            >
              Voir les logs
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Building2 className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-purple-200">Entreprises</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {stats.workspaces.active}
            </div>
            <div className="text-sm text-purple-200">
              {stats.workspaces.total} total ({stats.workspaces.trial} en essai)
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-green-400" />
              <span className="text-xs text-purple-200">Utilisateurs actifs</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {stats.users.total_active}
            </div>
            <div className="text-sm text-purple-200">
              {stats.users.active_managers} managers · {stats.users.active_sellers} vendeurs
            </div>
            {stats.users.inactive > 0 && (
              <div className="text-xs text-purple-300 mt-1">
                +{stats.users.inactive} inactifs
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-yellow-400" />
              <span className="text-xs text-purple-200">Opérations IA</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {stats.usage.total_ai_operations}
            </div>
            <div className="text-sm text-purple-200">
              {stats.usage.analyses_ventes} analyses · {stats.usage.diagnostics} diagnostics
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-purple-200">MRR</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {stats.revenue.mrr}€
            </div>
            <div className="text-sm text-purple-200">
              {stats.revenue.active_subscriptions} payants · {stats.revenue.trial_subscriptions} essais
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 bg-white/10 backdrop-blur-lg rounded-lg p-2 border border-white/20">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'workspaces'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'logs'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Logs d'audit
          </button>
          <button
            onClick={() => setActiveTab('system-logs')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              activeTab === 'system-logs'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Logs Système
            {health && health.errors_24h > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {health.errors_24h}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'admins'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Gestion Admins
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'invitations'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Invitations
          </button>
          <button
            onClick={() => setActiveTab('ai-assistant')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              activeTab === 'ai-assistant'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Assistant IA
          </button>
          <button
            onClick={() => setActiveTab('trials')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              activeTab === 'trials'
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                : 'text-orange-200 hover:bg-white/10'
            }`}
          >
            <Clock className="w-4 h-4" />
            Gestion des Essais
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 ${
              activeTab === 'subscriptions'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                : 'text-green-200 hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Abonnements Stripe
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Vue d'ensemble de la plateforme</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Statut système */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Statut système
                </h3>
                <div className="space-y-2 text-purple-200">
                  <div className="flex justify-between">
                    <span>Base de données</span>
                    <span className="text-green-400 font-medium">✓ Opérationnelle</span>
                  </div>
                  <div className="flex justify-between">
                    <span>API Backend</span>
                    <span className="text-green-400 font-medium">✓ Disponible</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Services IA</span>
                    <span className="text-green-400 font-medium">✓ Actifs</span>
                  </div>
                </div>
              </div>

              {/* Activité récente */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-yellow-400" />
                  Activité (7 derniers jours)
                </h3>
                <div className="space-y-2 text-purple-200">
                  <div className="flex justify-between">
                    <span>Nouvelles inscriptions</span>
                    <span className="text-white font-medium">{stats?.activity.recent_signups_7d}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Analyses créées</span>
                    <span className="text-white font-medium">{stats?.activity.recent_analyses_7d}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total opérations IA</span>
                    <span className="text-white font-medium">{stats?.usage.total_ai_operations}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Détails additionnels */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">📊 Détails des données</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-purple-300 mb-2">Workspaces</div>
                  <div className="text-white">
                    • {stats?.workspaces.active} actifs<br/>
                    • {stats?.workspaces.trial} en essai<br/>
                    • {stats?.workspaces.total} total
                  </div>
                </div>
                <div>
                  <div className="text-purple-300 mb-2">Utilisateurs</div>
                  <div className="text-white">
                    • {stats?.users.total_active} actifs<br/>
                    • {stats?.users.inactive} inactifs<br/>
                    • {stats?.users.all_managers + stats?.users.all_sellers} total
                  </div>
                </div>
                <div>
                  <div className="text-purple-300 mb-2">Abonnements</div>
                  <div className="text-white">
                    • {stats?.revenue.active_subscriptions} payants<br/>
                    • {stats?.revenue.trial_subscriptions} en essai<br/>
                    • {stats?.revenue.mrr}€ MRR
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspaces' && (
          <WorkspacesTab
            workspaces={workspaces}
            workspaceFilter={workspaceFilter}
            setWorkspaceFilter={setWorkspaceFilter}
            expandedWorkspaces={expandedWorkspaces}
            selectedWorkspaces={selectedWorkspaces}
            setSelectedWorkspaces={setSelectedWorkspaces}
            bulkActionLoading={bulkActionLoading}
            getNormalizedSubscriptionStatus={getNormalizedSubscriptionStatus}
            getSubscriptionStatusLabel={getSubscriptionStatusLabel}
            getSubscriptionStatusClasses={getSubscriptionStatusClasses}
            toggleWorkspace={toggleWorkspace}
            toggleWorkspaceSelection={toggleWorkspaceSelection}
            toggleSelectAll={toggleSelectAll}
            areAllSelected={areAllSelected}
            getFilteredWorkspaces={getFilteredWorkspaces}
            handleWorkspaceStatusChange={handleWorkspaceStatusChange}
            handleBulkStatusChange={handleBulkStatusChange}
          />
        )}

        {activeTab === 'logs' && (
          <LogsTab
            logs={logs}
            auditLogData={auditLogData}
            auditFilters={auditFilters}
            setAuditFilters={setAuditFilters}
            fetchAuditLogs={fetchAuditLogs}
          />
        )}

        {activeTab === 'system-logs' && (
          <SystemLogsTab
            systemLogs={systemLogs}
            logFilters={logFilters}
            setLogFilters={setLogFilters}
            fetchSystemLogs={fetchSystemLogs}
          />
        )}

        {activeTab === 'admins' && <AdminManagement />}

        {activeTab === 'invitations' && <InvitationsManagement />}

        {activeTab === 'ai-assistant' && <AIAssistant />}

        {activeTab === 'trials' && (
          <TrialManagement 
            onTrialUpdated={() => {
              // Rafraîchir les stats et workspaces après mise à jour de l'essai
              fetchStats();
              fetchWorkspaces();
            }}
          />
        )}

        {activeTab === 'subscriptions' && <StripeSubscriptionsView />}
      </div>
    </div>
  );
}
