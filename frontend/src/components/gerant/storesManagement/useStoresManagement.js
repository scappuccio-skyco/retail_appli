import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';

export default function useStoresManagement({ isReadOnly, onRefresh }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchStores(); }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const response = await api.get('/gerant/stores');
      setStores(response.data);
    } catch (error) {
      logger.error('Erreur chargement magasins:', error);
      toast.error('Erreur lors du chargement des magasins');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (store) => {
    if (isReadOnly) { toast.error('Mode lecture seule - Abonnement requis'); return; }
    setEditingStore(store.id);
    setEditForm({
      name: store.name || '',
      location: store.location || '',
      phone: store.phone || '',
      email: store.email || '',
      address: store.address || '',
      description: store.description || '',
    });
  };

  const handleCancel = () => { setEditingStore(null); setEditForm({}); };

  const handleSave = async (storeId) => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      await api.put(`/gerant/stores/${storeId}`, editForm);
      toast.success('Magasin mis à jour avec succès !');
      setEditingStore(null);
      setEditForm({});
      fetchStores();
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Erreur mise à jour:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  return {
    stores, loading, editingStore, editForm, saving,
    handleEdit, handleCancel, handleSave, handleInputChange,
  };
}
