import React, { useState, useEffect } from 'react';
import { X, Heart, RefreshCw } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getCompatibilityResult } from './guideProfilsData';

// Normalise les styles du diagnostic vendeur vers les clés de la matrice
const STYLE_TO_COMPAT = { 'Discret': 'Explorateur', 'Stratège': 'Technique' };
const normalizeStyle = (s) => STYLE_TO_COMPAT[s] || s;

export default function SellerManagerCompatibiliteModal({ diagnostic, onClose }) {
  const [managerDiag, setManagerDiag] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchManagerDiag = async () => {
    setLoading(true);
    try {
      const res = await api.get('/seller/manager-diagnostic');
      setManagerDiag(res.data);
    } catch (err) {
      logger.error('SellerManagerCompatibiliteModal fetch error:', err);
      setManagerDiag({ has_diagnostic: false, message: 'Impossible de charger le profil de ton manager.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManagerDiag(); }, []);

  const sellerStyle = diagnostic?.style || null;
  const managementType = managerDiag?.profil_nom?.replace(/^Le\s+/i, '') || null;
  const sellingStyleKey = sellerStyle ? normalizeStyle(sellerStyle) : null;
  const compat = (managementType && sellingStyleKey)
    ? getCompatibilityResult(managementType, sellingStyleKey)
    : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Comprendre mon manager</h2>
              <p className="text-white opacity-80 text-sm mt-0.5">Comment travailler efficacement ensemble</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchManagerDiag}
              disabled={loading}
              title="Rafraîchir"
              className="text-white opacity-70 hover:opacity-100 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all disabled:opacity-30"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-white opacity-70 hover:opacity-100 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Chargement...</div>
          ) : !managerDiag?.has_diagnostic ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-semibold text-gray-700">
                {managerDiag?.message || 'Ton manager n\'a pas encore complété son diagnostic.'}
              </p>
              <p className="text-sm mt-2">Reviens plus tard ou invite-le à compléter son profil.</p>
            </div>
          ) : (
            <>
              {/* Profils côte à côte */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200 text-center">
                  <p className="text-xs text-purple-600 font-semibold mb-1">TON MANAGER</p>
                  <p className="text-2xl mb-1">🎯</p>
                  <p className="font-bold text-gray-800">{managerDiag.profil_nom || 'Non défini'}</p>
                  {managerDiag.disc_style && (
                    <p className="text-xs text-gray-500 mt-1">Profil DISC : {managerDiag.disc_style}</p>
                  )}
                </div>
                <div className="bg-pink-50 rounded-xl p-4 border-2 border-pink-200 text-center">
                  <p className="text-xs text-pink-600 font-semibold mb-1">TON STYLE</p>
                  <p className="text-2xl mb-1">🎨</p>
                  <p className="font-bold text-gray-800">{sellerStyle || 'Non défini'}</p>
                  {diagnostic?.disc_dominant && (
                    <p className="text-xs text-gray-500 mt-1">Profil DISC : {diagnostic.disc_dominant}</p>
                  )}
                </div>
              </div>

              {/* Description du manager */}
              {managerDiag.profil_description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-bold text-gray-800 mb-2">👔 Son style de management</h4>
                  <p className="text-gray-700 text-sm">{managerDiag.profil_description}</p>
                  {(managerDiag.force_1 || managerDiag.force_2) && (
                    <ul className="mt-2 space-y-1">
                      {managerDiag.force_1 && (
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✓</span>{managerDiag.force_1}
                        </li>
                      )}
                      {managerDiag.force_2 && (
                        <li className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5">✓</span>{managerDiag.force_2}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {/* Compatibilité */}
              {compat ? (
                <>
                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{compat.title}</p>
                      <p className="text-gray-600 text-sm mt-1">{compat.description}</p>
                    </div>
                    <p className="text-3xl ml-4 flex-shrink-0">{compat.score}</p>
                  </div>

                  {compat.caracteristiques?.length > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h5 className="font-bold text-gray-800 mb-2">✨ Ce qui caractérise votre relation</h5>
                      <ul className="space-y-1">
                        {compat.caracteristiques.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-blue-500 mt-1">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommandations — focus vendeur */}
                  {compat.recommandations?.vendeur?.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5 border-2 border-purple-200">
                      <h5 className="font-bold text-purple-900 mb-3">💡 Comment t'adapter à ton manager</h5>
                      <ul className="space-y-2">
                        {compat.recommandations.vendeur.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-purple-900">
                            <span className="text-purple-600 mt-0.5">▸</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {compat.attention?.length > 0 && (
                    <div className="bg-orange-50 rounded-xl p-4">
                      <h5 className="font-bold text-orange-900 mb-2 text-sm">⚠️ Points d'attention</h5>
                      <ul className="space-y-1">
                        {compat.attention.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-orange-800">
                            <span className="text-orange-500 mt-0.5">!</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : sellerStyle && managementType ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Combinaison de profils non disponible dans la matrice.
                </div>
              ) : !sellerStyle ? (
                <div className="text-center py-6 text-gray-500">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="font-semibold">Complète ton diagnostic DISC pour voir ta compatibilité.</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
