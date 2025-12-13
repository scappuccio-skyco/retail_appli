import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, MapPin, Phone, Mail, Edit2, Save, X, Plus, Users, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';

/**
 * StoresManagement - Composant pour gérer les magasins du Gérant
 * Permet de voir la liste des magasins et de modifier leurs informations
 */
export default function StoresManagement({ onRefresh, onOpenCreateStoreModal, isReadOnly }) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Charger les magasins
  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${backendUrl}/api/gerant/stores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStores(response.data);
    } catch (error) {
      console.error('Erreur chargement magasins:', error);
      toast.error('Erreur lors du chargement des magasins');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (store) => {
    if (isReadOnly) {
      toast.error("Mode lecture seule - Abonnement requis");
      return;
    }
    setEditingStore(store.id);
    setEditForm({
      name: store.name || '',
      location: store.location || '',
      phone: store.phone || '',
      email: store.email || '',
      address: store.address || '',
      description: store.description || ''
    });
  };

  const handleCancel = () => {
    setEditingStore(null);
    setEditForm({});
  };

  const handleSave = async (storeId) => {
    if (isReadOnly) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${backendUrl}/api/gerant/stores/${storeId}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Magasin mis à jour avec succès !');
      setEditingStore(null);
      setEditForm({});
      fetchStores();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Couleurs pour différencier les magasins
  const STORE_COLORS = [
    { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-gradient-to-r from-orange-500 to-orange-600', text: 'text-orange-600' },
    { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-blue-600' },
    { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-gradient-to-r from-purple-500 to-purple-600', text: 'text-purple-600' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-emerald-600' },
    { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-gradient-to-r from-pink-500 to-pink-600', text: 'text-pink-600' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-gradient-to-r from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <span className="ml-3 text-gray-600">Chargement des magasins...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-600" />
            Mes Magasins
          </h2>
          <p className="text-gray-600 mt-1">
            Gérez les informations de vos {stores.length} magasin{stores.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={onOpenCreateStoreModal}
          disabled={isReadOnly}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            isReadOnly
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
          }`}
        >
          <Plus className="w-5 h-5" />
          Ajouter un magasin
        </button>
      </div>

      {/* Liste des magasins */}
      {stores.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun magasin</h3>
          <p className="text-gray-500 mb-4">Commencez par créer votre premier magasin</p>
          <button
            onClick={onOpenCreateStoreModal}
            disabled={isReadOnly}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Créer un magasin
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {stores.map((store, index) => {
            const colors = STORE_COLORS[index % STORE_COLORS.length];
            const isEditing = editingStore === store.id;
            
            return (
              <div
                key={store.id}
                className={`rounded-xl overflow-hidden border-2 ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-all`}
              >
                {/* Header du magasin */}
                <div className={`${colors.header} px-6 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{store.name}</h3>
                      <p className="text-white/80 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {store.location || 'Non définie'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Stats rapides */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{store.manager_count || 0}</p>
                      <p className="text-white/80 text-xs">Manager{(store.manager_count || 0) > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{store.seller_count || 0}</p>
                      <p className="text-white/80 text-xs">Vendeur{(store.seller_count || 0) > 1 ? 's' : ''}</p>
                    </div>
                    
                    {/* Bouton Edit/Save */}
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(store.id)}
                          disabled={saving}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Enregistrer"
                        >
                          {saving ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          ) : (
                            <Save className="w-5 h-5 text-white" />
                          )}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Annuler"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(store)}
                        disabled={isReadOnly}
                        className={`p-2 rounded-lg transition-colors ${
                          isReadOnly 
                            ? 'bg-white/10 cursor-not-allowed' 
                            : 'bg-white/20 hover:bg-white/30'
                        }`}
                        title={isReadOnly ? "Mode lecture seule" : "Modifier"}
                      >
                        <Edit2 className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Contenu / Formulaire */}
                <div className="p-6">
                  {isEditing ? (
                    /* Mode édition */
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom du magasin *
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: Boutique Centre-Ville"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ville / Localisation
                        </label>
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: Paris 8ème"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adresse complète
                        </label>
                        <input
                          type="text"
                          value={editForm.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: 123 Rue de la Paix, 75008 Paris"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Téléphone
                        </label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: 01 23 45 67 89"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email du magasin
                        </label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: contact@boutique.fr"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description / Notes
                        </label>
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Ex: Flagship store, ouvert 7j/7"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Mode affichage */
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>
                          Coordonnées
                        </h4>
                        {store.address && (
                          <p className="text-gray-700 text-sm flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            {store.address}
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-gray-700 text-sm flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {store.phone}
                          </p>
                        )}
                        {store.email && (
                          <p className="text-gray-700 text-sm flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {store.email}
                          </p>
                        )}
                        {!store.address && !store.phone && !store.email && (
                          <p className="text-gray-400 text-sm italic">
                            Aucune coordonnée renseignée
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>
                          Équipe
                        </h4>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">
                              <strong>{store.manager_count || 0}</strong> manager{(store.manager_count || 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">
                              <strong>{store.seller_count || 0}</strong> vendeur{(store.seller_count || 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>
                          Notes
                        </h4>
                        {store.description ? (
                          <p className="text-gray-700 text-sm">{store.description}</p>
                        ) : (
                          <p className="text-gray-400 text-sm italic">Aucune description</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
