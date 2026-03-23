import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Store, ArrowRight, Calendar } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

export default function SellerPassportModal({ seller, onClose }) {
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPassport = async () => {
      try {
        const res = await api.get(`/gerant/sellers/${seller.id}/passport`);
        setPassport(res.data);
      } catch (err) {
        logger.error('Erreur chargement passeport vendeur:', err);
        setError('Impossible de charger le passeport vendeur.');
      } finally {
        setLoading(false);
      }
    };
    fetchPassport();
  }, [seller.id]);

  const fmtCA = (n) => n ? `${Math.round(n).toLocaleString('fr-FR')} €` : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-2xl relative flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white">Passeport Vendeur</h2>
          <p className="text-white opacity-90 text-sm mt-1">{seller.name} — historique cross-magasin</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Chargement...</p>
            </div>
          )}
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          {passport && (
            <>
              {/* Métriques globales */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Métriques globales (tous magasins)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'CA total', value: fmtCA(passport.global_metrics.total_ca) },
                    { label: 'Ventes', value: passport.global_metrics.total_ventes || '—' },
                    { label: 'Panier moyen', value: fmtCA(passport.global_metrics.panier_moyen) },
                    { label: 'Taux transf.', value: passport.global_metrics.taux_transformation ? `${passport.global_metrics.taux_transformation}%` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-purple-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Par magasin */}
              {passport.store_stats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Store className="w-4 h-4" /> Performance par magasin
                  </h3>
                  <div className="space-y-2">
                    {passport.store_stats.map((s) => (
                      <div
                        key={s.store_id}
                        className={`rounded-xl p-4 border ${s.is_current_store ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 flex items-center gap-2">
                              {s.store_name}
                              {s.is_current_store && (
                                <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-medium">Actuel</span>
                              )}
                            </p>
                            {s.store_location && <p className="text-xs text-gray-500">{s.store_location}</p>}
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {fmtDate(s.first_date)} → {fmtDate(s.last_date)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-gray-900">{fmtCA(s.total_ca)}</p>
                            <p className="text-xs text-gray-500">{s.total_ventes} ventes</p>
                            {s.panier_moyen > 0 && <p className="text-xs text-gray-400">Panier : {fmtCA(s.panier_moyen)}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historique de transferts */}
              {passport.transfer_history.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" /> Historique de transferts
                  </h3>
                  <div className="space-y-2">
                    {[...passport.transfer_history].reverse().map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-2">
                        <span className="text-gray-400 text-xs">{new Date(t.transferred_at).toLocaleDateString('fr-FR')}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{t.to_store_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {passport.store_stats.length === 0 && passport.transfer_history.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Aucune donnée KPI disponible pour ce vendeur.</p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
