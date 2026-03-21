import React from 'react';
import useInvitationsManagement from './invitationsManagement/useInvitationsManagement';
import InvitationsTable from './invitationsManagement/InvitationsTable';

const InvitationsManagement = () => {
  const {
    loading, filter, setFilter, searchTerm, setSearchTerm,
    editingId, editData, setEditData,
    filteredInvitations,
    fetchInvitations, handleDelete, handleResend,
    startEdit, cancelEdit, saveEdit,
  } = useInvitationsManagement();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <InvitationsTable
      filteredInvitations={filteredInvitations}
      filter={filter}
      setFilter={setFilter}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      editingId={editingId}
      editData={editData}
      setEditData={setEditData}
      fetchInvitations={fetchInvitations}
      handleDelete={handleDelete}
      handleResend={handleResend}
      startEdit={startEdit}
      cancelEdit={cancelEdit}
      saveEdit={saveEdit}
    />
  );
};

export default InvitationsManagement;
