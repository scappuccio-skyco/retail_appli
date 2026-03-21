import React from 'react';
import { CheckCircle, Activity } from 'lucide-react';

export default function OverviewTab({ stats }) {
  return (
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
            <div className="flex justify-between"><span>Base de données</span><span className="text-green-400 font-medium">✓ Opérationnelle</span></div>
            <div className="flex justify-between"><span>API Backend</span><span className="text-green-400 font-medium">✓ Disponible</span></div>
            <div className="flex justify-between"><span>Services IA</span><span className="text-green-400 font-medium">✓ Actifs</span></div>
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400" />
            Activité (7 derniers jours)
          </h3>
          <div className="space-y-2 text-purple-200">
            <div className="flex justify-between"><span>Nouvelles inscriptions</span><span className="text-white font-medium">{stats?.activity.recent_signups_7d}</span></div>
            <div className="flex justify-between"><span>Analyses créées</span><span className="text-white font-medium">{stats?.activity.recent_analyses_7d}</span></div>
            <div className="flex justify-between"><span>Total opérations IA</span><span className="text-white font-medium">{stats?.usage.total_ai_operations}</span></div>
          </div>
        </div>
      </div>

      {/* Détails */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">📊 Détails des données</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-purple-300 mb-2">Workspaces</div>
            <div className="text-white">
              • {stats?.workspaces.active} actifs<br />
              • {stats?.workspaces.trial} en essai<br />
              • {stats?.workspaces.total} total
            </div>
          </div>
          <div>
            <div className="text-purple-300 mb-2">Utilisateurs</div>
            <div className="text-white">
              • {stats?.users.total_active} actifs<br />
              • {stats?.users.inactive} inactifs<br />
              • {(stats?.users.all_managers ?? 0) + (stats?.users.all_sellers ?? 0)} total
            </div>
          </div>
          <div>
            <div className="text-purple-300 mb-2">Abonnements</div>
            <div className="text-white">
              • {stats?.revenue.active_subscriptions} payants<br />
              • {stats?.revenue.trial_subscriptions} en essai<br />
              • {stats?.revenue.mrr}€ MRR
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
