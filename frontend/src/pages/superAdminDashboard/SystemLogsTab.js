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
        <h2 className="text-2xl font-bold text-gray-800">Logs Système</h2>
        <button
          onClick={fetchSystemLogs}
          className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-lg transition-all"
        >
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Sévérité</label>
          <select
            value={logFilters.level}
            onChange={(e) => setLogFilters({ ...logFilters, level: e.target.value })}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Tous</option>
            <option value="error">Erreurs</option>
            <option value="warning">Avertissements</option>
            <option value="info">Informations</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Type</label>
          <select
            value={logFilters.type}
            onChange={(e) => setLogFilters({ ...logFilters, type: e.target.value })}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Tous</option>
            <option value="backend">Backend</option>
            <option value="api">API</option>
            <option value="database">Database</option>
            <option value="frontend">Frontend</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Période</label>
          <select
            value={logFilters.hours}
            onChange={(e) => setLogFilters({ ...logFilters, hours: Number.parseInt(e.target.value) })}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 text-sm font-medium mb-1">Erreurs</div>
            <div className="text-2xl font-bold text-red-700">{systemLogs.stats.total_errors}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-600 text-sm font-medium mb-1">Avertissements</div>
            <div className="text-2xl font-bold text-yellow-700">{systemLogs.stats.total_warnings}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-600 text-sm font-medium mb-1">Période</div>
            <div className="text-2xl font-bold text-blue-700">{systemLogs.stats.period_hours}h</div>
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
                  ? 'bg-red-50 border-red-200'
                  : log.level === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {log.level === 'error' ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : log.level === 'warning' ? (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        log.level === 'error'
                          ? 'bg-red-100 text-red-700'
                          : log.level === 'warning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        {log.type}
                      </span>
                      {log.http_code && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          HTTP {log.http_code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-gray-800 font-medium mb-1">{log.message}</div>
              {log.endpoint && (
                <div className="text-sm text-gray-500">Endpoint: {log.endpoint}</div>
              )}
              {log.user_id && (
                <div className="text-sm text-gray-500">User ID: {log.user_id}</div>
              )}
              {log.stack_trace && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
                    {log.stack_trace}
                  </pre>
                </details>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            Aucun log pour les filtres sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
