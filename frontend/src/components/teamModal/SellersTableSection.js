import React from 'react';
import { Info, FileText } from 'lucide-react';
import { toast } from 'sonner';

// Utility function to format numbers with spaces for thousands
const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export default function SellersTableSection({
  teamData,
  sellers,
  searchQuery,
  setSearchQuery,
  displayedSellerCount,
  setDisplayedSellerCount,
  hiddenSellerIds,
  setHiddenSellerIds,
  isUpdating,
  periodFilter,
  customDateRange,
  userRole,
  storeIdParam,
  user,
  showNiveauTooltip,
  setShowNiveauTooltip,
  onViewSellerDetail,
  setShowEvaluationModal,
  setSelectedSellerForEval,
  refreshSellersData,
  fetchTeamData,
  isGerantWithoutStore,
}) {
  return (
    /* Sellers Table */
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-800">Détail par Vendeur</h3>
          <span className="text-xs text-gray-600">
            Performance sur {
              periodFilter === '7' ? '7 jours' :
              periodFilter === '30' ? '30 jours' :
              periodFilter === '90' ? '3 mois' :
              'l\'année'
            }
          </span>
        </div>
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Rechercher un vendeur..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayedSellerCount(5); // Reset to 5 when searching
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDisplayedSellerCount(5);
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-1 sm:px-4 py-3 text-left font-semibold text-gray-700 text-xs">Vendeur</th>
              <th className="px-4 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">
                CA {periodFilter === '7' ? '7j' : periodFilter === '30' ? '30j' : periodFilter === '90' ? '3m' : periodFilter === 'custom' ? 'Période' : 'An'}
              </th>
              <th className="px-3 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">Ventes</th>
              <th className="px-4 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">PM</th>
              <th className="px-0 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">Articles</th>
              <th className="px-0 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">Indice de vente</th>
              <th className="px-0 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">
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
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                </div>
              </th>
              <th className="px-0 sm:px-4 py-3 text-center font-semibold text-gray-700 text-xs">Action</th>
            </tr>
          </thead>
          <tbody>
            {teamData
              .filter(seller =>
                // Exclure les vendeurs masqués temporairement
                !hiddenSellerIds.includes(seller.id) &&
                // Exclure les vendeurs inactifs ou supprimés
                (!seller.status || seller.status === 'active') &&
                // Filtre de recherche
                (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .slice(0, displayedSellerCount)
              .map((seller, idx) => (
              <tr key={`${seller.id}-${periodFilter}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${seller.status === 'active' ? 'bg-cyan-100' : seller.status === 'inactive' ? 'bg-orange-100' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${seller.status === 'active' ? 'text-cyan-700' : seller.status === 'inactive' ? 'text-orange-700' : 'text-gray-700'}`}>{seller.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{seller.name}</span>
                        {seller.status === 'inactive' && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                            En sommeil
                          </span>
                        )}
                        {seller.status === 'deleted' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                            Supprimé
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{seller.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs whitespace-nowrap">{formatNumber(seller.monthlyCA)} €</td>
                <td className="px-3 sm:px-4 py-3 text-center text-gray-700 text-xs whitespace-nowrap">{formatNumber(seller.monthlyVentes)}</td>
                <td className="px-4 sm:px-4 py-3 text-center text-gray-700 text-xs whitespace-nowrap">{formatNumber(seller.panierMoyen)} €</td>
                <td className="px-0 sm:px-4 py-3 text-center text-gray-700 text-xs whitespace-nowrap">
                  {formatNumber(seller.articles)}
                </td>
                <td className="px-0 sm:px-4 py-3 text-center text-gray-700 text-xs whitespace-nowrap">
                  {seller.indice_vente > 0 ? seller.indice_vente.toFixed(2) : '—'}
                </td>
                <td className="px-0 sm:px-4 py-3 text-center text-xs">
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
                <td className="px-0 sm:px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={() => {
                        // Contrainte métier: un gérant doit être dans un magasin pour voir le détail
                        if (isGerantWithoutStore) {
                          toast.error('Veuillez sélectionner un magasin pour consulter le détail de ce vendeur.');
                          return;
                        }
                        onViewSellerDetail(seller);
                      }}
                      disabled={isGerantWithoutStore}
                      className={`px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ${
                        isGerantWithoutStore
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#1E40AF] hover:bg-blue-700'
                      }`}
                      title={isGerantWithoutStore ? 'Sélectionnez un magasin pour voir le détail' : 'Voir le détail'}
                    >
                      Voir détail
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSellerForEval(seller);
                        setShowEvaluationModal(true);
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded hover:from-pink-600 hover:to-rose-600 transition-colors flex items-center gap-1"
                      title="Préparer l'entretien annuel"
                    >
                      <FileText className="w-3 h-3" />
                      Bilan
                    </button>

                    {/* Actions de suspension/suppression/réactivation - RÉSERVÉES EXCLUSIVEMENT AU GÉRANT */}
                    {/* Un Manager ne peut ni suspendre, ni supprimer, ni réactiver un vendeur */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show More Button */}
      {teamData.filter(seller =>
        !hiddenSellerIds.includes(seller.id) &&
        (!seller.status || seller.status === 'active') &&
        (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
      ).length > displayedSellerCount && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
          <button
            onClick={() => setDisplayedSellerCount(prev => prev + 5)}
            className="px-4 py-2 text-sm font-medium text-[#1E40AF] hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
          >
            Afficher 5 vendeurs de plus ({teamData.filter(seller =>
              !hiddenSellerIds.includes(seller.id) &&
              (!seller.status || seller.status === 'active') &&
              (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
            ).length - displayedSellerCount} restants)
          </button>
        </div>
      )}
    </div>
  );
}
