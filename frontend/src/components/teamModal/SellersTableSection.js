import React, { useMemo, useRef } from 'react';
import { Info, FileText, BookUser } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const ROW_HEIGHT = 57; // px — hauteur fixe de chaque ligne
const VISIBLE_ROWS = 8; // lignes visibles avant scroll

function NiveauBadge({ niveau, showText = true }) {
  const colorClass =
    (niveau === 'Maître du Jeu' || niveau === 'Expert') ? 'bg-red-100 text-red-800' :
    (niveau === 'Ambassadeur' || niveau === 'Confirmé') ? 'bg-orange-100 text-orange-800' :
    niveau === 'Challenger' ? 'bg-yellow-100 text-yellow-800' :
    (niveau === 'Nouveau Talent' || niveau === 'Explorateur' || niveau === 'Apprenti') ? 'bg-green-100 text-green-800' :
    'bg-gray-100 text-gray-800';

  const emoji =
    (niveau === 'Maître du Jeu' || niveau === 'Expert') ? '🔴' :
    (niveau === 'Ambassadeur' || niveau === 'Confirmé') ? '🟠' :
    niveau === 'Challenger' ? '🟡' :
    (niveau === 'Nouveau Talent' || niveau === 'Explorateur' || niveau === 'Apprenti') ? '⚡' :
    '';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      {emoji}{showText && niveau ? ` ${niveau}` : ''}
    </span>
  );
}

export default function SellersTableSection({
  teamData,
  sellers,
  searchQuery,
  setSearchQuery,
  hiddenSellerIds,
  isUpdating,
  periodFilter,
  customDateRange,
  userRole,
  storeIdParam,
  user,
  showNiveauTooltip,
  setShowNiveauTooltip,
  onViewSellerDetail,
  onPassport,
  setShowEvaluationModal,
  setSelectedSellerForEval,
  refreshSellersData,
  fetchTeamData,
  isGerantWithoutStore,
}) {
  const parentRef = useRef(null);

  // Calcul filtré mémoïsé — ne recalcule que si les dépendances changent
  const filteredSellers = useMemo(() =>
    teamData.filter(seller =>
      !hiddenSellerIds.includes(seller.id) &&
      (!seller.status || seller.status === 'active') &&
      (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [teamData, hiddenSellerIds, searchQuery]
  );

  const virtualizer = useVirtualizer({
    count: filteredSellers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const containerHeight = Math.min(filteredSellers.length, VISIBLE_ROWS) * ROW_HEIGHT;

  const periodLabel =
    periodFilter === '7' ? '7 jours' :
    periodFilter === '30' ? '30 jours' :
    periodFilter === '90' ? '3 mois' :
    'l\'année';

  const caLabel =
    periodFilter === '7' ? '7j' :
    periodFilter === '30' ? '30j' :
    periodFilter === '90' ? '3m' :
    periodFilter === 'custom' ? 'Pér.' : 'An';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-800">
            Détail par Vendeur
            {filteredSellers.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({filteredSellers.length} vendeur{filteredSellers.length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
          <span className="text-xs text-gray-600">
            Performance sur {periodLabel}
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Rechercher un vendeur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >✕</button>
          )}
        </div>
      </div>

      {filteredSellers.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
          Aucun vendeur trouvé
        </div>
      ) : (
        <>
          {/* ── MOBILE : cartes (< sm) ── */}
          <div className="sm:hidden space-y-2 p-2 max-h-[500px] overflow-y-auto">
            {filteredSellers.map((seller) => (
              <div key={seller.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                {/* Ligne 1 : avatar + nom + niveau */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center ${
                      seller.status === 'active' ? 'bg-cyan-100' :
                      seller.status === 'inactive' ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <span className={`text-sm font-bold ${
                        seller.status === 'active' ? 'text-cyan-700' :
                        seller.status === 'inactive' ? 'text-orange-700' : 'text-gray-700'
                      }`}>
                        {seller.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{seller.name}</p>
                      <p className="text-xs text-gray-500 leading-tight">{seller.email}</p>
                    </div>
                  </div>
                  <NiveauBadge niveau={seller.niveau} showText={false} />
                </div>

                {/* Ligne 2 : grille de stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">CA {caLabel}</p>
                    <p className="text-sm font-bold text-gray-800">{formatNumber(seller.monthlyCA)} €</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Ventes</p>
                    <p className="text-sm font-bold text-gray-800">{formatNumber(seller.monthlyVentes)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">PM</p>
                    <p className="text-sm font-bold text-gray-800">{formatNumber(seller.panierMoyen)} €</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Articles</p>
                    <p className="text-sm font-bold text-gray-800">{formatNumber(seller.articles)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Indice</p>
                    <p className="text-sm font-bold text-gray-800">
                      {seller.indice_vente > 0 ? seller.indice_vente.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg py-1.5 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Niveau</p>
                    <NiveauBadge niveau={seller.niveau} showText={true} />
                  </div>
                </div>

                {/* Ligne 3 : boutons d'action */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (isGerantWithoutStore) {
                        toast.error('Veuillez sélectionner un magasin pour consulter le détail de ce vendeur.');
                        return;
                      }
                      onViewSellerDetail(seller);
                    }}
                    disabled={isGerantWithoutStore}
                    className={`flex-1 py-2 text-white text-xs font-medium rounded-lg transition-colors ${
                      isGerantWithoutStore ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1E40AF] hover:bg-blue-700'
                    }`}
                  >
                    Détail
                  </button>
                  <button
                    onClick={() => { setSelectedSellerForEval(seller); setShowEvaluationModal(true); }}
                    className="flex-1 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded-lg hover:from-pink-600 hover:to-rose-600 transition-colors"
                  >
                    Entretien
                  </button>
                  {onPassport && (
                    <button
                      onClick={() => onPassport(seller)}
                      className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-colors"
                    >
                      Passeport
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP : tableau virtualisé (≥ sm) ── */}
          <div className="hidden sm:block overflow-x-auto">
            {/* En-tête fixe */}
            <table className="w-full text-xs table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs w-[30%]">Vendeur</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[12%]">
                    CA {caLabel}
                  </th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[8%]">Ventes</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[10%]">PM</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[8%]">Articles</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[8%]">Indice</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[12%]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Niveau</span>
                      <div className="relative">
                        <Info
                          className="w-3.5 h-3.5 text-blue-500 cursor-help"
                          onMouseEnter={() => setShowNiveauTooltip(true)}
                          onMouseLeave={() => setShowNiveauTooltip(false)}
                        />
                        {showNiveauTooltip && (
                          <div className="fixed left-1/2 -translate-x-1/2 top-32 z-[9999] w-72 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm mb-3 text-center border-b border-gray-700 pb-2">Les 4 Niveaux</div>
                              <div><span className="font-bold text-green-300">⚡ Nouveau Talent:</span> Découvre le terrain, teste, apprend les bases</div>
                              <div><span className="font-bold text-yellow-300">🟡 Challenger:</span> A pris ses repères, cherche à performer</div>
                              <div><span className="font-bold text-orange-300">🟠 Ambassadeur:</span> Inspire confiance, maîtrise les étapes de vente</div>
                              <div><span className="font-bold text-red-300">🔴 Maître du Jeu:</span> Expert relation client, adapte son style</div>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900" />
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-700 text-xs w-[12%]">Action</th>
                </tr>
              </thead>
            </table>

            {/* Corps virtualisé — hauteur fixe, scroll interne */}
            <div
              ref={parentRef}
              style={{ height: containerHeight || ROW_HEIGHT, overflowY: 'auto' }}
              className="border-b border-gray-100"
            >
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const seller = filteredSellers[virtualRow.index];
                  const idx = virtualRow.index;
                  return (
                    <table
                      key={`${seller.id}-${periodFilter}`}
                      className="w-full text-xs table-fixed"
                      style={{
                        position: 'absolute',
                        top: virtualRow.start,
                        left: 0,
                        right: 0,
                      }}
                    >
                      <tbody>
                        <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-4 py-3 w-[30%]">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 flex-shrink-0 ${seller.status === 'active' ? 'bg-cyan-100' : seller.status === 'inactive' ? 'bg-orange-100' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                                <span className={`text-sm font-bold ${seller.status === 'active' ? 'text-cyan-700' : seller.status === 'inactive' ? 'text-orange-700' : 'text-gray-700'}`}>
                                  {seller.name.charAt(0)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="font-medium text-gray-800 truncate text-xs">{seller.name}</span>
                                  {seller.status === 'inactive' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">En sommeil</span>}
                                  {seller.status === 'deleted' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded flex-shrink-0">Supprimé</span>}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{seller.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center text-gray-700 font-medium text-xs whitespace-nowrap w-[12%]">{formatNumber(seller.monthlyCA)} €</td>
                          <td className="px-2 py-3 text-center text-gray-700 text-xs w-[8%]">{formatNumber(seller.monthlyVentes)}</td>
                          <td className="px-2 py-3 text-center text-gray-700 text-xs whitespace-nowrap w-[10%]">{formatNumber(seller.panierMoyen)} €</td>
                          <td className="px-2 py-3 text-center text-gray-700 text-xs w-[8%]">{formatNumber(seller.articles)}</td>
                          <td className="px-2 py-3 text-center text-gray-700 text-xs w-[8%]">
                            {seller.indice_vente > 0 ? seller.indice_vente.toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-3 text-center text-xs w-[12%]">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              (seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') ? 'bg-red-100 text-red-800' :
                              (seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') ? 'bg-orange-100 text-orange-800' :
                              seller.niveau === 'Challenger' ? 'bg-yellow-100 text-yellow-800' :
                              (seller.niveau === 'Nouveau Talent' || seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') && '🔴 '}
                              {(seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') && '🟠 '}
                              {seller.niveau === 'Challenger' && '🟡 '}
                              {(seller.niveau === 'Nouveau Talent' || seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') && '⚡ '}
                              {seller.niveau}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-xs w-[12%]">
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => {
                                  if (isGerantWithoutStore) {
                                    toast.error('Veuillez sélectionner un magasin pour consulter le détail de ce vendeur.');
                                    return;
                                  }
                                  onViewSellerDetail(seller);
                                }}
                                disabled={isGerantWithoutStore}
                                className={`px-2 py-1.5 text-white text-xs font-medium rounded transition-colors ${isGerantWithoutStore ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1E40AF] hover:bg-blue-700'}`}
                                title={isGerantWithoutStore ? 'Sélectionnez un magasin pour voir le détail' : 'Voir le détail'}
                              >
                                Détail
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedSellerForEval(seller); setShowEvaluationModal(true); }}
                                className="flex px-2 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded hover:from-pink-600 hover:to-rose-600 transition-colors items-center gap-1"
                                title="Préparer l'entretien annuel"
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                              {onPassport && (
                                <button
                                  onClick={() => onPassport(seller)}
                                  className="flex px-2 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded hover:from-purple-600 hover:to-indigo-600 transition-colors items-center gap-1"
                                  title="Voir le passeport vendeur"
                                >
                                  <BookUser className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
