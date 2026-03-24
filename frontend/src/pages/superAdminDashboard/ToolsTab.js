import React, { useState } from 'react';
import { api } from '../../lib/apiClient';
import { Loader, RefreshCw, Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// ─── CGU Notification ───────────────────────────────────────────────────────

function CguNotificationSection() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (dryRun) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post(`/superadmin/notify-cgu-update?dry_run=${dryRun}`);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de l\'opération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-800">Notification de mise à jour des CGU</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Envoie un email à tous les utilisateurs actifs dont la version CGU est différente de la version courante.
        Utilise d'abord le <strong>dry run</strong> pour voir combien d'utilisateurs seraient notifiés.
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Info className="w-4 h-4" />}
          Dry run (simulation)
        </button>
        <button
          onClick={() => run(false)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Envoyer les emails
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-lg border text-sm ${result.dry_run ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
          <p className="font-semibold mb-1 flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${result.dry_run ? 'text-blue-600' : 'text-green-600'}`} />
            {result.dry_run ? 'Simulation terminée' : 'Emails envoyés'}
          </p>
          <p className="text-gray-700">Version CGU : <strong>{result.cgu_version}</strong></p>
          {result.dry_run ? (
            <p className="text-gray-700">{result.message}</p>
          ) : (
            <>
              <p className="text-gray-700">Total concernés : <strong>{result.total}</strong></p>
              <p className="text-green-700">Envoyés : <strong>{result.sent}</strong></p>
              {result.errors > 0 && <p className="text-red-600">Erreurs : <strong>{result.errors}</strong></p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stripe Sync ─────────────────────────────────────────────────────────────

function StripeSyncSection() {
  const [checkResult, setCheckResult] = useState(null);
  const [fixResult, setFixResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setCheckResult(null);
    setFixResult(null);
    try {
      const res = await api.get('/superadmin/subscriptions/sync-check');
      setCheckResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors du check');
    } finally {
      setLoading(false);
    }
  };

  const runFix = async (dryRun) => {
    setLoading(true);
    setError(null);
    setFixResult(null);
    try {
      const res = await api.post(`/superadmin/subscriptions/sync-fix?dry_run=${dryRun}`);
      setFixResult({ ...res.data, dry_run: dryRun });
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors du fix');
    } finally {
      setLoading(false);
    }
  };

  const hasIssues = checkResult && checkResult.desync_count > 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="w-6 h-6 text-orange-600" />
        <h3 className="text-lg font-bold text-gray-800">Synchronisation Stripe ↔ Workspace</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Détecte et corrige les désynchronisations entre l'état Stripe (abonnement payé) et le workspace (non activé).
        Utile après un incident webhook.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={runCheck}
          disabled={loading}
          className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Info className="w-4 h-4" />}
          Détecter les désync
        </button>
        <button
          onClick={() => runFix(true)}
          disabled={loading}
          className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Info className="w-4 h-4" />}
          Fix dry run
        </button>
        <button
          onClick={() => runFix(false)}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Appliquer les corrections
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {checkResult && (
        <div className={`p-4 rounded-lg border text-sm mb-3 ${hasIssues ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
          <p className="font-semibold mb-2 flex items-center gap-2">
            {hasIssues
              ? <AlertTriangle className="w-4 h-4 text-orange-600" />
              : <CheckCircle className="w-4 h-4 text-green-600" />}
            {hasIssues ? `${checkResult.desync_count} désynchronisation(s) détectée(s)` : 'Tout est synchronisé'}
          </p>
          {hasIssues && checkResult.desynced_gerants?.map((g, i) => (
            <div key={i} className="text-xs text-gray-700 mt-1 pl-2 border-l-2 border-orange-300">
              <span className="font-medium">{g.email || g.gerant_id}</span>
              {g.stripe_status && <span className="ml-2 text-orange-600">Stripe: {g.stripe_status}</span>}
              {g.workspace_status && <span className="ml-2 text-red-600">Workspace: {g.workspace_status}</span>}
            </div>
          ))}
        </div>
      )}

      {fixResult && (
        <div className={`p-4 rounded-lg border text-sm ${fixResult.dry_run ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <p className="font-semibold mb-1 flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${fixResult.dry_run ? 'text-yellow-600' : 'text-green-600'}`} />
            {fixResult.dry_run ? 'Simulation fix terminée' : 'Corrections appliquées'}
          </p>
          {fixResult.fixed !== undefined && <p className="text-gray-700">Corrigés : <strong>{fixResult.fixed}</strong></p>}
          {fixResult.message && <p className="text-gray-700">{fixResult.message}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Tab principal ────────────────────────────────────────────────────────────

export default function ToolsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white mb-2">Outils d'administration</h2>
      <CguNotificationSection />
      <StripeSyncSection />
    </div>
  );
}
