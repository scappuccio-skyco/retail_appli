import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import VenteConclueFormSection from './debriefHistory/VenteConclueFormSection';
import OpportuniteManqueeFormSection from './debriefHistory/OpportuniteManqueeFormSection';
import DebriefHistoryList from './debriefHistory/DebriefHistoryList';

export default function DebriefHistoryModal({ onClose, onSuccess, autoExpandDebriefId }) {
  const [filtreHistorique, setFiltreHistorique] = useState('all');
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  // Gestion interne de l'historique (comme DebriefModal)
  const [debriefs, setDebriefs] = useState([]);

  // Modal states
  const [showVenteConclueForm, setShowVenteConclueForm] = useState(false);
  const [showOpportuniteManqueeForm, setShowOpportuniteManqueeForm] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState(null);

  // Charger l'historique au montage (comme DebriefModal)
  useEffect(() => {
    fetchDebriefs();
  }, []);

  // Gérer onSuccess APRÈS le rendu pour éviter conflit DOM
  useEffect(() => {
    if (pendingSuccess && onSuccess) {
      onSuccess(pendingSuccess);
      setPendingSuccess(null);
    }
  }, [pendingSuccess, onSuccess]);

  // Ouvrir automatiquement la dernière analyse créée (via prop du parent)
  useEffect(() => {
    if (autoExpandDebriefId && debriefs.length > 0) {
      const debriefExists = debriefs.find(d => d.id === autoExpandDebriefId);
      if (debriefExists) {
        setExpandedDebriefs(prev => ({
          ...prev,
          [autoExpandDebriefId]: true,
        }));

        // Scroll vers l'analyse après un court délai
        setTimeout(() => {
          const element = document.querySelector(`[data-debrief-id="${autoExpandDebriefId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
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

  // Form vente conclue
  const [formConclue, setFormConclue] = useState({
    produit: '',
    type_client: '',
    description_vente: '',
    moment_perte_client: [],
    moment_perte_autre: '',
    raisons_echec: [],
    raisons_echec_autre: '',
    amelioration_pensee: '',
    shared_with_manager: false,
  });

  // Form opportunité manquée
  const [formManquee, setFormManquee] = useState({
    produit: '',
    type_client: '',
    description_vente: '',
    moment_perte_client: [],
    moment_perte_autre: '',
    raisons_echec: [],
    raisons_echec_autre: '',
    amelioration_pensee: '',
    shared_with_manager: false,
  });

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId],
    }));
  };

  // Toggle checkbox pour sélection multiple
  const toggleCheckbox = (form, setForm, field, value) => {
    setForm(prev => {
      const currentArray = prev[field] || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };

  // Soumettre vente conclue
  const handleSubmitConclue = async () => {
    if (!formConclue.produit.trim()) {
      toast.error('📦 Veuillez indiquer le produit vendu');
      return;
    }
    if (!formConclue.type_client) {
      toast.error('👤 Veuillez sélectionner le type de client');
      return;
    }
    if (!formConclue.description_vente.trim()) {
      toast.error('💬 Veuillez décrire brièvement la vente');
      return;
    }
    if (formConclue.moment_perte_client.length === 0) {
      toast.error('✨ Veuillez sélectionner au moins un moment clé du succès');
      return;
    }
    if (formConclue.moment_perte_client.includes('Autre') && !formConclue.moment_perte_autre.trim()) {
      toast.error('✨ Veuillez préciser le moment clé (Autre)');
      return;
    }
    if (formConclue.raisons_echec.length === 0) {
      toast.error('🎉 Veuillez sélectionner au moins un facteur de réussite');
      return;
    }
    if (formConclue.raisons_echec.includes('Autre') && !formConclue.raisons_echec_autre.trim()) {
      toast.error('🎉 Veuillez préciser les facteurs de réussite (Autre)');
      return;
    }
    if (!formConclue.amelioration_pensee.trim()) {
      toast.error('💪 Veuillez indiquer ce qui a fait la différence');
      return;
    }

    setLoading(true);
    try {
      const moment = formConclue.moment_perte_client.includes('Autre')
        ? formConclue.moment_perte_client.filter(m => m !== 'Autre').concat([formConclue.moment_perte_autre]).join(', ')
        : formConclue.moment_perte_client.join(', ');
      const raisons = formConclue.raisons_echec.includes('Autre')
        ? formConclue.raisons_echec.filter(r => r !== 'Autre').concat([formConclue.raisons_echec_autre]).join(', ')
        : formConclue.raisons_echec.join(', ');

      const response = await api.post('/debriefs', {
        vente_conclue: true,
        shared_with_manager: formConclue.shared_with_manager,
        produit: formConclue.produit,
        type_client: formConclue.type_client,
        situation_vente: 'En magasin',
        description_vente: formConclue.description_vente,
        moment_perte_client: moment,
        raisons_echec: raisons,
        amelioration_pensee: formConclue.amelioration_pensee,
      });

      toast.success('🎉 Analyse créée avec succès !');
      // Déclencher onSuccess via useEffect pour éviter conflit DOM
      setPendingSuccess(response.data);
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erreur lors de la création');
      setLoading(false);
    }
  };

  // Soumettre opportunité manquée
  const handleSubmitManquee = async () => {
    if (!formManquee.produit.trim()) {
      toast.error('📦 Veuillez indiquer le produit');
      return;
    }
    if (!formManquee.type_client) {
      toast.error('👤 Veuillez sélectionner le type de client');
      return;
    }
    if (!formManquee.description_vente.trim()) {
      toast.error("💬 Veuillez décrire ce qui s'est passé");
      return;
    }
    if (formManquee.moment_perte_client.length === 0) {
      toast.error("⏱️ Veuillez sélectionner au moins un moment où ça a basculé");
      return;
    }
    if (formManquee.moment_perte_client.includes('Autre') && !formManquee.moment_perte_autre.trim()) {
      toast.error('⏱️ Veuillez préciser le moment (Autre)');
      return;
    }
    if (formManquee.raisons_echec.length === 0) {
      toast.error("🤔 Veuillez sélectionner au moins une raison de l'échec");
      return;
    }
    if (formManquee.raisons_echec.includes('Autre') && !formManquee.raisons_echec_autre.trim()) {
      toast.error('🤔 Veuillez préciser les raisons (Autre)');
      return;
    }
    if (!formManquee.amelioration_pensee.trim()) {
      toast.error('🔄 Veuillez indiquer ce que vous auriez pu faire différemment');
      return;
    }

    setLoading(true);
    try {
      const moment = formManquee.moment_perte_client.includes('Autre')
        ? formManquee.moment_perte_client.filter(m => m !== 'Autre').concat([formManquee.moment_perte_autre]).join(', ')
        : formManquee.moment_perte_client.join(', ');
      const raisons = formManquee.raisons_echec.includes('Autre')
        ? formManquee.raisons_echec.filter(r => r !== 'Autre').concat([formManquee.raisons_echec_autre]).join(', ')
        : formManquee.raisons_echec.join(', ');

      const response = await api.post('/debriefs', {
        vente_conclue: false,
        shared_with_manager: formManquee.shared_with_manager,
        produit: formManquee.produit,
        type_client: formManquee.type_client,
        situation_vente: 'En magasin',
        description_vente: formManquee.description_vente,
        moment_perte_client: moment,
        raisons_echec: raisons,
        amelioration_pensee: formManquee.amelioration_pensee,
      });

      toast.success('Analyse créée avec succès !');
      // Déclencher onSuccess via useEffect pour éviter conflit DOM
      setPendingSuccess(response.data);
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Erreur lors de la création');
      setLoading(false);
    }
  };

  // Toggle la visibilité d'une analyse pour le manager
  const handleToggleVisibility = async (debriefId, currentVisibility) => {
    try {
      const newVisibility = !currentVisibility;

      await api.patch(`/debriefs/${debriefId}/visibility`, {
        shared_with_manager: newVisibility,
      });

      // Mettre à jour localement sans fermer le modal
      setDebriefs(prev => prev.map(d =>
        d.id === debriefId ? { ...d, shared_with_manager: newVisibility } : d
      ));

      toast.success(
        newVisibility
          ? '✅ Analyse partagée avec le manager'
          : '🔒 Analyse masquée au manager'
      );
    } catch (error) {
      logger.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  // Filtrer debriefs
  const sortedAndLimitedDebriefs = useMemo(() => {
    let filtered = [...debriefs];

    if (filtreHistorique === 'conclue') {
      filtered = filtered.filter(d => d.vente_conclue === true);
    } else if (filtreHistorique === 'manquee') {
      filtered = filtered.filter(d => d.vente_conclue === false || !d.vente_conclue);
    }

    const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.slice(0, displayLimit);
  }, [debriefs, displayLimit, filtreHistorique]);

  const hasMore = displayLimit < debriefs.length;
  const remainingCount = debriefs.length - displayLimit;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) { onClose(); } }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Analyse de vente</h2>
              {debriefs.length > 0 && (
                <p className="text-blue-100 text-sm mt-1">
                  {debriefs.length} analyse{debriefs.length > 1 ? 's' : ''} enregistrée{debriefs.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showVenteConclueForm && (
            <VenteConclueFormSection
              formConclue={formConclue}
              setFormConclue={setFormConclue}
              loading={loading}
              onSubmit={handleSubmitConclue}
              onBack={() => setShowVenteConclueForm(false)}
              toggleCheckbox={toggleCheckbox}
            />
          )}

          {showOpportuniteManqueeForm && (
            <OpportuniteManqueeFormSection
              formManquee={formManquee}
              setFormManquee={setFormManquee}
              loading={loading}
              onSubmit={handleSubmitManquee}
              onBack={() => setShowOpportuniteManqueeForm(false)}
              toggleCheckbox={toggleCheckbox}
            />
          )}

          {!showVenteConclueForm && !showOpportuniteManqueeForm && (
            <DebriefHistoryList
              debriefs={debriefs}
              sortedAndLimitedDebriefs={sortedAndLimitedDebriefs}
              filtreHistorique={filtreHistorique}
              setFiltreHistorique={setFiltreHistorique}
              expandedDebriefs={expandedDebriefs}
              toggleDebrief={toggleDebrief}
              hasMore={hasMore}
              remainingCount={remainingCount}
              onLoadMore={() => setDisplayLimit(prev => prev + 20)}
              onShowVenteConclue={() => setShowVenteConclueForm(true)}
              onShowOpportuniteManquee={() => setShowOpportuniteManqueeForm(true)}
              onToggleVisibility={handleToggleVisibility}
            />
          )}
        </div>
      </div>
    </div>
  );
}
