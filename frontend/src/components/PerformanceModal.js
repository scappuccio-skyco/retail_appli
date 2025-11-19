import React, { useState } from 'react';
import { X, TrendingUp, BarChart3 } from 'lucide-react';
import BilanIndividuelModal from './BilanIndividuelModal';
import KPIHistoryModal from './KPIHistoryModal';

export default function PerformanceModal({ 
  isOpen, 
  onClose,
  bilanData,
  kpiEntries,
  user,
  onDataUpdate,
  onRegenerate,
  generatingBilan
}) {
  const [activeTab, setActiveTab] = useState('bilan'); // 'bilan' or 'kpi'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800">📊 Mes Performances</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Onglets */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('bilan')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'bilan'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <span>Mon Bilan</span>
              </div>
              <p className="text-xs mt-1 opacity-75">KPI hebdomadaires</p>
            </button>
            <button
              onClick={() => setActiveTab('kpi')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'kpi'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-5 h-5" />
                <span>Mes KPI</span>
              </div>
              <p className="text-xs mt-1 opacity-75">
                {kpiEntries?.length || 0} enregistré{kpiEntries?.length > 1 ? 's' : ''}
              </p>
            </button>
          </div>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'bilan' && bilanData && (
            <BilanIndividuelModal
              bilan={bilanData}
              onClose={() => {}} // Ne pas fermer, on est déjà dans le modal parent
              onDataUpdate={onDataUpdate}
              user={user}
              onRegenerate={onRegenerate}
              generatingBilan={generatingBilan}
              embedded={true} // Indique que c'est intégré dans un autre modal
            />
          )}
          
          {activeTab === 'kpi' && (
            <KPIHistoryModal
              isOpen={true}
              onClose={() => {}} // Ne pas fermer, on est déjà dans le modal parent
              kpiEntries={kpiEntries}
              embedded={true} // Indique que c'est intégré dans un autre modal
            />
          )}
        </div>
      </div>
    </div>
  );
}
