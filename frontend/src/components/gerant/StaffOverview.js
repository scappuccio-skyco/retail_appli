import React from 'react';
import { Users, UserCog, Building2, Clock, Lock } from 'lucide-react';
import EditStaffModal from './EditStaffModal';
import useStaffOverview from './staffOverview/useStaffOverview';
import StaffFilters from './staffOverview/StaffFilters';
import UsersTable from './staffOverview/UsersTable';
import InvitationsTable from './staffOverview/InvitationsTable';
import TransferModal from './staffOverview/TransferModal';

export default function StaffOverview({ onRefresh, onOpenInviteModal, onOpenCreateStoreModal, isReadOnly = false, canManageStaff = true }) {
  const s = useStaffOverview({ onRefresh });

  if (s.loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-gray-600">Chargement...</div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vue générale du personnel</h2>
          <p className="text-gray-600 mt-1">Gérez tous vos managers et vendeurs depuis une seule vue</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => !isReadOnly && onOpenInviteModal()}
            disabled={isReadOnly}
            title={isReadOnly ? "Période d'essai terminée" : 'Inviter du personnel'}
            className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-xl transition-all ${
              isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
            }`}
          >
            <Users className="w-5 h-5" />
            Inviter du Personnel
            {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
          </button>
          <button
            onClick={() => !isReadOnly && onOpenCreateStoreModal()}
            disabled={isReadOnly}
            title={isReadOnly ? "Période d'essai terminée" : 'Créer un magasin'}
            className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-xl transition-all ${
              isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Créer un Magasin
            {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
          </button>
        </div>
      </div>

      <StaffFilters
        searchTerm={s.searchTerm} setSearchTerm={s.setSearchTerm}
        storeFilter={s.storeFilter} setStoreFilter={s.setStoreFilter}
        statusFilter={s.statusFilter} setStatusFilter={s.setStatusFilter}
        invitationStatusFilter={s.invitationStatusFilter} setInvitationStatusFilter={s.setInvitationStatusFilter}
        stores={s.stores} activeTab={s.activeTab}
      />

      {/* Tabs + content */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'managers', label: `Managers (${s.filteredManagers.length})`, icon: <UserCog className="w-5 h-5" />, color: 'purple' },
              { id: 'sellers', label: `Vendeurs (${s.filteredSellers.length})`, icon: <Users className="w-5 h-5" />, color: 'purple' },
            ].map(({ id, label, icon, color }) => (
              <button
                key={id}
                onClick={() => s.setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                  s.activeTab === id ? `border-${color}-600 text-${color}-600` : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {icon}{label}
              </button>
            ))}
            <button
              onClick={() => s.setActiveTab('invitations')}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                s.activeTab === 'invitations' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-5 h-5" />
              En attente
              {s.pendingInvitationsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">{s.pendingInvitationsCount}</span>
              )}
            </button>
          </div>
        </div>

        {s.activeTab !== 'invitations' && (
          <UsersTable
            users={s.activeTab === 'managers' ? s.filteredManagers : s.filteredSellers}
            canManageStaff={canManageStaff}
            actionMenuOpen={s.actionMenuOpen} setActionMenuOpen={s.setActionMenuOpen}
            getStoreName={s.getStoreName}
            onEdit={(user) => { s.setUserToEdit(user); s.setEditModalOpen(true); s.setActionMenuOpen(null); }}
            onTransfer={s.openTransferModal}
            onSuspend={s.handleSuspend}
            onReactivate={s.handleReactivate}
            onDelete={s.handleDelete}
          />
        )}

        {s.activeTab === 'invitations' && (
          <InvitationsTable
            invitations={s.filteredInvitations}
            resendingInvitation={s.resendingInvitation}
            getStoreName={s.getStoreName}
            onResend={s.handleResendInvitation}
            onCancel={s.handleCancelInvitation}
            onOpenInviteModal={onOpenInviteModal}
          />
        )}
      </div>

      {s.editModalOpen && s.userToEdit && (
        <EditStaffModal
          isOpen={s.editModalOpen}
          onClose={() => { s.setEditModalOpen(false); s.setUserToEdit(null); }}
          user={s.userToEdit}
          onUpdate={() => {
            s.fetchData();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {s.transferModalOpen && s.selectedUser && (
        <TransferModal
          user={s.selectedUser}
          stores={s.stores}
          managers={s.managers}
          onTransfer={s.handleTransfer}
          onClose={() => { s.setTransferModalOpen(false); s.setSelectedUser(null); }}
        />
      )}
    </div>
  );
}
