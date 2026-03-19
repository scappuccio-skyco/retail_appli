import React, { useState } from 'react';
import { Cloud } from 'lucide-react';
import { useSyncMode } from '../hooks/useSyncMode';

/**
 * Pill discret affiché uniquement quand les KPI sont synchronisés via API (sync_mode != "manual").
 * N'apparaît PAS si l'abonnement est simplement expiré en mode manuel.
 */
export default function SyncModeBadge() {
  const { syncMode, companyName, loading } = useSyncMode();
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading || syncMode === 'manual') {
    return null;
  }

  const tooltipText = companyName
    ? `KPI synchronisés depuis le système ERP de ${companyName}. Les modifications se font via votre système externe.`
    : `KPI synchronisés automatiquement depuis votre système ERP. Les modifications se font via votre système externe.`;

  return (
    <div className="relative inline-flex mb-4">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full text-xs font-medium transition-colors cursor-default"
      >
        <Cloud className="w-3.5 h-3.5 text-slate-400" />
        <span>KPI synchronisés</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      </button>

      {showTooltip && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 shadow-lg leading-relaxed pointer-events-none">
          {tooltipText}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 rotate-45" />
        </div>
      )}
    </div>
  );
}
