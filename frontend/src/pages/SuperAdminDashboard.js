import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import AdminManagement from '../components/superadmin/AdminManagement';
import { 
  Users, Building2, TrendingUp, Database, Activity, 
  ShieldCheck, AlertCircle, CheckCircle, XCircle, Clock 
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [logs, setLogs] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [logFilters, setLogFilters] = useState({ level: '', type: '', hours: 24 });

  useEffect(() => {
    fetchData();
    // Auto-refresh health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'system-logs') {
      fetchSystemLogs();
    }
  }, [activeTab, logFilters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, workspacesRes, logsRes, healthRes] = await Promise.all([
        axios.get(`${API}/superadmin/stats`, { headers }),
        axios.get(`${API}/superadmin/workspaces`, { headers }),
        axios.get(`${API}/superadmin/logs?limit=50`, { headers }),
        axios.get(`${API}/superadmin/health`, { headers })
      ]);

      setStats(statsRes.data);
      setWorkspaces(workspacesRes.data);
      setLogs(logsRes.data);
      setHealth(healthRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Accès refusé - SuperAdmin requis');
        window.location.href = '/';
      } else {
        toast.error('Erreur lors du chargement des données');
      }
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const healthRes = await axios.get(`${API}/superadmin/health`, { headers });
      setHealth(healthRes.data);
    } catch (error) {
      console.error('Error fetching health:', error);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = {
        limit: 100,
        hours: logFilters.hours,
        ...(logFilters.level && { level: logFilters.level }),
        ...(logFilters.type && { type: logFilters.type })
      };
      const res = await axios.get(`${API}/superadmin/system-logs`, { headers, params });
      setSystemLogs(res.data);
    } catch (error) {
      console.error('Error fetching system logs:', error);
      toast.error('Erreur lors du chargement des logs');
    }
  };

  const handleWorkspaceStatusChange = async (workspaceId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API}/superadmin/workspaces/${workspaceId}/status`,
        null,
        {
          params: { status: newStatus },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const statusMessage = newStatus === 'active' ? 'activé' : newStatus === 'suspended' ? 'suspendu' : 'supprimé';
      toast.success(`Workspace ${statusMessage}`);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la modification');
      console.error('Error:', error);
    }
  };

  const handleChangePlan = async (workspaceId, workspaceName) => {
    const newPlan = prompt(
      `Changer le plan pour "${workspaceName}":\n\n` +
      `Options disponibles:\n` +
      `- trial (Essai gratuit)\n` +
      `- starter (Plan Starter)\n` +
      `- professional (Plan Professional)\n` +
      `- enterprise (Plan Enterprise)\n\n` +
      `Entrez le nouveau plan:`
    );

    if (!newPlan) return;

    const validPlans = ['trial', 'starter', 'professional', 'enterprise'];
    if (!validPlans.includes(newPlan.toLowerCase())) {
      toast.error('Plan invalide. Choisissez: trial, starter, professional ou enterprise');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // Endpoint à créer dans le backend
      await axios.patch(
        `${API}/superadmin/workspaces/${workspaceId}/plan`,
        { plan: newPlan.toLowerCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Plan changé en ${newPlan}`);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du changement de plan');
      console.error('Error:', error);
    }
  };

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
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-all"
            >
              Déconnexion
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* System Health Alert */}
      {health && health.status !== 'healthy' && (
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
        <div className="flex gap-2 bg-white/10 backdrop-blur-lg rounded-lg p-2 border border-white/20">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'workspaces'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Logs d'audit
          </button>
          <button
            onClick={() => setActiveTab('system-logs')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
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
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'admins'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            Gestion Admins
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
                    • {stats?.workspaces.suspended} suspendus
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
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Gestion des Workspaces</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-3 text-purple-200 font-semibold">Entreprise</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Manager</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Vendeurs</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Plan</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Statut</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => (
                    <tr key={workspace.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="p-3 text-white font-medium">{workspace.name}</td>
                      <td className="p-3 text-purple-200">
                        {workspace.manager?.name}
                        <br />
                        <span className="text-xs text-purple-300">{workspace.manager?.email}</span>
                      </td>
                      <td className="p-3 text-white">{workspace.sellers_count}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            workspace.subscription.plan === 'enterprise' 
                              ? 'bg-purple-500/20 text-purple-200'
                              : workspace.subscription.plan === 'professional'
                              ? 'bg-blue-500/20 text-blue-200'
                              : workspace.subscription.plan === 'starter'
                              ? 'bg-green-500/20 text-green-200'
                              : 'bg-gray-500/20 text-gray-200'
                          }`}>
                            {workspace.subscription.plan}
                          </span>
                          <button
                            onClick={() => handleChangePlan(workspace.id, workspace.name)}
                            className="text-xs text-purple-300 hover:text-purple-100 underline"
                            title="Changer le plan"
                          >
                            modifier
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          workspace.status === 'active'
                            ? 'bg-green-500/20 text-green-200'
                            : workspace.status === 'suspended'
                            ? 'bg-orange-500/20 text-orange-200'
                            : 'bg-red-500/20 text-red-200'
                        }`}>
                          {workspace.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {workspace.status === 'active' ? (
                            <button
                              onClick={() => handleWorkspaceStatusChange(workspace.id, 'suspended')}
                              className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 rounded text-sm transition-all"
                            >
                              Suspendre
                            </button>
                          ) : workspace.status === 'suspended' ? (
                            <button
                              onClick={() => handleWorkspaceStatusChange(workspace.id, 'active')}
                              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded text-sm transition-all"
                            >
                              Activer
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              if (window.confirm(`⚠️ Êtes-vous sûr de vouloir supprimer le workspace "${workspace.name}" ?\n\nCette action est IRRÉVERSIBLE et supprimera :\n- Le workspace\n- Tous les utilisateurs (manager + vendeurs)\n- Toutes les données (analyses, diagnostics, etc.)`)) {
                                handleWorkspaceStatusChange(workspace.id, 'deleted');
                              }
                            }}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded text-sm transition-all"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Logs d'audit administrateur</h2>
            <div className="space-y-2">
              {logs.map((log, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-purple-300" />
                      <span className="text-sm text-purple-200">
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <span className="text-xs text-purple-300">{log.admin_email}</span>
                  </div>
                  <div className="mt-2 text-white">
                    Action: <span className="font-medium">{log.action}</span>
                    {log.workspace_id && (
                      <span className="ml-3 text-purple-200">
                        Workspace: {log.workspace_id}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'system-logs' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Logs Système</h2>
              <button
                onClick={fetchSystemLogs}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
              >
                Actualiser
              </button>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-purple-200 mb-2">Sévérité</label>
                <select
                  value={logFilters.level}
                  onChange={(e) => setLogFilters({ ...logFilters, level: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="">Tous</option>
                  <option value="error">Erreurs</option>
                  <option value="warning">Avertissements</option>
                  <option value="info">Informations</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-purple-200 mb-2">Type</label>
                <select
                  value={logFilters.type}
                  onChange={(e) => setLogFilters({ ...logFilters, type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="">Tous</option>
                  <option value="backend">Backend</option>
                  <option value="api">API</option>
                  <option value="database">Database</option>
                  <option value="frontend">Frontend</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-purple-200 mb-2">Période</label>
                <select
                  value={logFilters.hours}
                  onChange={(e) => setLogFilters({ ...logFilters, hours: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="1">Dernière heure</option>
                  <option value="6">6 heures</option>
                  <option value="24">24 heures</option>
                  <option value="72">3 jours</option>
                  <option value="168">7 jours</option>
                </select>
              </div>
            </div>

            {/* Stats */}
            {systemLogs.stats && (
              <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                  <div className="text-red-400 text-sm mb-1">Erreurs</div>
                  <div className="text-2xl font-bold text-white">{systemLogs.stats.total_errors}</div>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                  <div className="text-yellow-400 text-sm mb-1">Avertissements</div>
                  <div className="text-2xl font-bold text-white">{systemLogs.stats.total_warnings}</div>
                </div>
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                  <div className="text-blue-400 text-sm mb-1">Période</div>
                  <div className="text-2xl font-bold text-white">{systemLogs.stats.period_hours}h</div>
                </div>
              </div>
            )}

            {/* Logs List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {systemLogs.logs && systemLogs.logs.length > 0 ? (
                systemLogs.logs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg border ${
                      log.level === 'error' 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : log.level === 'warning'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {log.level === 'error' ? (
                          <XCircle className="w-5 h-5 text-red-400" />
                        ) : log.level === 'warning' ? (
                          <AlertCircle className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-blue-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.level === 'error' 
                                ? 'bg-red-500/30 text-red-200' 
                                : log.level === 'warning'
                                ? 'bg-yellow-500/30 text-yellow-200'
                                : 'bg-blue-500/30 text-blue-200'
                            }`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-purple-200">
                              {log.type}
                            </span>
                            {log.http_code && (
                              <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-purple-200">
                                HTTP {log.http_code}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-purple-300 mt-1">
                            {new Date(log.timestamp).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-white font-medium mb-1">{log.message}</div>
                    {log.endpoint && (
                      <div className="text-sm text-purple-300">Endpoint: {log.endpoint}</div>
                    )}
                    {log.user_id && (
                      <div className="text-sm text-purple-300">User ID: {log.user_id}</div>
                    )}
                    {log.stack_trace && (
                      <details className="mt-2">
                        <summary className="text-sm text-purple-300 cursor-pointer hover:text-purple-200">
                          Stack Trace
                        </summary>
                        <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-purple-200 overflow-x-auto">
                          {log.stack_trace}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-purple-300">
                  Aucun log pour les filtres sélectionnés
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
