import React from 'react';
import { CheckCircle, Activity } from 'lucide-react';

export default function OverviewTab({ stats }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Vue d'ensemble de la plateforme</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Statut système */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Statut système
          </h3>
          <div className="space-y-2 text-gray-600">
            <div className="flex justify-between"><span>Base de données</span><span className="text-green-600 font-medium">✓ Opérationnelle</span></div>
            <div className="flex justify-between"><span>API Backend</span><span className="text-green-600 font-medium">✓ Disponible</span></div>
            <div className="flex justify-between"><span>Services IA</span><span className="text-green-600 font-medium">✓ Actifs</span></div>
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-600" />
            Activité (7 derniers jours)
          </h3>
          <div className="space-y-2 text-gray-600">
            <div className="flex justify-between"><span>Nouvelles inscriptions</span><span className="text-gray-800 font-semibold">{stats?.activity.recent_signups_7d}</span></div>
            <div className="flex justify-between"><span>Analyses créées</span><span className="text-gray-800 font-semibold">{stats?.activity.recent_analyses_7d}</span></div>
            <div className="flex justify-between"><span>Total opérations IA</span><span className="text-gray-800 font-semibold">{stats?.usage.total_ai_operations}</span></div>
          </div>
        </div>
      </div>

      {/* Détails */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Détails des données</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500 font-medium mb-2">Workspaces</div>
            <div className="text-gray-700 space-y-1">
              <div>• {stats?.workspaces.active} actifs</div>
              <div>• {stats?.workspaces.trial} en essai</div>
              <div>• {stats?.workspaces.total} total</div>
            </div>
          </div>
          <div>
            <div className="text-gray-500 font-medium mb-2">Utilisateurs</div>
            <div className="text-gray-700 space-y-1">
              <div>• {stats?.users.total_active} actifs</div>
              <div>• {stats?.users.inactive} inactifs</div>
              <div>• {(stats?.users.all_managers ?? 0) + (stats?.users.all_sellers ?? 0)} total</div>
            </div>
          </div>
          <div>
            <div className="text-gray-500 font-medium mb-2">Abonnements</div>
            <div className="text-gray-700 space-y-1">
              <div>• {stats?.revenue.active_subscriptions} payants</div>
              <div>• {stats?.revenue.trial_subscriptions} en essai</div>
              <div>• {stats?.revenue.mrr}€ MRR</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
