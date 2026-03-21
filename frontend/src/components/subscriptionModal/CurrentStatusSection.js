import React from 'react';
import { Users } from 'lucide-react';
import { PLANS } from './plans';

export default function CurrentStatusSection({ subscriptionInfo, sellerCount, subscriptionHistory, currentPlan, onOpenInvoices, handleCancelSubscription, handleReactivateSubscription }) {
  return (
    <div className="mb-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        📊 Statut actuel
      </h3>
      {!subscriptionInfo || subscriptionInfo.status === 'no_subscription' ? (
        <div>
          <p className="text-gray-700 font-semibold">
            {subscriptionInfo?.message || "Aucun abonnement configuré"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Choisissez un plan ci-dessous pour commencer
          </p>
          {subscriptionInfo?.active_sellers_count !== undefined && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">Vendeurs actifs actuels</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-600">
                    {subscriptionInfo.active_sellers_count}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">vendeur{subscriptionInfo.active_sellers_count > 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                💡 Choisissez un plan adapté à votre nombre de vendeurs actifs
              </p>
            </div>
          )}
        </div>
      ) : null}
      {subscriptionInfo && subscriptionInfo.status === 'trialing' && (
          <div>
            <p className="text-gray-700">
              <span className="font-semibold">🎁 Essai gratuit</span> - {subscriptionInfo.days_left} jour{subscriptionInfo.days_left > 1 ? 's' : ''} restant{subscriptionInfo.days_left > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Fin de l'essai le {new Date(subscriptionInfo.trial_end).toLocaleDateString('fr-FR')}
            </p>

            {/* Vendeurs actifs pendant l'essai */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">Vendeurs actifs</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-600">
                    {subscriptionInfo.used_seats || sellerCount}
                  </span>
                  <span className="text-gray-500 mx-2">/</span>
                  <span className="text-xl font-semibold text-gray-700">
                    15
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">actuels / maximum</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                💡 Limite de 15 vendeurs pendant l'essai gratuit. Vous choisirez votre plan adapté après l'essai.
              </p>
              {subscriptionInfo.used_seats >= 15 && (
                <p className="text-xs text-orange-600 mt-2">
                  ⚠️ Limite atteinte. Vous pourrez ajouter plus de vendeurs en souscrivant à un plan payant.
                </p>
              )}
            </div>
          </div>
        )}
        {subscriptionInfo.status === 'active' && (
          <div>
            <p className="text-gray-700">
              <span className="font-semibold">Plan {PLANS[currentPlan].name}</span>
              {subscriptionInfo.subscription?.billing_interval && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  {subscriptionInfo.subscription.billing_interval === 'year' ? 'Annuel' : 'Mensuel'}
                </span>
              )}
              <span className="ml-2 text-green-600 font-medium">- Actif</span>
            </p>

            {/* Period information */}
            <div className="mt-2 space-y-1">
              {subscriptionInfo.subscription?.current_period_start && (
                <p className="text-sm text-gray-600">
                  📅 Début: {new Date(subscriptionInfo.subscription.current_period_start).toLocaleDateString('fr-FR')}
                </p>
              )}
              <p className="text-sm text-gray-600">
                {subscriptionInfo.subscription?.cancel_at_period_end ? (
                  <>
                    ⚠️ Annulation programmée - Accès jusqu'au {subscriptionInfo.subscription?.current_period_end ? new Date(subscriptionInfo.subscription.current_period_end).toLocaleDateString('fr-FR') : subscriptionInfo.period_end ? new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR') : 'N/A'}
                  </>
                ) : (
                  <>
                    🔄 Renouvellement: {subscriptionInfo.subscription?.current_period_end ? new Date(subscriptionInfo.subscription.current_period_end).toLocaleDateString('fr-FR') : subscriptionInfo.period_end ? new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR') : 'N/A'}
                  </>
                )}
              </p>
            </div>
            {/* Seats information */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">Sièges vendeurs</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-600">
                    {sellerCount}
                  </span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-xl font-semibold text-gray-700">
                    {subscriptionInfo.subscription?.seats || PLANS[currentPlan].maxSellers}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">actifs / achetés</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {onOpenInvoices && (
                <button
                  onClick={onOpenInvoices}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline"
                >
                  📄 Mes factures
                </button>
              )}
              {!subscriptionInfo.subscription?.cancel_at_period_end ? (
                <button
                  onClick={handleCancelSubscription}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Annuler l'abonnement
                </button>
              ) : (
                <button
                  onClick={handleReactivateSubscription}
                  className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                >
                  ✅ Réactiver l'abonnement
                </button>
              )}
            </div>
          </div>
        )}
        {subscriptionInfo && subscriptionInfo.status === 'trial_expired' && (
          <div>
            <p className="text-orange-700 font-semibold">
              ⚠️ Essai gratuit terminé
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Choisissez un plan pour continuer à utiliser toutes les fonctionnalités
            </p>
          </div>
        )}
        {subscriptionInfo && !['trialing', 'active', 'trial_expired', 'no_subscription', 'inactive'].includes(subscriptionInfo.status) && (
          <div>
            <p className="text-gray-700">
              <span className="font-semibold">Statut:</span> {subscriptionInfo.status}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Contactez le support si vous avez des questions sur votre abonnement
            </p>
          </div>
        )}
      </div>
  );
}
