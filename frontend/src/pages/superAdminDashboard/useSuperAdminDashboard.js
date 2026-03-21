import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

const normalizeWorkspacesResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
};

export default function useSuperAdminDashboard() {
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
  const [workspaceFilter, setWorkspaceFilter] = useState('active');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({});
  const [selectedWorkspaces, setSelectedWorkspaces] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') { fetchStats(); fetchWorkspaces(); }
  }, [activeTab]);

  useEffect(() => {
    const fetchWs = async () => {
      try {
        const res = await api.get('/superadmin/workspaces', { params: { include_deleted: true } });
        setWorkspaces(normalizeWorkspacesResponse(res.data));
      } catch (error) {
        logger.error('Error fetching workspaces:', error);
        setWorkspaces([]);
      }
    };
    fetchWs();
  }, [workspaceFilter]);

  useEffect(() => {
    if (activeTab === 'system-logs') fetchSystemLogs();
    else if (activeTab === 'logs') fetchAuditLogs();
  }, [activeTab, logFilters, auditFilters]);

  useEffect(() => { setSelectedWorkspaces(new Set()); }, [workspaceFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/superadmin/stats');
      setStats(res.data);
    } catch (error) { logger.error('Error fetching stats:', error); }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/superadmin/workspaces', { params: { include_deleted: true } });
      setWorkspaces(normalizeWorkspacesResponse(res.data));
    } catch (error) { logger.error('Error fetching workspaces:', error); setWorkspaces([]); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, workspacesRes, logsRes, healthRes] = await Promise.all([
        api.get('/superadmin/stats'),
        api.get('/superadmin/workspaces', { params: { include_deleted: true } }),
        api.get('/superadmin/logs', { params: { limit: 50, days: 7 } }),
        api.get('/superadmin/health'),
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
      const res = await api.get('/superadmin/health');
      setHealth(res.data);
    } catch (error) { logger.error('Error fetching health:', error); }
  };

  const fetchSystemLogs = async () => {
    try {
      const params = { limit: 100, hours: logFilters.hours, ...(logFilters.level && { level: logFilters.level }), ...(logFilters.type && { type: logFilters.type }) };
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
        limit: 100, days: auditFilters.days,
        ...(auditFilters.action && { action: auditFilters.action }),
        ...(auditFilters.admin_emails?.length > 0 && { admin_emails: auditFilters.admin_emails.join(',') }),
      };
      const res = await api.get('/superadmin/logs', { params });
      setAuditLogData(res.data);
      setLogs(res.data.logs || res.data);
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      toast.error("Erreur lors du chargement des logs d'audit");
    }
  };

  const handleWorkspaceStatusChange = async (workspaceId, newStatus) => {
    try {
      const url = `/superadmin/workspaces/${workspaceId}/status?status=${encodeURIComponent(newStatus)}`;
      const response = await api.patch(url);
      if (response.data?.status_unchanged) {
        toast.info(`Le workspace est déjà ${newStatus === 'active' ? 'activé' : 'supprimé'}`);
      } else {
        toast.success(`Workspace ${newStatus === 'active' ? 'activé' : 'supprimé'} avec succès`);
      }
      fetchData();
    } catch (error) {
      toast.error(`Erreur: ${error.response?.data?.detail || error.message || 'Erreur lors de la modification'}`);
      logger.error('Error changing workspace status:', error);
    }
  };

  // Subscription status helpers
  const getSubscriptionStatus = (workspace) => workspace?.subscription?.status || workspace?.subscription_status || 'inactive';

  const getNormalizedSubscriptionStatus = (workspace) => {
    const status = getSubscriptionStatus(workspace);
    if (status === 'trialing') return 'trial';
    if (status === 'past_due') return 'payment_failed';
    if (['trial_expired', 'expired', 'inactive', 'canceled'].includes(status)) return 'expired';
    return status || 'expired';
  };

  const getSubscriptionStatusLabel = (s) => {
    if (s === 'active') return 'Actif';
    if (s === 'trial') return 'Essai';
    if (s === 'payment_failed') return 'Paiement échoué';
    return 'Expiré';
  };

  const getSubscriptionStatusClasses = (s) => {
    if (s === 'active') return 'bg-green-500/20 text-green-200';
    if (s === 'trial') return 'bg-yellow-500/20 text-yellow-200';
    if (s === 'payment_failed') return 'bg-red-500/20 text-red-200';
    return 'bg-gray-500/20 text-gray-200';
  };

  const toggleWorkspace = (id) => setExpandedWorkspaces(prev => ({ ...prev, [id]: !prev[id] }));

  const workspaceList = Array.isArray(workspaces) ? workspaces : [];

  const getFilteredWorkspaces = () => workspaceList.filter(ws => {
    if (workspaceFilter === 'all') return true;
    if (workspaceFilter === 'deleted') return (ws.status || 'active') === 'deleted';
    return getNormalizedSubscriptionStatus(ws) === workspaceFilter;
  });

  const toggleWorkspaceSelection = (id) => {
    setSelectedWorkspaces(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = getFilteredWorkspaces().map(w => w.id);
    const allSelected = ids.every(id => selectedWorkspaces.has(id));
    setSelectedWorkspaces(allSelected ? new Set() : new Set(ids));
  };

  const areAllSelected = () => {
    const ids = getFilteredWorkspaces().map(w => w.id);
    return ids.length > 0 && ids.every(id => selectedWorkspaces.has(id));
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedWorkspaces.size === 0) { toast.error('Aucun workspace sélectionné'); return; }
    const msg = newStatus === 'deleted'
      ? `⚠️ Êtes-vous sûr de vouloir SUPPRIMER ${selectedWorkspaces.size} workspace(s) ?\n\nCette action est IRRÉVERSIBLE !`
      : `Voulez-vous ${newStatus === 'active' ? 'réactiver' : 'supprimer'} ${selectedWorkspaces.size} workspace(s) ?`;
    if (!globalThis.confirm(msg)) return;

    setBulkActionLoading(true);
    let successCount = 0, errorCount = 0;

    try {
      const res = await api.patch('/superadmin/workspaces/bulk/status', { workspace_ids: Array.from(selectedWorkspaces), status: newStatus });
      successCount = res.data.success_count || selectedWorkspaces.size;
      errorCount = res.data.error_count || 0;
    } catch (error) {
      if (error.response?.status === 404) {
        for (const id of selectedWorkspaces) {
          try { await api.patch(`/superadmin/workspaces/${id}/status?status=${newStatus}`); successCount++; }
          catch (err) { errorCount++; logger.error(`Error updating workspace ${id}:`, err); }
        }
      } else {
        toast.error("Erreur lors de l'action groupée");
        logger.error('Bulk action error:', error);
        setBulkActionLoading(false);
        return;
      }
    }

    setBulkActionLoading(false);
    setSelectedWorkspaces(new Set());
    errorCount === 0
      ? toast.success(`${successCount} workspace(s) ${newStatus === 'active' ? 'réactivé(s)' : 'supprimé(s)'} avec succès`)
      : toast.warning(`${successCount} réussi(s), ${errorCount} échec(s)`);
    fetchData();
  };

  return {
    stats, workspaces, logs, auditLogData, systemLogs, health, loading,
    activeTab, setActiveTab,
    logFilters, setLogFilters,
    auditFilters, setAuditFilters,
    workspaceFilter, setWorkspaceFilter,
    expandedWorkspaces, selectedWorkspaces, setSelectedWorkspaces,
    bulkActionLoading,
    fetchData, fetchStats, fetchWorkspaces,
    handleWorkspaceStatusChange, handleBulkStatusChange,
    getNormalizedSubscriptionStatus, getSubscriptionStatusLabel, getSubscriptionStatusClasses,
    toggleWorkspace, toggleWorkspaceSelection, toggleSelectAll, areAllSelected,
    getFilteredWorkspaces,
    fetchAuditLogs, fetchSystemLogs,
  };
}
