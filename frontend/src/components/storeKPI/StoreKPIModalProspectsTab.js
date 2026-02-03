import React from 'react';
import PropTypes from 'prop-types';

export default function StoreKPIModalProspectsTab({
  kpiConfig,
  isManagerDateLocked,
  managerKPIData,
  setManagerKPIData,
  sellers,
  sellersKPIData,
  setSellersKPIData,
  loading,
  loadingSellers,
  onManagerKPISubmit,
  onClose,
  onGoToConfig,
  setActiveTab
}) {
  const hasManagerData = kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_articles || kpiConfig.manager_track_prospects;

  const prospectsBlockClassName = isManagerDateLocked ? 'bg-gray-100 border-gray-300' : 'bg-orange-50 border-orange-200';
  const dateInputClassName = isManagerDateLocked ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-purple-400';
  const sellerInputClassName = isManagerDateLocked ? 'border-gray-300 bg-gray-100 cursor-not-allowed text-gray-500' : 'border-gray-300 focus:border-orange-400';
  const prospectsInputClassName = isManagerDateLocked ? 'border-gray-300 bg-gray-200 cursor-not-allowed text-gray-500' : 'border-gray-300 focus:border-purple-400';
  const submitButtonLabel = loading ? 'Enregistrement...' : '💾 Enregistrer les données';

  const handleShowPicker = (e) => {
    try {
      if (typeof e.target.showPicker === 'function') e.target.showPicker();
    } catch (err) {
      console.error('[StoreKPIModalProspectsTab] showPicker failed:', err);
    }
  };

  if (!hasManagerData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-6 px-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 max-w-md">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-100 rounded-full mb-3">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Aucune donnée à saisir</h3>
              <p className="text-sm text-gray-600">Vous n'avez activé aucune donnée pour la saisie Manager.</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-yellow-300 mb-4">
              <p className="text-xs text-gray-700 mb-2">💡 <strong>Pour commencer la saisie :</strong></p>
              <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                <li>Rendez-vous dans l'onglet <strong className="text-orange-700">⚙️ Config des données</strong></li>
                <li>Activez les données (bouton orange 👨‍💼)</li>
                <li>Revenez dans cet onglet pour saisir vos données</li>
              </ol>
            </div>
            <button type="button" onClick={() => setActiveTab('config')} className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2">
              <span>⚙️</span> Aller à la Config des données
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {isManagerDateLocked && (
        <div className="bg-red-100 rounded-xl p-4 border-2 border-red-300 mb-6">
          <p className="text-sm text-red-800 font-bold flex items-center gap-2">🔒 <strong>Données certifiées par le Siège/ERP</strong></p>
          <p className="text-xs text-red-600 mt-1">Les données de cette journée proviennent de l'API et ne peuvent pas être modifiées manuellement. Sélectionnez une autre date pour saisir des données.</p>
        </div>
      )}
      {!isManagerDateLocked && (
        <div className="bg-orange-500 rounded-xl p-4 border-2 border-orange-600 mb-6">
          <p className="text-sm text-white font-bold">💡 <strong>Saisie par Vendeur :</strong> Remplissez les données pour chaque vendeur individuellement.</p>
        </div>
      )}

      <form onSubmit={onManagerKPISubmit} className="space-y-4">
        <div>
          <label htmlFor="store-kpi-prospects-date" className="block text-sm font-semibold text-gray-700 mb-2">📅 Date</label>
          <input
            id="store-kpi-prospects-date"
            type="date"
            required
            value={managerKPIData.date}
            onChange={(e) => setManagerKPIData({ ...managerKPIData, date: e.target.value })}
            onClick={handleShowPicker}
            className={`w-full p-3 border-2 rounded-lg focus:outline-none cursor-pointer ${dateInputClassName}`}
          />
          {isManagerDateLocked && <p className="text-xs text-red-500 mt-1">⚠️ Cette date est verrouillée (données API)</p>}
        </div>

        {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_articles) && (
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-2">📋 Saisie par Vendeur</h3>
              <p className="text-xs text-gray-600">Saisissez les données pour chaque vendeur actif du magasin.</p>
            </div>
            {loadingSellers ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                <p className="text-sm text-gray-600 mt-2">Chargement des vendeurs...</p>
              </div>
            ) : sellers.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">⚠️ Aucun vendeur actif trouvé pour ce magasin.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sellers.map((seller) => (
                  <div key={seller.id} className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">{seller.name}</h4>
                      <span className="text-xs text-gray-500">ID: {seller.id.substring(0, 8)}...</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {kpiConfig.manager_track_ca && (
                        <div>
                          <label htmlFor={`seller-${seller.id}-ca`} className="block text-xs font-medium text-gray-700 mb-1">💰 CA (€)</label>
                          <input
                            id={`seller-${seller.id}-ca`}
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isManagerDateLocked}
                            value={sellersKPIData[seller.id]?.ca_journalier ?? ''}
                            onChange={(e) => setSellersKPIData(prev => ({ ...prev, [seller.id]: { ...prev[seller.id], ca_journalier: e.target.value } }))}
                            className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${sellerInputClassName}`}
                            placeholder="0.00"
                          />
                        </div>
                      )}
                      {kpiConfig.manager_track_ventes && (
                        <div>
                          <label htmlFor={`seller-${seller.id}-ventes`} className="block text-xs font-medium text-gray-700 mb-1">🛍️ Ventes</label>
                          <input
                            id={`seller-${seller.id}-ventes`}
                            type="number"
                            min="0"
                            disabled={isManagerDateLocked}
                            value={sellersKPIData[seller.id]?.nb_ventes ?? ''}
                            onChange={(e) => setSellersKPIData(prev => ({ ...prev, [seller.id]: { ...prev[seller.id], nb_ventes: e.target.value } }))}
                            className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${sellerInputClassName}`}
                            placeholder="0"
                          />
                        </div>
                      )}
                      {kpiConfig.manager_track_articles && (
                        <div>
                          <label htmlFor={`seller-${seller.id}-articles`} className="block text-xs font-medium text-gray-700 mb-1">📦 Articles</label>
                          <input
                            id={`seller-${seller.id}-articles`}
                            type="number"
                            min="0"
                            disabled={isManagerDateLocked}
                            value={sellersKPIData[seller.id]?.nb_articles ?? ''}
                            onChange={(e) => setSellersKPIData(prev => ({ ...prev, [seller.id]: { ...prev[seller.id], nb_articles: e.target.value } }))}
                            className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${sellerInputClassName}`}
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {kpiConfig.manager_track_prospects && (
          <div className={`rounded-lg p-4 border-2 ${prospectsBlockClassName}`}>
            <label htmlFor="store-kpi-prospects-nb" className="block text-sm font-semibold text-gray-700 mb-2">🚶 Nombre de Prospects (Trafic Magasin Global)</label>
            <p className="text-xs text-gray-600 mb-2">Ce total sera réparti automatiquement entre les vendeurs pour le calcul du taux de transformation.</p>
            <input
              id="store-kpi-prospects-nb"
              type="number"
              min="0"
              required={!isManagerDateLocked}
              disabled={isManagerDateLocked}
              value={managerKPIData.nb_prospects}
              onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_prospects: e.target.value })}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none ${prospectsInputClassName}`}
              placeholder="Ex: 150"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Annuler</button>
          {isManagerDateLocked ? (
            <div className="flex-1 px-6 py-3 bg-red-100 text-red-600 font-semibold rounded-lg text-center border-2 border-red-300">🔒 Données verrouillées (API)</div>
          ) : (
            <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50">{submitButtonLabel}</button>
          )}
        </div>
      </form>
    </div>
  );
}
StoreKPIModalProspectsTab.propTypes = {
  kpiConfig: PropTypes.object.isRequired,
  isManagerDateLocked: PropTypes.bool.isRequired,
  managerKPIData: PropTypes.object.isRequired,
  setManagerKPIData: PropTypes.func.isRequired,
  sellers: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })).isRequired,
  sellersKPIData: PropTypes.object.isRequired,
  setSellersKPIData: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  loadingSellers: PropTypes.bool.isRequired,
  onManagerKPISubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onGoToConfig: PropTypes.func,
  setActiveTab: PropTypes.func.isRequired
};
