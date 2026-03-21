import React from 'react';
import { Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { calculateDaysRemaining } from './useTrialManagement';

export default function GerantTrialCard({
  gerant,
  editingTrial,
  newTrialEnd,
  setEditingTrial,
  setNewTrialEnd,
  onUpdateTrial,
}) {
  const daysRemaining = gerant.days_left !== undefined
    ? gerant.days_left
    : calculateDaysRemaining(gerant.trial_end);
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;
  const isEditing = editingTrial === gerant.id;

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        isExpired ? 'border-red-300 bg-red-50' :
        isExpiringSoon ? 'border-orange-300 bg-orange-50' :
        'border-gray-200 bg-white hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-800">{gerant.name}</h3>
            {gerant.subscription_status === 'active' ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Abonné
              </span>
            ) : gerant.subscription_status === 'trialing' || gerant.trial_end ? (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 ${
                isExpired ? 'bg-red-100 text-red-700' :
                isExpiringSoon ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                <Clock className="w-3 h-3" />
                {isExpired ? 'Expiré' : 'Essai'}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                Aucun essai
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-2">{gerant.email}</p>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <Users className="w-4 h-4" />
              <span>
                {gerant.active_sellers_count || 0}
                {gerant.max_sellers ? ` / ${gerant.max_sellers}` : ''} vendeurs actifs
              </span>
            </div>

            {(gerant.trial_end || gerant.days_left !== undefined) && (
              <div className={`flex items-center gap-1 ${
                isExpired ? 'text-red-600 font-semibold' :
                isExpiringSoon ? 'text-orange-600 font-semibold' :
                'text-gray-600'
              }`}>
                <Calendar className="w-4 h-4" />
                <span>
                  {isExpired ? 'Expiré depuis ' : 'Expire dans '}
                  {Math.abs(daysRemaining)} jour{Math.abs(daysRemaining) > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {gerant.trial_end && (
            <p className="text-xs text-gray-500 mt-2">
              Fin d'essai : {new Date(gerant.trial_end).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>

        <div className="ml-4">
          {!isEditing ? (
            <button
              onClick={() => {
                setEditingTrial(gerant.id);
                const defaultDate = gerant.trial_end
                  ? new Date(gerant.trial_end).toISOString().split('T')[0]
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                setNewTrialEnd(defaultDate);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Prolonger l'essai
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-600">
                Fin d'essai actuelle :
                <span className="ml-1 font-semibold text-gray-800">
                  {gerant.trial_end
                    ? new Date(gerant.trial_end).toLocaleDateString('fr-FR')
                    : 'Aucune'}
                </span>
              </div>
              <input
                type="date"
                value={newTrialEnd}
                onChange={(e) => setNewTrialEnd(e.target.value)}
                min={gerant.trial_end
                  ? new Date(gerant.trial_end).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
              />
              {newTrialEnd && (
                <div className="text-xs text-blue-700">
                  Nouvelle fin d'essai :
                  <span className="ml-1 font-semibold">
                    {new Date(newTrialEnd).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateTrial(gerant.id)}
                  className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Valider
                </button>
                <button
                  onClick={() => { setEditingTrial(null); setNewTrialEnd(''); }}
                  className="flex-1 px-3 py-1.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
