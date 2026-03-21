import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

const EMPTY_FORM = {
  produit: '',
  type_client: '',
  description_vente: '',
  moment_perte_client: [],
  moment_perte_autre: '',
  raisons_echec: [],
  raisons_echec_autre: '',
  amelioration_pensee: '',
  shared_with_manager: false,
};

function buildMoment(form) {
  return form.moment_perte_client.includes('Autre')
    ? form.moment_perte_client.filter(m => m !== 'Autre').concat([form.moment_perte_autre]).join(', ')
    : form.moment_perte_client.join(', ');
}

function buildRaisons(form) {
  return form.raisons_echec.includes('Autre')
    ? form.raisons_echec.filter(r => r !== 'Autre').concat([form.raisons_echec_autre]).join(', ')
    : form.raisons_echec.join(', ');
}

export default function useDebriefHistoryModal({ onSuccess, autoExpandDebriefId }) {
  const [debriefs, setDebriefs] = useState([]);
  const [filtreHistorique, setFiltreHistorique] = useState('all');
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [showVenteConclueForm, setShowVenteConclueForm] = useState(false);
  const [showOpportuniteManqueeForm, setShowOpportuniteManqueeForm] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState(null);
  const [formConclue, setFormConclue] = useState(EMPTY_FORM);
  const [formManquee, setFormManquee] = useState(EMPTY_FORM);

  useEffect(() => { fetchDebriefs(); }, []);

  useEffect(() => {
    if (pendingSuccess && onSuccess) { onSuccess(pendingSuccess); setPendingSuccess(null); }
  }, [pendingSuccess, onSuccess]);

  useEffect(() => {
    if (autoExpandDebriefId && debriefs.length > 0) {
      if (debriefs.find(d => d.id === autoExpandDebriefId)) {
        setExpandedDebriefs(prev => ({ ...prev, [autoExpandDebriefId]: true }));
        setTimeout(() => {
          document.querySelector(`[data-debrief-id="${autoExpandDebriefId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    }
  }, [autoExpandDebriefId, debriefs]);

  const fetchDebriefs = async () => {
    try {
      const response = await api.get('/debriefs');
      setDebriefs(response.data);
    } catch (error) {
      logger.error('Erreur chargement debriefs:', error);
    }
  };

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({ ...prev, [debriefId]: !prev[debriefId] }));
  };

  const toggleCheckbox = (form, setForm, field, value) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(i => i !== value) : [...arr, value] };
    });
  };

  const validateConclue = () => {
    if (!formConclue.produit.trim()) { toast.error('📦 Veuillez indiquer le produit vendu'); return false; }
    if (!formConclue.type_client) { toast.error('👤 Veuillez sélectionner le type de client'); return false; }
    if (!formConclue.description_vente.trim()) { toast.error('💬 Veuillez décrire brièvement la vente'); return false; }
    if (!formConclue.moment_perte_client.length) { toast.error('✨ Veuillez sélectionner au moins un moment clé du succès'); return false; }
    if (formConclue.moment_perte_client.includes('Autre') && !formConclue.moment_perte_autre.trim()) { toast.error('✨ Veuillez préciser le moment clé (Autre)'); return false; }
    if (!formConclue.raisons_echec.length) { toast.error('🎉 Veuillez sélectionner au moins un facteur de réussite'); return false; }
    if (formConclue.raisons_echec.includes('Autre') && !formConclue.raisons_echec_autre.trim()) { toast.error('🎉 Veuillez préciser les facteurs de réussite (Autre)'); return false; }
    if (!formConclue.amelioration_pensee.trim()) { toast.error('💪 Veuillez indiquer ce qui a fait la différence'); return false; }
    return true;
  };

  const validateManquee = () => {
    if (!formManquee.produit.trim()) { toast.error('📦 Veuillez indiquer le produit'); return false; }
    if (!formManquee.type_client) { toast.error('👤 Veuillez sélectionner le type de client'); return false; }
    if (!formManquee.description_vente.trim()) { toast.error("💬 Veuillez décrire ce qui s'est passé"); return false; }
    if (!formManquee.moment_perte_client.length) { toast.error("⏱️ Veuillez sélectionner au moins un moment où ça a basculé"); return false; }
    if (formManquee.moment_perte_client.includes('Autre') && !formManquee.moment_perte_autre.trim()) { toast.error('⏱️ Veuillez préciser le moment (Autre)'); return false; }
    if (!formManquee.raisons_echec.length) { toast.error("🤔 Veuillez sélectionner au moins une raison de l'échec"); return false; }
    if (formManquee.raisons_echec.includes('Autre') && !formManquee.raisons_echec_autre.trim()) { toast.error('🤔 Veuillez préciser les raisons (Autre)'); return false; }
    if (!formManquee.amelioration_pensee.trim()) { toast.error('🔄 Veuillez indiquer ce que vous auriez pu faire différemment'); return false; }
    return true;
  };

  const handleSubmitConclue = async () => {
    if (!validateConclue()) return;
    setLoading(true);
    try {
      const response = await api.post('/debriefs', {
        vente_conclue: true,
        shared_with_manager: formConclue.shared_with_manager,
        produit: formConclue.produit,
        type_client: formConclue.type_client,
        situation_vente: 'En magasin',
        description_vente: formConclue.description_vente,
        moment_perte_client: buildMoment(formConclue),
        raisons_echec: buildRaisons(formConclue),
        amelioration_pensee: formConclue.amelioration_pensee,
      });
      toast.success('🎉 Analyse créée avec succès !');
      setPendingSuccess(response.data);
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erreur lors de la création');
      setLoading(false);
    }
  };

  const handleSubmitManquee = async () => {
    if (!validateManquee()) return;
    setLoading(true);
    try {
      const response = await api.post('/debriefs', {
        vente_conclue: false,
        shared_with_manager: formManquee.shared_with_manager,
        produit: formManquee.produit,
        type_client: formManquee.type_client,
        situation_vente: 'En magasin',
        description_vente: formManquee.description_vente,
        moment_perte_client: buildMoment(formManquee),
        raisons_echec: buildRaisons(formManquee),
        amelioration_pensee: formManquee.amelioration_pensee,
      });
      toast.success('Analyse créée avec succès !');
      setPendingSuccess(response.data);
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erreur lors de la création');
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (debriefId, currentVisibility) => {
    try {
      const newVisibility = !currentVisibility;
      await api.patch(`/debriefs/${debriefId}/visibility`, { shared_with_manager: newVisibility });
      setDebriefs(prev => prev.map(d => d.id === debriefId ? { ...d, shared_with_manager: newVisibility } : d));
      toast.success(newVisibility ? '✅ Analyse partagée avec le manager' : '🔒 Analyse masquée au manager');
    } catch (error) {
      logger.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const sortedAndLimitedDebriefs = useMemo(() => {
    let filtered = [...debriefs];
    if (filtreHistorique === 'conclue') filtered = filtered.filter(d => d.vente_conclue === true);
    else if (filtreHistorique === 'manquee') filtered = filtered.filter(d => !d.vente_conclue);
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, displayLimit);
  }, [debriefs, displayLimit, filtreHistorique]);

  return {
    debriefs, filtreHistorique, setFiltreHistorique,
    expandedDebriefs, displayLimit, setDisplayLimit, loading,
    showVenteConclueForm, setShowVenteConclueForm,
    showOpportuniteManqueeForm, setShowOpportuniteManqueeForm,
    formConclue, setFormConclue, formManquee, setFormManquee,
    sortedAndLimitedDebriefs,
    hasMore: displayLimit < debriefs.length,
    remainingCount: debriefs.length - displayLimit,
    toggleDebrief, toggleCheckbox,
    handleSubmitConclue, handleSubmitManquee, handleToggleVisibility,
  };
}
