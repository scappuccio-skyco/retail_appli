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
        <h2 className="text-2xl font-bold text-gray-800">Logs d'audit administrateur</h2>
        <button
          onClick={fetchAuditLogs}
          className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-lg transition-all"
        >
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Type d'action</label>
          <select
            value={auditFilters.action}
            onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Toutes les actions</option>
            {auditLogData.available_actions && auditLogData.available_actions.map((action) => (
              <option key={action} value={action}>
                {(action || '').replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Administrateurs</label>
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
                backgroundColor: 'white',
                borderColor: '#d1d5db',
                minHeight: '42px',
                '&:hover': { borderColor: '#9ca3af' }
              }),
              menu: (base) => ({ ...base, backgroundColor: 'white', border: '1px solid #d1d5db' }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
                color: '#374151',
              }),
              multiValue: (base) => ({ ...base, backgroundColor: '#dbeafe', borderRadius: '4px' }),
              multiValueLabel: (base) => ({ ...base, color: '#1e40af', fontSize: '0.875rem' }),
              multiValueRemove: (base) => ({
                ...base,
                color: '#1e40af',
                '&:hover': { backgroundColor: '#bfdbfe', color: '#1e3a8a' }
              }),
              input: (base) => ({ ...base, color: '#374151' }),
              placeholder: (base) => ({ ...base, color: '#9ca3af' })
            }}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 font-medium mb-2">Période</label>
          <select
            value={auditFilters.days}
            onChange={(e) => setAuditFilters({ ...auditFilters, days: Number.parseInt(e.target.value) })}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="1">Dernier jour</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
            <option value="365">1 an</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs && logs.length > 0 ? (
          logs.map((log, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">
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
                    <span className="text-sm font-medium text-gray-800">{log.admin_name}</span>
                  )}
                  <span className="text-xs text-gray-500">{log.admin_email}</span>
                </div>
              </div>
              <div className="text-gray-800 font-medium mb-1">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {(log.action || 'unknown').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              {log.workspace_id && (
                <div className="text-sm text-gray-500 mt-1">
                  Workspace: {log.details?.workspace_name || log.workspace_id}
                </div>
              )}
              {log.details && Object.keys(log.details).length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    Détails
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
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
