import React from 'react';
import { Sparkles } from 'lucide-react';
import { getCompatibilityResult } from '../guideProfilsData';

// Normalise les styles du diagnostic vers les clés de la matrice de compatibilité
const STYLE_TO_COMPAT = {
  'Discret':    'Explorateur',
  'Empathique': 'Explorateur',
  'Relationnel':'Convivial',
  'Stratège':   'Technique',
};
const normalizeSellingStyle = (style) => STYLE_TO_COMPAT[style] || style;

function DataUsedBadge({ managerFullDiagnostic, sellerStyle }) {
  if (!managerFullDiagnostic) return null;
  const disc = managerFullDiagnostic.disc_percentages || {};
  const dom = managerFullDiagnostic.disc_dominant;
  const hasDisc = disc.D !== undefined;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        🔍 Données utilisées pour cette analyse
      </p>
      <div className="flex flex-wrap gap-2">
        {hasDisc && (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
            DISC manager : D{disc.D}% I{disc.I}% S{disc.S}% C{disc.C}%
            {dom ? ` (dominant ${dom})` : ''}
          </span>
        )}
        {managerFullDiagnostic.profil_nom && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
            Style : {managerFullDiagnostic.profil_nom}
          </span>
        )}
        {managerFullDiagnostic.force_1 && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
            Force : {managerFullDiagnostic.force_1}
          </span>
        )}
        {managerFullDiagnostic.axe_progression && (
          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
            Axe dev. : {managerFullDiagnostic.axe_progression}
          </span>
        )}
        {sellerStyle && (
          <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded-full font-medium">
            Style vendeur : {sellerStyle}
          </span>
        )}
      </div>
    </div>
  );
}

function AIAdviceSection({ advice, sellerFirstName, isLoading, hasAdvice, onGenerate, canGenerate }) {
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200">
      <div className="flex items-center justify-between mb-3">
        <h5 className="font-bold text-indigo-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Conseils IA personnalisés
        </h5>
        {canGenerate && (
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isLoading ? (
              <>⏳ Génération...</>
            ) : hasAdvice ? (
              <>🔄 Régénérer</>
            ) : (
              <><Sparkles className="w-3 h-3" /> Générer</>
            )}
          </button>
        )}
      </div>

      {!hasAdvice && !isLoading && (
        <p className="text-sm text-indigo-700 opacity-70">
          Cliquez sur "Générer" pour obtenir des conseils personnalisés basés sur votre profil DISC réel et le style de vente de {sellerFirstName}.
        </p>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-indigo-700 py-2">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Analyse en cours...
        </div>
      )}

      {hasAdvice && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h6 className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">
              👔 Pour vous (Manager)
            </h6>
            <ul className="space-y-2">
              {(advice.manager || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-purple-900">
                  <span className="text-purple-500 mt-0.5 shrink-0">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h6 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
              👤 Pour {sellerFirstName}
            </h6>
            <ul className="space-y-2">
              {(advice.seller || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-blue-900">
                  <span className="text-blue-500 mt-0.5 shrink-0">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompatibiliteSection({
  managerProfile,
  managerFullDiagnostic,
  teamSellers,
  loadingCompatibility,
  aiCompatibilityAdvice = {},
  loadingAdviceIds = new Set(),
  onGenerateAdvice,
}) {
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
                  {managerFullDiagnostic?.disc_percentages && (
                    <div className="flex gap-2 mt-1">
                      {['D', 'I', 'S', 'C'].map(k => (
                        <span key={k} className="text-xs font-bold bg-white border border-blue-200 rounded px-1.5 py-0.5 text-blue-700">
                          {k} {managerFullDiagnostic.disc_percentages[k] || 0}%
                        </span>
                      ))}
                    </div>
                  )}
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
                  const sellingStyle = normalizeSellingStyle(seller.style_vente.replace(/^(Le|La|L')\s+/i, ''));
                  const compatibilityResult = getCompatibilityResult(managementType, sellingStyle);
                  if (!compatibilityResult) return null;

                  const sellerId = seller.id;
                  const aiAdvice = aiCompatibilityAdvice[sellerId];
                  const isLoadingAdvice = loadingAdviceIds.has(sellerId);
                  const sellerFirstName = seller.name.split(' ')[0];
                  const canGenerate = !!managerFullDiagnostic?.disc_percentages;

                  return (
                    <div key={sellerId} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
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
                              <li key={`compat-caract-${idx}`} className="flex items-start gap-2 text-sm text-gray-700">
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
                                <li key={`compat-forces-${idx}`} className="flex items-start gap-2 text-xs text-green-800">
                                  <span className="text-[#10B981] mt-0.5">✓</span><span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-4">
                            <h5 className="font-bold text-orange-900 mb-2 flex items-center gap-2 text-sm">⚠️ Points d'attention</h5>
                            <ul className="space-y-1">
                              {compatibilityResult.attention.map((item, idx) => (
                                <li key={`compat-attention-${idx}`} className="flex items-start gap-2 text-xs text-orange-800">
                                  <span className="text-[#F97316] mt-0.5">!</span><span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Section recommandations IA personnalisées */}
                        <DataUsedBadge
                          managerFullDiagnostic={managerFullDiagnostic}
                          sellerStyle={seller.style_vente}
                        />
                        <AIAdviceSection
                          advice={aiAdvice}
                          sellerFirstName={sellerFirstName}
                          isLoading={isLoadingAdvice}
                          hasAdvice={!!aiAdvice}
                          onGenerate={() => onGenerateAdvice(seller)}
                          canGenerate={canGenerate}
                        />

                        {/* Recommandations statiques en fallback si pas d'IA */}
                        {!aiAdvice && !isLoadingAdvice && compatibilityResult.recommandations && (
                          <details className="text-xs text-gray-400 cursor-pointer">
                            <summary className="hover:text-gray-600 transition-colors">
                              Voir les recommandations génériques (non personnalisées)
                            </summary>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="font-semibold text-gray-600 mb-1">👔 Manager (générique)</p>
                                <ul className="space-y-1">
                                  {compatibilityResult.recommandations.manager.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-1 text-gray-500">
                                      <span className="mt-0.5">▸</span><span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-600 mb-1">👤 Vendeur (générique)</p>
                                <ul className="space-y-1">
                                  {compatibilityResult.recommandations.vendeur.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-1 text-gray-500">
                                      <span className="mt-0.5">▸</span><span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </details>
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
