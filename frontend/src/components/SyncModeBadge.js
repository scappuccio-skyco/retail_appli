import React from 'react';
import { Lock, Cloud } from 'lucide-react';
import { useSyncMode } from '../hooks/useSyncMode';

/**
 * Badge informatif affiché quand l'utilisateur est en mode synchronisation automatique.
 * Indique que les KPI sont synchronisés depuis un ERP et ne peuvent pas être modifiés manuellement.
 */
export default function SyncModeBadge() {
  const { isReadOnly, isEnterprise, companyName, loading } = useSyncMode();

  if (loading || !isReadOnly) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <div className="bg-blue-100 p-2 rounded-full">
          <Cloud className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-blue-900">
            Données synchronisées automatiquement
          </h3>
        </div>
        <p className="text-blue-700 text-sm">
          {isEnterprise && companyName ? (
            <>Vos données KPI sont synchronisées depuis le système ERP de <strong>{companyName}</strong>. Les modifications se font via votre système ERP.</>
          ) : (
            <>Vos données KPI sont synchronisées automatiquement depuis votre système ERP. Les modifications se font via votre système externe.</>
          )}
        </p>
        <p className="text-blue-600 text-sm mt-2 font-medium">
          ✅ Les Objectifs et Challenges peuvent toujours être créés et modifiés ici.
        </p>
      </div>
    </div>
  );
}
