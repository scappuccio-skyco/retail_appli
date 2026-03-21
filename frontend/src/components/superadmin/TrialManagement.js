import React from 'react';
import { Calendar, Clock, Users, Search, AlertCircle, CheckCircle } from 'lucide-react';
import useTrialManagement from './trialManagement/useTrialManagement';
import GerantTrialCard from './trialManagement/GerantTrialCard';

export default function TrialManagement({ onTrialUpdated }) {
  const {
    loading, refreshKey,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    filteredGerants, statusCounts,
    editingTrial, setEditingTrial,
    newTrialEnd, setNewTrialEnd,
    handleUpdateTrial,
  } = useTrialManagement({ onTrialUpdated });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              Gestion des Périodes d'Essai
            </h2>
            <p className="text-gray-600 mt-1">Gérer les périodes d'essai des gérants</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tous ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter('active_trial')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'active_trial' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            En essai ({statusCounts.active_trial})
          </button>
          <button
            onClick={() => setStatusFilter('expiring_soon')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'expiring_soon' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
          >
            <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
            Expire bientôt ({statusCounts.expiring_soon})
          </button>
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'expired' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            Expiré ({statusCounts.expired})
          </button>
          <button
            onClick={() => setStatusFilter('no_trial')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'no_trial' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Aucun essai ({statusCounts.no_trial})
          </button>
          <button
            onClick={() => setStatusFilter('subscribed')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === 'subscribed' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
          >
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
            Abonnés ({statusCounts.subscribed})
          </button>
        </div>

        {/* List */}
        <div key={refreshKey} className="space-y-4">
          {filteredGerants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Aucun gérant trouvé</p>
            </div>
          ) : (
            filteredGerants.map((gerant) => (
              <GerantTrialCard
                key={gerant.id}
                gerant={gerant}
                editingTrial={editingTrial}
                newTrialEnd={newTrialEnd}
                setEditingTrial={setEditingTrial}
                setNewTrialEnd={setNewTrialEnd}
                onUpdateTrial={handleUpdateTrial}
              />
            ))
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Information</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Vous pouvez prolonger la date de fin d'essai pour rallonger la période</li>
            <li>Les gérants avec un abonnement actif ne sont pas modifiables ici</li>
            <li>Un essai expiré est marqué en rouge, un essai proche de l'expiration en orange</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
