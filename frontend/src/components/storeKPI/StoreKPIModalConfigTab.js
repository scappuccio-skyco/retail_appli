import React from 'react';
import PropTypes from 'prop-types';

const CONFIG_ITEMS = [
  { keySeller: 'seller_track_ca', keyManager: 'manager_track_ca', title: '💰 Chiffre d\'Affaires', subtitle: 'CA quotidien', tooltip: 'Total des ventes en euros. Permet de calculer le Panier Moyen (CA ÷ Ventes).' },
  { keySeller: 'seller_track_ventes', keyManager: 'manager_track_ventes', title: '🛍️ Nombre de Ventes', subtitle: 'Transactions', tooltip: 'Nombre de transactions réalisées. Permet de calculer : Panier Moyen (CA ÷ Ventes), Taux de Transformation (Ventes ÷ Prospects) et Indice de Vente (Articles ÷ Ventes).' },
  { keySeller: 'seller_track_articles', keyManager: 'manager_track_articles', title: '📦 Nombre d\'Articles', subtitle: 'Articles vendus', tooltip: 'Nombre total d\'articles vendus. Permet de calculer l\'Indice de Vente/UPT (Articles ÷ Ventes) : nombre moyen d\'articles par transaction.' },
  { keySeller: 'seller_track_prospects', keyManager: 'manager_track_prospects', title: '🚶 Nombre de Prospects', subtitle: 'Entrées magasin', tooltip: 'Nombre de personnes entrées dans le magasin. Permet de calculer le Taux de Transformation (Ventes ÷ Prospects) : pourcentage de visiteurs qui achètent.' }
];

function ConfigRow({ item, kpiConfig, onUpdate }) {
  const sellerOn = kpiConfig[item.keySeller];
  const managerOn = kpiConfig[item.keyManager];
  return (
    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h4 className="font-bold text-gray-800">{item.title}</h4>
            <p className="text-sm text-gray-600">{item.subtitle}</p>
          </div>
          <span className="text-blue-500 cursor-help" title={item.tooltip}>ⓘ</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onUpdate(item.keySeller, !sellerOn)} className={`w-12 h-8 rounded font-bold text-xs ${sellerOn ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-500'}`} title="Vendeur">🧑‍💼</button>
          <button type="button" onClick={() => onUpdate(item.keyManager, !managerOn)} className={`w-12 h-8 rounded font-bold text-xs ${managerOn ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`} title="Manager">👨‍💼</button>
        </div>
      </div>
    </div>
  );
}
ConfigRow.propTypes = {
  item: PropTypes.shape({
    keySeller: PropTypes.string.isRequired,
    keyManager: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
    tooltip: PropTypes.string.isRequired
  }).isRequired,
  kpiConfig: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired
};

export default function StoreKPIModalConfigTab({ kpiConfig, onKPIUpdate }) {
  return (
    <div className="space-y-4">
      <div className="bg-orange-500 rounded-xl p-3 border-2 border-orange-600">
        <p className="text-sm text-white font-bold">
          💡 <strong>Configuration des données :</strong> Choisissez qui remplit chaque donnée. Vendeurs (Bleu) ou Manager (orange) ou aucun des deux (gris).
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONFIG_ITEMS.map((item) => (
          <ConfigRow key={item.keySeller} item={item} kpiConfig={kpiConfig} onUpdate={onKPIUpdate} />
        ))}
      </div>
    </div>
  );
}
StoreKPIModalConfigTab.propTypes = {
  kpiConfig: PropTypes.object.isRequired,
  onKPIUpdate: PropTypes.func.isRequired
};
