import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function SystemLogsTab({
  systemLogs,
  logFilters,
  setLogFilters,
  fetchSystemLogs,
}) {
  return (
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
            style={{colorScheme: 'dark'}}
          >
            <option value="" className="bg-gray-800 text-white">Tous</option>
            <option value="error" className="bg-gray-800 text-white">Erreurs</option>
            <option value="warning" className="bg-gray-800 text-white">Avertissements</option>
            <option value="info" className="bg-gray-800 text-white">Informations</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-2">Type</label>
          <select
            value={logFilters.type}
            onChange={(e) => setLogFilters({ ...logFilters, type: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            style={{colorScheme: 'dark'}}
          >
            <option value="" className="bg-gray-800 text-white">Tous</option>
            <option value="backend" className="bg-gray-800 text-white">Backend</option>
            <option value="api" className="bg-gray-800 text-white">API</option>
            <option value="database" className="bg-gray-800 text-white">Database</option>
            <option value="frontend" className="bg-gray-800 text-white">Frontend</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-2">Période</label>
          <select
            value={logFilters.hours}
            onChange={(e) => setLogFilters({ ...logFilters, hours: Number.parseInt(e.target.value) })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            style={{colorScheme: 'dark'}}
          >
            <option value="1" className="bg-gray-800 text-white">Dernière heure</option>
            <option value="6" className="bg-gray-800 text-white">6 heures</option>
            <option value="24" className="bg-gray-800 text-white">24 heures</option>
            <option value="72" className="bg-gray-800 text-white">3 jours</option>
            <option value="168" className="bg-gray-800 text-white">7 jours</option>
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
        {(systemLogs.logs || systemLogs.items) && (systemLogs.logs || systemLogs.items).length > 0 ? (
          (systemLogs.logs || systemLogs.items).map((log, idx) => (
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
  );
}
