import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { toast } from 'sonner';

export default function useGerantBusinessContext() {
  const [contextModal, setContextModal] = useState(null); // { storeIds: [], title: '' }
  const [contextForm, setContextForm] = useState({});
  const [contextLoading, setContextLoading] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);

  useEffect(() => {
    if (!contextModal) return;
    setContextLoading(true);
    api.get(`/gerant/stores/${contextModal.storeIds[0]}/business-context`)
      .then(res => {
        if (res.data?.business_context) {
          const bc = res.data.business_context;
          // rétrocompat : kpi_prioritaire était une string, on normalise en tableau
          if (bc.kpi_prioritaire && !Array.isArray(bc.kpi_prioritaire)) {
            bc.kpi_prioritaire = [bc.kpi_prioritaire];
          }
          setContextForm(bc);
        } else {
          setContextForm({});
        }
      })
      .catch(() => setContextForm({}))
      .finally(() => setContextLoading(false));
  }, [contextModal]);

  const handleContextSave = async () => {
    setContextSaving(true);
    try {
      await Promise.all(contextModal.storeIds.map(id =>
        api.put(`/gerant/stores/${id}/business-context`, { business_context: contextForm })
      ));
      toast.success(contextModal.storeIds.length > 1
        ? `Contexte appliqué à ${contextModal.storeIds.length} magasins`
        : 'Contexte enregistré');
      setContextModal(null);
      setContextForm({});
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setContextSaving(false);
    }
  };

  const toggleClientele = (val) => setContextForm(prev => ({
    ...prev,
    clientele_cible: (prev.clientele_cible || []).includes(val)
      ? (prev.clientele_cible || []).filter(v => v !== val)
      : [...(prev.clientele_cible || []), val],
  }));

  const toggleKpi = (val) => setContextForm(prev => ({
    ...prev,
    kpi_prioritaire: (prev.kpi_prioritaire || []).includes(val)
      ? (prev.kpi_prioritaire || []).filter(v => v !== val)
      : [...(prev.kpi_prioritaire || []), val],
  }));

  const openContextModal = (storeIds, title) => {
    setContextForm({});
    setContextModal({ storeIds, title });
  };

  const closeContextModal = () => {
    setContextModal(null);
    setContextForm({});
  };

  return {
    contextModal, contextForm, contextLoading, contextSaving,
    openContextModal, closeContextModal,
    handleContextSave, toggleClientele, toggleKpi,
    setContextForm,
  };
}
