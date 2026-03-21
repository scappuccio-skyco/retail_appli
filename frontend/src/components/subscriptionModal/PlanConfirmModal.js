import React from 'react';
import { Crown, Check, Loader } from 'lucide-react';
import { isSafeUrl, safeRedirect } from '../../utils/safeRedirect';
import { logger } from '../../utils/logger';
import { api } from '../../lib/apiClient';
import { toast } from 'sonner';
import { PLANS } from './plans';

export default function PlanConfirmModal({
  showPlanConfirmModal,
  planConfirmData,
  setPlanConfirmData,
  sellerCount,
  subscriptionInfo,
  handleProceedToPayment,
  processingPlan,
  handleQuantityChange,
  setShowPlanConfirmModal,
  setSelectedPlan,
  setSelectedQuantity,
  isAnnual,
  userRole,
  onClose,
}) {
  if (!showPlanConfirmModal || !planConfirmData) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowPlanConfirmModal(false);
          setPlanConfirmData(null);
        }
      }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`p-4 text-white ${
          planConfirmData.isUpgrade
            ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
            : 'bg-gradient-to-r from-blue-500 to-cyan-600'
        }`}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Confirmation du plan
          </h3>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Plan Selected */}
          <div className={`rounded-lg p-3 text-center border-2 ${
            planConfirmData.isUpgrade
              ? 'bg-purple-50 border-purple-300'
              : 'bg-blue-50 border-blue-300'
          }`}>
            <p className="text-sm opacity-75 font-semibold">Plan sélectionné</p>
            <p className="text-2xl font-black">{planConfirmData.planName}</p>
            <p className="text-sm mt-1">
              Tarification par paliers (calculée par Stripe)
            </p>
            {planConfirmData.isAnnual && (
              <p className="text-xs text-green-600 font-semibold mt-1">
                Économisez jusqu'à 20% avec l'abonnement annuel
              </p>
            )}
          </div>

          {/* Quantity Selector */}
          <div className="bg-gray-100 rounded-lg p-3 border border-gray-300">
            <p className="text-sm font-semibold mb-2">Nombre de sièges</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  const planInfo = PLANS[planConfirmData.planKey];
                  const newQty = Math.max(planConfirmData.quantity - 1, planInfo.minSellers, sellerCount);
                  setPlanConfirmData({
                    ...planConfirmData,
                    quantity: newQty
                  });
                }}
                className="w-10 h-10 bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-xl"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-4xl font-black">{planConfirmData.quantity}</span>
              </div>
              <button
                onClick={() => {
                  const planInfo = PLANS[planConfirmData.planKey];
                  const newQty = Math.min(planConfirmData.quantity + 1, planInfo.maxSellers);
                  setPlanConfirmData({
                    ...planConfirmData,
                    quantity: newQty
                  });
                }}
                className="w-10 h-10 bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-xl"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              Min: {Math.max(sellerCount, PLANS[planConfirmData.planKey].minSellers)} • Max: {PLANS[planConfirmData.planKey].maxSellers}
            </p>

            {sellerCount > PLANS[planConfirmData.planKey].minSellers && planConfirmData.quantity === Math.max(sellerCount, PLANS[planConfirmData.planKey].minSellers) && (
              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-xs text-orange-800 text-center">
                  ⚠️ Vous avez <strong>{sellerCount} vendeur{sellerCount > 1 ? 's' : ''} actif{sellerCount > 1 ? 's' : ''}</strong>. Pour réduire, suspendez d'abord des vendeurs.
                </p>
              </div>
            )}
          </div>

          {/* Quantity Summary */}
          {(() => {
            const currentSeats = subscriptionInfo?.subscription?.seats || 0;

            return (
              <>
                {/* Current Subscription (if exists) */}
                {currentSeats > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-300">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">📊 Abonnement actuel</span>
                      <span className="text-xl font-black text-gray-700">
                        {currentSeats} siège{currentSeats > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Le montant est géré par Stripe selon la tarification par paliers
                    </p>
                  </div>
                )}

                {/* New Subscription */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">📅 Nouveau nombre de sièges</span>
                    <span className="text-2xl font-black text-blue-700">
                      {planConfirmData.quantity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Le montant exact sera calculé par Stripe lors du paiement
                  </p>
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-3 border-t flex gap-2">
          <button
            onClick={() => {
              setShowPlanConfirmModal(false);
              setPlanConfirmData(null);
            }}
            className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all text-sm"
          >
            Annuler
          </button>
          <button
            onClick={async () => {
              setShowPlanConfirmModal(false);

              // Set selected plan and quantity
              setSelectedPlan(planConfirmData.planKey);
              setSelectedQuantity(planConfirmData.quantity);

              // Wait a bit for state to update, then call payment
              await new Promise(resolve => setTimeout(resolve, 100));

              // Close main modal and proceed to payment
              onClose();
              await new Promise(resolve => setTimeout(resolve, 300));

              try {
                const originUrl = globalThis.location.origin;

                // Use different endpoint based on user role
                const endpoint = userRole === 'gerant'
                  ? '/gerant/stripe/checkout'
                  : '/manager/stripe/checkout';

                const requestData = userRole === 'gerant'
                  ? {
                      origin_url: originUrl,
                      quantity: planConfirmData.quantity,
                      billing_period: isAnnual ? 'annual' : 'monthly'
                    }
                  : {
                      plan: planConfirmData.planKey,
                      origin_url: originUrl,
                      quantity: planConfirmData.quantity,
                      billing_period: isAnnual ? 'annual' : 'monthly'
                    };

                const response = await api.post(endpoint, requestData);

                // Handle both checkout_url (gerant) and url (manager) fields
                const checkoutUrl = response.data.checkout_url || response.data.url;
                if (checkoutUrl) {
                  if (!isSafeUrl(checkoutUrl)) {
                    logger.error('Open redirect blocked: URL not in allowlist', { url: checkoutUrl });
                    toast.error('Redirection non autorisée. Veuillez réessayer.');
                    return;
                  }
                  const finalTarget = checkoutUrl.startsWith('/') ? checkoutUrl : (isSafeUrl(checkoutUrl) ? checkoutUrl : '/');
                  safeRedirect(finalTarget, 'replace');
                } else if (response.data.success) {
                  globalThis.location.reload();
                }
              } catch (error) {
                logger.error('❌ Checkout error:', error);
                toast.error('Erreur lors de la création de la session');
                setTimeout(() => globalThis.location.reload(), 2000);
              }
            }}
            className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md text-sm"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
