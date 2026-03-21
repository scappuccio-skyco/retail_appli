import React from 'react';
import { Users, Loader, Check } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

export default function SeatManagementSection({ subscriptionInfo, sellerCount, newSeatsCount, setNewSeatsCount, adjustingSeats, setAdjustingSeats, seatsPreview, loadingPreview, handleChangeSeats, subscriptionHistory, fetchSubscriptionStatus }) {
  return (
    <div className="mb-8">
      <details className="bg-white rounded-xl border-2 border-green-200 overflow-hidden" open>
        <summary className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7" />
            Gérer mes sièges vendeurs
            <span className="ml-auto text-sm font-normal opacity-75">▼ Cliquez pour développer</span>
          </h3>
          <p className="text-green-50 text-sm mt-1">
            Ajustez votre capacité en temps réel
          </p>
        </summary>

        <div className="bg-white p-6">
          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-700 mb-1">Sièges achetés</p>
              <p className="text-2xl font-black text-blue-900">{subscriptionInfo.subscription.seats || 1}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-700 mb-1">Vendeurs actifs</p>
              <p className="text-2xl font-black text-green-900">{sellerCount}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
              <p className="text-xs font-semibold text-purple-700 mb-1">Sièges libres</p>
              <p className="text-2xl font-black text-purple-900">
                {(subscriptionInfo.subscription.seats || 1) - sellerCount}
              </p>
            </div>
          </div>

          {/* Adjustment Section */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">

            {/* Adjust buttons */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setNewSeatsCount(Math.max(sellerCount, newSeatsCount - 1))}
                disabled={adjustingSeats || newSeatsCount <= sellerCount}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <span className="text-xl">−</span> Retirer 1
              </button>

              <input
                type="number"
                min={sellerCount}
                max={15}
                value={newSeatsCount}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value) || sellerCount;
                  setNewSeatsCount(Math.max(sellerCount, Math.min(15, val)));
                }}
                disabled={adjustingSeats}
                className="w-24 text-center text-2xl font-bold border-3 border-green-500 rounded-lg py-3 focus:ring-4 focus:ring-green-200 focus:outline-none disabled:bg-gray-100 shadow-md"
              />

              <button
                onClick={() => setNewSeatsCount(Math.min(15, newSeatsCount + 1))}
                disabled={adjustingSeats || newSeatsCount >= 15}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <span className="text-xl">+</span> Ajouter 1
              </button>
            </div>

            {/* Warning when can't reduce */}
            {newSeatsCount <= sellerCount && (
              <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    !
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-orange-800 mb-1">
                      Impossible de réduire en dessous de {sellerCount} siège{sellerCount > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-orange-700">
                      Vous avez actuellement <strong>{sellerCount} vendeur{sellerCount > 1 ? 's' : ''} actif{sellerCount > 1 ? 's' : ''}</strong>.
                      Pour réduire votre abonnement, veuillez d'abord mettre en sommeil ou supprimer des vendeurs dans <strong>"Mon Équipe"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview of change with cost calculation */}
            {newSeatsCount !== (subscriptionInfo.subscription.seats || 1) && (
              <div className="mb-3 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs opacity-75">Changement prévu</p>
                    <p className="text-lg font-bold">
                      {(subscriptionInfo.subscription.seats || 1)} → {newSeatsCount} sièges
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded font-bold text-lg ${newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? 'bg-green-400 text-green-900' : 'bg-orange-400 text-orange-900'}`}>
                    {newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? '+' : ''}
                    {newSeatsCount - (subscriptionInfo.subscription.seats || 1)}
                  </div>
                </div>

                {/* Cost preview from API or fallback */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 space-y-1">
                  {loadingPreview ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-sm">Calcul du coût...</span>
                    </div>
                  ) : seatsPreview ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Prix par siège :</span>
                        <span className="font-bold">
                          {Math.round(seatsPreview.new_monthly_cost / seatsPreview.new_seats)}€/mois
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Coût mensuel actuel :</span>
                        <span className="font-bold">{seatsPreview.current_monthly_cost}€/mois</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span>Coût mensuel futur :</span>
                        <span className={seatsPreview.is_upgrade ? 'text-green-200' : 'text-orange-200'}>
                          {seatsPreview.new_monthly_cost}€/mois
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-white/30">
                        <span>Différence mensuelle :</span>
                        <span className={`font-bold ${seatsPreview.price_difference >= 0 ? 'text-green-200' : 'text-orange-200'}`}>
                          {seatsPreview.price_difference >= 0 ? '+' : ''}{seatsPreview.price_difference}€
                        </span>
                      </div>
                      {seatsPreview.is_trial ? (
                        <div className="mt-2 pt-2 border-t border-white/30">
                          <p className="text-xs opacity-90">
                            💡 Pendant l'essai, aucun frais ne sera appliqué.
                            Le paiement débutera à la fin de la période d'essai.
                          </p>
                        </div>
                      ) : seatsPreview.is_upgrade && seatsPreview.proration_estimate > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/30 bg-white/10 rounded p-2">
                          <p className="text-sm font-semibold">
                            💳 Coût proratisé estimé : ~{seatsPreview.proration_estimate.toFixed(2)}€
                          </p>
                          <p className="text-xs opacity-90 mt-1">
                            Ce montant sera facturé immédiatement pour la période en cours.
                          </p>
                        </div>
                      )}
                      {!seatsPreview.is_upgrade && !seatsPreview.is_trial && (
                        <div className="mt-2 pt-2 border-t border-white/30">
                          <p className="text-xs opacity-90">
                            ⚠️ La réduction sera effective au prochain renouvellement.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    // Fallback if API fails
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Prix par siège :</span>
                        <span className="font-bold">Tarification par paliers</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Coût mensuel futur :</span>
                        <span className="font-bold">Calculé par Stripe</span>
                      </div>
                      {subscriptionInfo.status === 'trialing' && subscriptionInfo.days_left !== null && (
                        <div className="mt-2 pt-2 border-t border-white/30">
                          <p className="text-xs opacity-90">
                            💡 Pendant l'essai ({subscriptionInfo.days_left} jours restants), aucun frais ne sera appliqué.
                          </p>
                        </div>
                      )}
                      {subscriptionInfo.status === 'active' && newSeatsCount > (subscriptionInfo.subscription.seats || 1) && (
                        <div className="mt-2 pt-2 border-t border-white/30">
                          <p className="text-xs opacity-90">
                            ℹ️ Un coût proratisé sera appliqué pour les sièges ajoutés en cours de cycle.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                const currentSeats = subscriptionInfo.subscription.seats || 1;
                const diff = newSeatsCount - currentSeats;

                if (newSeatsCount === currentSeats) return;

                setAdjustingSeats(true);

                try {
                  // Call the new update-seats endpoint
                  const response = await api.post(
                    '/gerant/subscription/update-seats',
                    { seats: newSeatsCount }
                  );

                  if (response.data.success) {
                    toast.success(
                      response.data.message,
                      {
                        duration: 5000,
                        description: response.data.is_trial
                          ? `Nouveau coût mensuel après l'essai : ${response.data.new_monthly_cost}€`
                          : response.data.proration_amount > 0
                            ? `Coût proratisé immédiat : ${response.data.proration_amount}€`
                            : `Nouveau coût mensuel : ${response.data.new_monthly_cost}€`
                      }
                    );

                    // Refresh subscription info
                    await fetchSubscriptionStatus();

                    // Reset the seats count to match new value
                    setNewSeatsCount(response.data.new_seats);
                  }
                } catch (error) {
                  logger.error('Error updating seats:', error);
                  toast.error(
                    error.response?.data?.detail || 'Erreur lors de la mise à jour des sièges',
                    { duration: 6000 }
                  );
                } finally {
                  setAdjustingSeats(false);
                }
              }}
              disabled={adjustingSeats || newSeatsCount === (subscriptionInfo.subscription.seats || 1)}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
            >
              {adjustingSeats ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  Mise à jour en cours...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  {subscriptionInfo.status === 'trialing' ? 'Mettre à jour (Sans frais)' : 'Mettre à jour l\'abonnement'}
                </span>
              )}
            </button>
          </div>

          {/* History */}
          {subscriptionHistory.length > 0 && (
            <div className="px-6 pb-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  📊 Historique des modifications ({subscriptionHistory.length})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {subscriptionHistory.map((entry, idx) => (
                    <div key={entry.id || idx} className="text-sm p-2 bg-white rounded border-l-4 border-blue-400">
                      <p className="font-semibold text-gray-700">
                        {entry.action === 'created' && '🎉 Abonnement créé'}
                        {entry.action === 'seats_added' && '➕ Sièges ajoutés'}
                        {entry.action === 'seats_removed' && '➖ Sièges réduits'}
                        {entry.action === 'upgraded' && '⬆️ Mise à niveau'}
                        {entry.action === 'downgraded' && '⬇️ Réduction'}
                      </p>
                      <p className="text-gray-600">
                        {entry.previous_seats && entry.new_seats && (
                          <>{entry.previous_seats} → {entry.new_seats} siège(s)</>
                        )}
                        {entry.previous_plan !== entry.new_plan && entry.new_plan && (
                          <> • Plan: {entry.new_plan}</>
                        )}
                      </p>
                      {entry.amount_charged !== null && entry.amount_charged !== undefined && (
                        <p className={`text-xs ${entry.amount_charged >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          {entry.amount_charged >= 0 ? 'Facturé' : 'Crédité'}: {Math.abs(entry.amount_charged).toFixed(2)}€
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
