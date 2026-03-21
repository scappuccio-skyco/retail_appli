import React from 'react';
import Select from 'react-select';
import { Clock } from 'lucide-react';

export default function LogsTab({
  logs,
  auditLogData,
  auditFilters,
  setAuditFilters,
  fetchAuditLogs,
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Logs d'audit administrateur</h2>
        <button
          onClick={fetchAuditLogs}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
        >
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-purple-200 mb-2">Type d'action</label>
          <select
            value={auditFilters.action}
            onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            style={{colorScheme: 'dark'}}
          >
            <option value="" className="bg-gray-800 text-white">Toutes les actions</option>
            {auditLogData.available_actions && auditLogData.available_actions.map((action) => (
              <option key={action} value={action} className="bg-gray-800 text-white">
                {(action || '').replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-2">Administrateurs</label>
          <Select
            isMulti
            value={auditFilters.admin_emails.map(email => {
              const admin = auditLogData.available_admins?.find(a => a.email === email);
              return {
                value: email,
                label: admin ? `${admin.name} (${email})` : email
              };
            })}
            onChange={(selected) => {
              const emails = selected ? selected.map(option => option.value) : [];
              setAuditFilters({ ...auditFilters, admin_emails: emails });
            }}
            options={auditLogData.available_admins?.map(admin => ({
              value: admin.email,
              label: `${admin.name} (${admin.email})`
            })) || []}
            placeholder="Sélectionner un ou plusieurs admins..."
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                minHeight: '42px',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)'
                }
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? '#374151' : '#1f2937',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#374151'
                }
              }),
              multiValue: (base) => ({
                ...base,
                backgroundColor: '#9333ea',
                borderRadius: '4px'
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: 'white',
                fontSize: '0.875rem'
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: 'white',
                '&:hover': {
                  backgroundColor: '#7c3aed',
                  color: 'white'
                }
              }),
              input: (base) => ({
                ...base,
                color: 'white'
              }),
              placeholder: (base) => ({
                ...base,
                color: '#d8b4fe'
              })
            }}
          />
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-2">Période</label>
          <select
            value={auditFilters.days}
            onChange={(e) => setAuditFilters({ ...auditFilters, days: Number.parseInt(e.target.value) })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            style={{colorScheme: 'dark'}}
          >
            <option value="1" className="bg-gray-800 text-white">Dernier jour</option>
            <option value="7" className="bg-gray-800 text-white">7 jours</option>
            <option value="30" className="bg-gray-800 text-white">30 jours</option>
            <option value="90" className="bg-gray-800 text-white">90 jours</option>
            <option value="365" className="bg-gray-800 text-white">1 an</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs && logs.length > 0 ? (
          logs.map((log, idx) => (
            <div key={idx} className="p-4 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 hover:border-purple-500/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-purple-200">
                    {new Date(log.timestamp).toLocaleString('fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {log.admin_name && (
                    <span className="text-sm font-medium text-white">{log.admin_name}</span>
                  )}
                  <span className="text-xs text-purple-300">{log.admin_email}</span>
                </div>
              </div>
              <div className="text-white font-medium mb-1">
                <span className="px-2 py-1 bg-purple-600/30 rounded text-sm">
                  {(log.action || 'unknown').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              {log.workspace_id && (
                <div className="text-sm text-purple-300 mt-1">
                  Workspace: {log.details?.workspace_name || log.workspace_id}
                </div>
              )}
              {log.details && Object.keys(log.details).length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-purple-300 cursor-pointer hover:text-purple-200">
                    Détails
                  </summary>
                  <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-purple-200 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
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
