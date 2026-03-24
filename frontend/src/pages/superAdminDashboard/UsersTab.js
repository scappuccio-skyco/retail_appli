import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/apiClient';
import { Search, Loader, RefreshCw, ChevronLeft, ChevronRight, User, Shield, Users } from 'lucide-react';

const ROLE_LABELS = { gerant: 'Gérant', manager: 'Manager', seller: 'Vendeur', super_admin: 'Super Admin' };
const ROLE_COLORS = {
  gerant: 'bg-blue-100 text-blue-700',
  manager: 'bg-green-100 text-green-700',
  seller: 'bg-purple-100 text-purple-700',
  super_admin: 'bg-red-100 text-red-700',
};
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-600',
  deleted: 'bg-red-100 text-red-600',
};

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const SIZE = 50;

  const fetchUsers = useCallback(async (p = page, role = roleFilter, status = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, size: SIZE });
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      const res = await api.get(`/superadmin/users?${params}`);
      setUsers(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(1, roleFilter, statusFilter); setPage(1); }, [roleFilter, statusFilter]);
  useEffect(() => { fetchUsers(page, roleFilter, statusFilter); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim().toLowerCase());
  };

  const filteredUsers = search
    ? users.filter(u => u.email?.toLowerCase().includes(search) || u.name?.toLowerCase().includes(search))
    : users;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Utilisateurs <span className="text-purple-300 text-base font-normal">({total} total)</span></h2>
        <button onClick={() => fetchUsers(page)} disabled={loading} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher nom ou email..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/10 text-white placeholder-purple-300 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-64"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            Chercher
          </button>
        </form>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tous les rôles</option>
          <option value="gerant">Gérant</option>
          <option value="manager">Manager</option>
          <option value="seller">Vendeur</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="trial">Essai</option>
          <option value="inactive">Inactif</option>
          <option value="deleted">Supprimé</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="w-8 h-8 text-purple-300 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nom</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Rôle</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Statut</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">Aucun utilisateur trouvé</td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr key={u.id || i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.role === 'super_admin' ? <Shield className="w-4 h-4 text-red-500" /> : <User className="w-4 h-4 text-gray-400" />}
                        <span className="font-medium text-gray-800">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-600'}`}>
                        {u.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">Page {page} / {pages} — {total} utilisateurs</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
