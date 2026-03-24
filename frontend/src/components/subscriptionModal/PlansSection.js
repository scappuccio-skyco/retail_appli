import React from 'react';
import { Crown, Check, Loader, Users, Star, Tag } from 'lucide-react';
import { PLANS } from './plans';

export default function PlansSection({ subscriptionInfo, currentPlan, isActive, isAnnual, sellerCount, processingPlan, loadingIntervalSwitch, handleIntervalToggleClick, handleSelectPlan, promoCode, setPromoCode, promoStatus, handleValidatePromo }) {
  return (
    <>
      {/* Plans */}
      <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
        Choisissez votre plan
      </h3>

      {/* Promo Code */}
      <div className="flex justify-center mb-6">
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="J'ai un code promo"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleValidatePromo(); }}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-colors ${
                  promoStatus === 'valid' ? 'border-green-500 bg-green-50' :
                  promoStatus === 'invalid' ? 'border-red-400 bg-red-50' :
                  'border-gray-300'
                }`}
              />
            </div>
            <button
              onClick={handleValidatePromo}
              disabled={!promoCode.trim() || promoStatus === 'checking'}
              className="px-4 py-2 bg-[#1E40AF] text-white text-sm rounded-lg hover:bg-[#1E3A8A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {promoStatus === 'checking' ? <Loader className="w-4 h-4 animate-spin" /> : 'Valider'}
            </button>
          </div>
          {promoStatus === 'valid' && (
            <p className="text-sm text-green-600 font-semibold flex items-center gap-1">
              ✅ Code fondateur activé — tarif préférentiel appliqué
            </p>
          )}
          {promoStatus === 'invalid' && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              ❌ Code invalide
            </p>
          )}
        </div>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center items-center gap-4 mb-16">
        <span className={`text-lg font-semibold ${!isAnnual ? 'text-[#1E40AF]' : 'text-slate-400'}`}>
          Mensuel
        </span>
        <button
          onClick={handleIntervalToggleClick}
          disabled={loadingIntervalSwitch}
          className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
            isAnnual ? 'bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A]' : 'bg-slate-300'
          } ${loadingIntervalSwitch ? 'opacity-50 cursor-wait' : ''}`}
        >
          {loadingIntervalSwitch ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="w-4 h-4 text-white animate-spin" />
            </div>
          ) : (
            <div
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                isAnnual ? 'transform translate-x-8' : ''
              }`}
            />
          )}
        </button>
        <span className={`text-lg font-semibold ${isAnnual ? 'text-[#1E40AF]' : 'text-slate-400'}`}>
          Annuel
        </span>
        {isAnnual && (
          <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
            Économisez 20%
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(PLANS).map(([planKey, plan]) => {
          // Get current subscription billing period from Stripe data
          const currentBillingPeriod = subscriptionInfo?.subscription?.billing_interval || 'month';
          const selectedBillingPeriod = isAnnual ? 'year' : 'month';

          // Check if this is the current plan AND same billing period
          const isCurrentPlan = isActive && currentPlan === planKey && currentBillingPeriod === selectedBillingPeriod;
          const isProcessing = processingPlan === planKey;
          const isEnterprise = plan.isEnterprise;
          const isRecommended = plan.isRecommended;

          return (
            <div
              key={`${planKey}-${isAnnual ? 'annual' : 'monthly'}`}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
              style={{ border: `2px solid ${plan.color}` }}
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2" style={{ color: plan.color }}>{plan.name}</h3>
                <p className="text-[#334155] mb-4">{plan.subtitle}</p>
                {isEnterprise ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-3xl font-bold" style={{ color: plan.color }}>Sur devis</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold mt-2">16+ espaces vendeur</p>
                    <p className="text-xs text-gray-600 mt-1">+ Espace Gérant & Manager inclus</p>
                  </div>
                ) : !isAnnual ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-3xl font-bold" style={{ color: plan.color }}>
                        Tarification par paliers
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm font-semibold mt-2 text-green-600">
                      {plan.minSellers} à {plan.maxSellers} espaces vendeur
                    </p>
                    <p className="text-xs text-gray-600 mt-1">+ Espace Gérant & Manager inclus</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-3xl font-bold" style={{ color: plan.color }}>
                        Tarification par paliers
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      {plan.minSellers} à {plan.maxSellers} espaces vendeur
                    </p>
                    <p className="text-xs text-green-600 mt-1 font-semibold">Économisez jusqu'à 20% avec l'abonnement annuel</p>
                  </div>
                )}
              </div>

              {/* Main Features */}
              <ul className="space-y-3 mb-4">
                {plan.mainFeatures.map((feature, idx) => (
                  <li key={`plan-${planKey}-main-${idx}-${feature.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Specs section */}
              <div className="my-4 pt-4" style={{ borderTop: `1px solid ${plan.color}40` }}>
                <p className="text-sm font-semibold mb-3" style={{ color: plan.color }}>
                  Spécificités :
                </p>
                <ul className="space-y-3 mb-4">
                  {plan.specs.map((spec, idx) => (
                    <li key={`plan-${planKey}-spec-${idx}-${spec.substring(0, 15)}`} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                      <span className="text-[#334155] font-medium">{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warning if too many sellers */}
              {!isEnterprise && plan.maxSellers && sellerCount > plan.maxSellers && !isCurrentPlan && (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-lg shadow-md">
                  <p className="text-base text-red-800 font-bold flex items-center gap-2">
                    <span className="text-2xl">🚫</span> Plan non disponible
                  </p>
                  <p className="text-sm text-red-700 mt-2 font-semibold">
                    Vous avez actuellement <strong>{sellerCount} vendeurs actifs</strong>, mais ce plan est limité à <strong>{plan.maxSellers} vendeurs maximum</strong>.
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    💡 Pour utiliser ce plan, vous devez d'abord suspendre ou supprimer {sellerCount - plan.maxSellers} vendeur{sellerCount - plan.maxSellers > 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              {isCurrentPlan ? (
                <button
                  disabled
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold"
                >
                  ✓ Plan actuel {isAnnual ? '(Annuel)' : '(Mensuel)'}
                </button>
              ) : isEnterprise ? (
                <a
                  href="mailto:contact@retailperformerai.com?subject=Demande d'information - Plan Large Team"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  📧 Nous contacter
                </a>
              ) : (
                <>
                  {/* Check if trying to downgrade from annual to monthly (not allowed) */}
                  {isActive && currentPlan === planKey && currentBillingPeriod === 'year' && selectedBillingPeriod === 'month' ? (
                    <div className="w-full">
                      <button
                        disabled
                        className="w-full py-3 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed opacity-50"
                      >
                        Non disponible
                      </button>
                      <p className="text-xs text-orange-600 mt-2 text-center">
                        ⚠️ Impossible de passer d'annuel à mensuel. Veuillez annuler votre abonnement actuel.
                      </p>
                    </div>
                  ) : (plan.maxSellers && sellerCount > plan.maxSellers) ? (
                    <button
                      disabled
                      className="w-full py-3 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed opacity-50"
                    >
                      🚫 Non disponible
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(planKey)}
                      disabled={isProcessing}
                      className="w-full py-3 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: plan.color }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = plan.colorHover}
                      onMouseLeave={(e) => e.target.style.backgroundColor = plan.color}
                    >
                      {isProcessing ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Redirection...
                        </>
                      ) : (
                        <>
                          <Crown className="w-5 h-5" />
                          {isActive && currentPlan === planKey && currentBillingPeriod === 'month' && selectedBillingPeriod === 'year'
                            ? "Passer à l'annuel"
                            : isActive
                            ? 'Changer de plan'
                            : 'Choisir ce plan'}
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-8 space-y-3">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            💳 Paiement sécurisé par Stripe • ✅ Annulation à tout moment • 📧 Support inclus
          </p>
        </div>

        {/* Billing period change notice */}
        {isActive && subscriptionInfo.subscription?.billing_interval === 'year' && !isAnnual && (
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800 text-center font-semibold">
              ℹ️ Vous avez un abonnement annuel. Le passage à un abonnement mensuel n'est pas possible. Pour changer, vous devez annuler votre abonnement actuel et souscrire un nouveau plan mensuel.
            </p>
          </div>
        )}

        {isActive && subscriptionInfo.subscription?.billing_interval === 'month' && isAnnual && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 text-center font-semibold">
              💰 Économisez 20% en passant à la facturation annuelle !
            </p>
          </div>
        )}
      </div>
    </>
  );
}
