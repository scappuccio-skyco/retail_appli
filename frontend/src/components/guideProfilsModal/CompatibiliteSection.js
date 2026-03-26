import React from 'react';
import { getCompatibilityResult } from '../guideProfilsData';

export default function CompatibiliteSection({ managerProfile, teamSellers, loadingCompatibility }) {
  return (
    <div className="space-y-6">
      {loadingCompatibility ? (
        <div className="text-center py-12">
          <div className="text-gray-600">Chargement de votre équipe...</div>
        </div>
      ) : (
        <>
          {managerProfile && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-300">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">👔 Votre Profil de Management</h3>
              <div className="flex items-center gap-3 mt-4">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center text-3xl">🎯</div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{managerProfile.management_style}</p>
                  <p className="text-gray-600 text-sm">{managerProfile.name || 'Manager'}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              🤝 Compatibilité avec votre équipe ({teamSellers.length} vendeur{teamSellers.length > 1 ? 's' : ''})
            </h3>

            {teamSellers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Aucun vendeur rattaché à votre équipe</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teamSellers.map((seller) => {
                  if (!seller.style_vente) {
                    return (
                      <div key={seller.id} className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-5 flex items-center gap-4">
                        <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center text-xl flex-shrink-0">👤</div>
                        <div>
                          <p className="font-bold text-gray-700">{seller.name}</p>
                          <p className="text-sm text-gray-400 mt-1">Pas encore de diagnostic — la compatibilité sera affichée une fois le profil complété.</p>
                        </div>
                      </div>
                    );
                  }

                  const managementType = (managerProfile?.management_style || 'Pilote').replace(/^Le\s+/i, '');
                  const sellingStyle = seller.style_vente.replace(/^(Le|La|L')\s+/i, '');
                  const compatibilityResult = getCompatibilityResult(managementType, sellingStyle);
                  if (!compatibilityResult) return null;

                  return (
                    <div key={seller.id} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 border-b-2 border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center text-xl">👤</div>
                            <div>
                              <p className="font-bold text-gray-800 text-lg">{seller.name}</p>
                              <p className="text-sm text-gray-600">Style : {seller.style_vente}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Compatibilité</p>
                            <p className="text-2xl">{compatibilityResult.score}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h4 className="text-lg font-bold text-gray-800 mb-1">{compatibilityResult.title}</h4>
                          <p className="text-gray-600">{compatibilityResult.description}</p>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-4">
                          <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2">✨ Caractéristiques de la relation</h5>
                          <ul className="space-y-1">
                            {compatibilityResult.caracteristiques.map((item, idx) => (
                              <li key={`compat-caract-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-blue-500 mt-1">•</span><span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-green-50 rounded-xl p-4">
                            <h5 className="font-bold text-green-900 mb-2 flex items-center gap-2 text-sm">✅ Forces</h5>
                            <ul className="space-y-1">
                              {compatibilityResult.forces.map((item, idx) => (
                                <li key={`compat-forces-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-green-800">
                                  <span className="text-[#10B981] mt-0.5">✓</span><span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-4">
                            <h5 className="font-bold text-orange-900 mb-2 flex items-center gap-2 text-sm">⚠️ Points d'attention</h5>
                            <ul className="space-y-1">
                              {compatibilityResult.attention.map((item, idx) => (
                                <li key={`compat-attention-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-orange-800">
                                  <span className="text-[#F97316] mt-0.5">!</span><span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {compatibilityResult.recommandations ? (
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5 border-2 border-purple-200">
                            <h5 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                              💡 Recommandations pour un fonctionnement optimal
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h6 className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">👔 Pour vous (Manager)</h6>
                                <ul className="space-y-2">
                                  {compatibilityResult.recommandations.manager.map((item, idx) => (
                                    <li key={`compat-reco-mgr-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-purple-900">
                                      <span className="text-purple-600 mt-0.5">▸</span><span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h6 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">👤 Pour {seller.name.split(' ')[0]}</h6>
                                <ul className="space-y-2">
                                  {compatibilityResult.recommandations.vendeur.map((item, idx) => (
                                    <li key={`compat-reco-vendeur-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-blue-900">
                                      <span className="text-blue-600 mt-0.5">▸</span><span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 text-sm py-2">
                            Recommandations non disponibles pour cette combinaison
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
