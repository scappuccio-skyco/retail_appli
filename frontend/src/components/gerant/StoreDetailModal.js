import React, { useState } from 'react';
import { X, Users, RefreshCw, Trash2 } from 'lucide-react';
import StoreKPIModal from '../StoreKPIModal';
import useStoreDetailModal from './storeDetailModal/useStoreDetailModal';
import TeamMemberRow from './storeDetailModal/TeamMemberRow';
import PendingInvitationRow from './storeDetailModal/PendingInvitationRow';
import SellerPassportModal from './SellerPassportModal';
import BusinessContextTab from './storeDetailModal/BusinessContextTab';

const STORE_COLOR_CONFIG = [
  { name: 'orange', from: '#f97316', via: '#ea580c', to: '#c2410c', accent: 'text-orange-600 border-orange-600' },
  { name: 'blue',   from: '#3b82f6', via: '#2563eb', to: '#1d4ed8', accent: 'text-blue-600 border-blue-600' },
  { name: 'purple', from: '#a855f7', via: '#9333ea', to: '#7e22ce', accent: 'text-purple-600 border-purple-600' },
  { name: 'emerald',from: '#10b981', via: '#059669', to: '#047857', accent: 'text-emerald-600 border-emerald-600' },
  { name: 'pink',   from: '#ec4899', via: '#db2777', to: '#be185d', accent: 'text-pink-600 border-pink-600' },
  { name: 'cyan',   from: '#06b6d4', via: '#0891b2', to: '#0e7490', accent: 'text-cyan-600 border-cyan-600' },
  { name: 'amber',  from: '#f59e0b', via: '#d97706', to: '#b45309', accent: 'text-amber-600 border-amber-600' },
  { name: 'indigo', from: '#6366f1', via: '#4f46e5', to: '#4338ca', accent: 'text-indigo-600 border-indigo-600' },
];

export default function StoreDetailModal({ store, colorIndex = 0, isReadOnly = false, onClose, onTransferManager, onTransferSeller, onDeleteStore, onRefresh, refreshToken = 0 }) {
  const colorConfig = STORE_COLOR_CONFIG[colorIndex % STORE_COLOR_CONFIG.length];
  const {
    activeTab, setActiveTab,
    managers, sellers, pendingInvitations,
    loading, refreshKey,
    handleDeleteUser, handleToggleSuspend, handleCancelInvitation, handleRefresh,
  } = useStoreDetailModal({ store, onRefresh, refreshToken });

  const [passportSeller, setPassportSeller] = useState(null);

  const managerInvites = pendingInvitations.filter(inv => inv.role === 'manager');
  const sellerInvites  = pendingInvitations.filter(inv => inv.role === 'seller');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] shadow-2xl flex flex-col">

        {/* Header */}
        <div
          className="p-4 sm:p-6 relative flex-shrink-0 rounded-t-2xl"
          style={{ background: `linear-gradient(135deg, ${colorConfig.from} 0%, ${colorConfig.via} 50%, ${colorConfig.to} 100%)` }}
        >
          <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-gray-200 transition-colors p-1">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 pr-8">{store.name}</h2>
          <p className="text-white opacity-90 text-sm sm:text-base">📍 {store.location}</p>
          {store.address && <p className="text-white opacity-80 text-xs sm:text-sm mt-1 truncate">{store.address}</p>}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex-shrink-0 overflow-x-auto">
          <div className="flex min-w-max px-3 sm:px-6">
            {[
              { key: 'performance', label: '📊 Performance' },
              { key: 'managers',    label: `👔 Managers (${managers.filter(m => m.status === 'active').length})` },
              { key: 'sellers',     label: `👥 Vendeurs (${sellers.filter(s => s.status === 'active').length})` },
              { key: 'context',     label: '🏪 Contexte' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? colorConfig.accent : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: colorConfig.from }} />
              <p className="text-gray-600 mt-4">Chargement...</p>
            </div>
          ) : activeTab === 'performance' ? (
            <StoreKPIModal onClose={() => {}} onSuccess={() => onRefresh()} hideCloseButton storeId={store.id} storeName={store.name} />
          ) : activeTab === 'managers' ? (
            <div key={`managers-${refreshKey}`} className="space-y-3">
              {managers.length === 0 && managerInvites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun manager dans ce magasin</p>
                </div>
              ) : (
                <>
                  {managers.map(manager => (
                    <TeamMemberRow
                      key={manager.id}
                      member={manager}
                      role="manager"
                      managers={managers}
                      refreshKey={refreshKey}
                      isReadOnly={isReadOnly}
                      onTransfer={(manager) => onTransferManager(manager, sellers)}
                      onToggleSuspend={handleToggleSuspend}
                      onDelete={handleDeleteUser}
                    />
                  ))}
                  {managerInvites.map(inv => (
                    <PendingInvitationRow key={inv.id} invitation={inv} role="manager" onCancel={handleCancelInvitation} />
                  ))}
                </>
              )}
            </div>
          ) : activeTab === 'sellers' ? (
            <div key={`sellers-${refreshKey}`} className="space-y-3">
              {sellers.length === 0 && sellerInvites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun vendeur dans ce magasin</p>
                </div>
              ) : (
                <>
                  {sellers.map(seller => (
                    <TeamMemberRow
                      key={seller.id}
                      member={seller}
                      role="seller"
                      managers={managers}
                      refreshKey={refreshKey}
                      isReadOnly={isReadOnly}
                      onTransfer={onTransferSeller}
                      onToggleSuspend={handleToggleSuspend}
                      onDelete={handleDeleteUser}
                      onPassport={(member) => setPassportSeller(member)}
                    />
                  ))}
                  {sellerInvites.map(inv => (
                    <PendingInvitationRow key={inv.id} invitation={inv} role="seller" onCancel={handleCancelInvitation} />
                  ))}
                </>
              )}
            </div>
          ) : activeTab === 'context' ? (
            <BusinessContextTab storeId={store.id} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 sm:p-6 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 flex-shrink-0">
          {!isReadOnly && (
            <button
              onClick={() => onDeleteStore(store)}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm sm:text-base font-semibold order-2 sm:order-1"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden xs:inline">Supprimer</span>
              <span className="xs:hidden">Suppr.</span>
            </button>
          )}
          <div className="flex gap-2 order-1 sm:order-2">
            <button
              onClick={handleRefresh}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm sm:text-base font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {passportSeller && (
        <SellerPassportModal
          seller={passportSeller}
          onClose={() => setPassportSeller(null)}
        />
      )}
    </div>
  );
}
