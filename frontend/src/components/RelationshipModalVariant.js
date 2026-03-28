/**
 * RelationshipModalVariant — Variantes B et C de RelationshipManagementModal
 *
 * B — "Guide Structuré" : header indigo sombre, sidebar de navigation verticale,
 *     formulaire avec étapes colorées, historique en timeline verticale.
 *
 * C — "Compact Flow" : header blanc minimal, navigation en pills horizontales,
 *     formulaire condensé sur fond clair, historique en cartes accordéon.
 */
import React from 'react';
import { X, MessageCircle, AlertTriangle, Calendar, Users, ChevronRight } from 'lucide-react';
import useRelationshipManagementModal from './relationshipModal/useRelationshipManagementModal';
import FormTab from './relationshipModal/FormTab';
import HistoryTab from './relationshipModal/HistoryTab';

/* ══════════════════════════════════════
   STYLE B — Guide Structuré
══════════════════════════════════════ */
function ModalVariantB({ onClose, onSuccess, sellers = [], autoShowResult = false, storeId = null }) {
  const s = useRelationshipManagementModal({ sellers, autoShowResult, storeId, onSuccess });

  const navItems = [
    { id: 'relationnel', tab: 'form', formTab: 'relationnel', icon: MessageCircle, label: 'Gestion relationnelle', color: 'text-indigo-400', activeBg: 'bg-indigo-600' },
    { id: 'conflit', tab: 'form', formTab: 'conflit', icon: AlertTriangle, label: 'Gestion de conflit', color: 'text-rose-400', activeBg: 'bg-rose-600' },
    { id: 'history', tab: 'history', formTab: null, icon: Calendar, label: 'Historique', color: 'text-emerald-400', activeBg: 'bg-emerald-600' },
  ];

  const activeNav = s.activeMainTab === 'history' ? 'history' : s.activeFormTab;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header sombre */}
        <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-800 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Gestion relationnelle & Conflit</h2>
              <p className="text-xs text-indigo-400">Recommandations IA personnalisées</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-indigo-900 hover:bg-indigo-800 transition-colors">
            <X className="w-4 h-4 text-indigo-300" />
          </button>
        </div>

        {/* Layout : sidebar gauche + contenu droite */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 bg-gray-50 border-r border-gray-100 flex flex-col py-4 px-3 gap-1 flex-shrink-0">
            {navItems.map(({ id, tab, formTab, icon: Icon, label, color, activeBg }) => {
              const isActive = activeNav === id;
              return (
                <button key={id}
                  onClick={() => { s.setActiveMainTab(tab); if (formTab) { s.setActiveFormTab(formTab); s.resetForm(); } }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? `${activeBg} text-white shadow-md` : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : color}`} />
                  <span className="text-left">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                </button>
              );
            })}

            {/* Indicateur de l'historique */}
            <div className="mt-auto px-3 py-3 border-t border-gray-200">
              <p className="text-xs text-gray-400">{s.history?.length ?? 0} consultation{(s.history?.length ?? 0) > 1 ? 's' : ''} enregistrée{(s.history?.length ?? 0) > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto p-6">
            {s.activeMainTab === 'form' ? (
              <FormTab
                activeFormTab={s.activeFormTab}
                activeSellers={s.activeSellers}
                selectedSeller={s.selectedSeller}
                setSelectedSeller={s.setSelectedSeller}
                isSellerDropdownOpen={s.isSellerDropdownOpen}
                setIsSellerDropdownOpen={s.setIsSellerDropdownOpen}
                sellerDropdownRef={s.sellerDropdownRef}
                situationType={s.situationType}
                setSituationType={s.setSituationType}
                situationTypes={s.situationTypes}
                description={s.description}
                setDescription={s.setDescription}
                conflictContexte={s.conflictContexte}
                setConflictContexte={s.setConflictContexte}
                conflictComportement={s.conflictComportement}
                setConflictComportement={s.setConflictComportement}
                conflictImpact={s.conflictImpact}
                setConflictImpact={s.setConflictImpact}
                conflictTentatives={s.conflictTentatives}
                setConflictTentatives={s.setConflictTentatives}
                onSubmit={s.handleGenerateAdvice}
              />
            ) : (
              <HistoryTab
                history={s.history}
                filteredHistory={s.filteredHistory}
                activeHistoryTab={s.activeHistoryTab}
                setActiveHistoryTab={s.setActiveHistoryTab}
                historyFilter={s.historyFilter}
                setHistoryFilter={s.setHistoryFilter}
                loadHistory={s.loadHistory}
                isFilterDropdownOpen={s.isFilterDropdownOpen}
                setIsFilterDropdownOpen={s.setIsFilterDropdownOpen}
                filterDropdownRef={s.filterDropdownRef}
                sellers={sellers}
                expandedItems={s.expandedItems}
                setExpandedItems={s.setExpandedItems}
                resolvingItem={s.resolvingItem}
                onToggleResolved={s.handleToggleResolved}
                onDelete={s.handleDeleteConsultation}
                situationTypes={s.situationTypes}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Compact Flow
══════════════════════════════════════ */
function ModalVariantC({ onClose, onSuccess, sellers = [], autoShowResult = false, storeId = null }) {
  const s = useRelationshipManagementModal({ sellers, autoShowResult, storeId, onSuccess });

  const pills = [
    { id: 'relationnel', tab: 'form', formTab: 'relationnel', label: '💬 Relationnel', activeClass: 'bg-indigo-600 text-white shadow' },
    { id: 'conflit', tab: 'form', formTab: 'conflit', label: '⚠️ Conflit', activeClass: 'bg-rose-500 text-white shadow' },
    { id: 'history', tab: 'history', formTab: null, label: `📋 Historique (${s.history?.length ?? 0})`, activeClass: 'bg-emerald-600 text-white shadow' },
  ];

  const activeId = s.activeMainTab === 'history' ? 'history' : s.activeFormTab;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header blanc avec accent violet */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gestion relationnelle & Conflit</h2>
                <p className="text-xs text-gray-400">Recommandations IA · {sellers.length} vendeur{sellers.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Pills de navigation */}
          <div className="flex gap-2 flex-wrap">
            {pills.map(({ id, tab, formTab, label, activeClass }) => (
              <button key={id}
                onClick={() => { s.setActiveMainTab(tab); if (formTab) { s.setActiveFormTab(formTab); s.resetForm(); } }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeId === id ? activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {s.activeMainTab === 'form' ? (
            <FormTab
              activeFormTab={s.activeFormTab}
              activeSellers={s.activeSellers}
              selectedSeller={s.selectedSeller}
              setSelectedSeller={s.setSelectedSeller}
              isSellerDropdownOpen={s.isSellerDropdownOpen}
              setIsSellerDropdownOpen={s.setIsSellerDropdownOpen}
              sellerDropdownRef={s.sellerDropdownRef}
              situationType={s.situationType}
              setSituationType={s.setSituationType}
              situationTypes={s.situationTypes}
              description={s.description}
              setDescription={s.setDescription}
              conflictContexte={s.conflictContexte}
              setConflictContexte={s.setConflictContexte}
              conflictComportement={s.conflictComportement}
              setConflictComportement={s.setConflictComportement}
              conflictImpact={s.conflictImpact}
              setConflictImpact={s.setConflictImpact}
              conflictTentatives={s.conflictTentatives}
              setConflictTentatives={s.setConflictTentatives}
              onSubmit={s.handleGenerateAdvice}
            />
          ) : (
            <HistoryTab
              history={s.history}
              filteredHistory={s.filteredHistory}
              activeHistoryTab={s.activeHistoryTab}
              setActiveHistoryTab={s.setActiveHistoryTab}
              historyFilter={s.historyFilter}
              setHistoryFilter={s.setHistoryFilter}
              loadHistory={s.loadHistory}
              isFilterDropdownOpen={s.isFilterDropdownOpen}
              setIsFilterDropdownOpen={s.setIsFilterDropdownOpen}
              filterDropdownRef={s.filterDropdownRef}
              sellers={sellers}
              expandedItems={s.expandedItems}
              setExpandedItems={s.setExpandedItems}
              resolvingItem={s.resolvingItem}
              onToggleResolved={s.handleToggleResolved}
              onDelete={s.handleDeleteConsultation}
              situationTypes={s.situationTypes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Export ─── */
export default function RelationshipModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
