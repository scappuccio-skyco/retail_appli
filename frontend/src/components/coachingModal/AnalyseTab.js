import React from 'react';
import PropTypes from 'prop-types';
import { MessageSquare, CheckCircle, XCircle, Filter } from 'lucide-react';
import VenteConclueForm from '../VenteConclueForm';
import OpportuniteManqueeForm from '../OpportuniteManqueeForm';
import { TabButton, EmptyState, getHistoryEmptyTitle, getHistoryEmptySubtitle, getHistoryListLabel } from './shared';
import { DebriefCard } from './DebriefCard';
import { logger } from '../../utils/logger';

export function AnalyseTab({
  analyseSubTab,
  onSetAnalyseSubTab,
  debriefs,
  expandedDebriefs,
  historyFilter,
  onSetHistoryFilter,
  onCreateDebrief,
  onToggleDebrief,
  onToggleVisibility,
  onDeleteDebrief,
  onSetExpandedDebriefs
}) {
  const handleFormSuccess = async () => {
    if (onCreateDebrief) {
      await onCreateDebrief();
    }
    onSetAnalyseSubTab('historique');
    setTimeout(() => {
      const firstAnalysis = document.querySelector('[data-debrief-card]');
      if (firstAnalysis) {
        const debriefId = firstAnalysis.dataset.debriefId;
        logger.log('Opening debrief:', debriefId);
        if (debriefId) {
          onSetExpandedDebriefs(prev => ({ [debriefId]: true }));
        }
        setTimeout(() => {
          firstAnalysis.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    }, 1200);
  };

  const filteredDebriefs = debriefs.filter(debrief => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'conclue') return debrief.vente_conclue === true;
    if (historyFilter === 'manquee') return debrief.vente_conclue === false;
    return true;
  });

  return (
    <div>
      {/* Sous-onglets Analyse */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 pt-3">
        <div className="flex gap-2">
          <TabButton
            active={analyseSubTab === 'conclue'}
            onClick={() => onSetAnalyseSubTab('conclue')}
            baseClass="px-4 py-2 font-medium text-sm transition-all rounded-t-lg"
            activeClass="bg-green-100 text-green-700 border-b-2 border-green-500"
            inactiveClass="text-gray-600 hover:text-green-600 hover:bg-gray-100"
          >
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Vente conclue
          </TabButton>
          <TabButton
            active={analyseSubTab === 'manquee'}
            onClick={() => onSetAnalyseSubTab('manquee')}
            activeClass="px-4 py-2 bg-orange-100 text-orange-700 border-b-2 border-orange-500"
            inactiveClass="px-4 py-2 text-gray-600 hover:text-orange-600 hover:bg-gray-100"
          >
            <XCircle className="w-4 h-4 inline mr-1" />
            Opportunité manquée
          </TabButton>
          <TabButton
            active={analyseSubTab === 'historique'}
            onClick={() => onSetAnalyseSubTab('historique')}
            baseClass="px-4 py-2 font-medium text-sm transition-all rounded-t-lg"
            activeClass="bg-purple-100 text-purple-700 border-b-2 border-purple-500"
            inactiveClass="text-gray-600 hover:text-purple-600 hover:bg-gray-100"
          >
            <MessageSquare className="w-4 h-4 inline mr-1" />
            Historique ({debriefs.length})
          </TabButton>
        </div>
      </div>

      {/* Contenu des sous-onglets */}
      {analyseSubTab === 'conclue' && (
        <VenteConclueForm onSuccess={handleFormSuccess} />
      )}

      {analyseSubTab === 'manquee' && (
        <OpportuniteManqueeForm onSuccess={handleFormSuccess} />
      )}

      {analyseSubTab === 'historique' && (
        <div>
          {/* Filtres */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Filtrer par type :</span>
              </div>
              <div className="flex gap-2">
                <TabButton
                  active={historyFilter === 'all'}
                  onClick={() => onSetHistoryFilter('all')}
                  baseClass="px-3 py-1.5 text-sm rounded-lg transition-all"
                  activeClass="bg-purple-600 text-white shadow-md"
                  inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                >
                  Tous
                </TabButton>
                <TabButton
                  active={historyFilter === 'conclue'}
                  onClick={() => onSetHistoryFilter('conclue')}
                  baseClass="px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1"
                  activeClass="bg-green-600 text-white shadow-md"
                  inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ventes conclues
                </TabButton>
                <TabButton
                  active={historyFilter === 'manquee'}
                  onClick={() => onSetHistoryFilter('manquee')}
                  baseClass="px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1"
                  activeClass="bg-orange-600 text-white shadow-md"
                  inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                >
                  <XCircle className="w-4 h-4" />
                  Opportunités manquées
                </TabButton>
              </div>
            </div>
          </div>

          <div className="p-6">
            {filteredDebriefs.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  {getHistoryListLabel(historyFilter, filteredDebriefs.length)}
                </p>
                {filteredDebriefs.map((debrief) => (
                  <DebriefCard
                    key={debrief.id}
                    debrief={debrief}
                    isExpanded={!!expandedDebriefs[debrief.id]}
                    onToggle={onToggleDebrief}
                    onToggleVisibility={onToggleVisibility}
                    onDelete={onDeleteDebrief}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title={getHistoryEmptyTitle(historyFilter)}
                subtitle={getHistoryEmptySubtitle(historyFilter)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

AnalyseTab.propTypes = {
  analyseSubTab: PropTypes.string.isRequired,
  onSetAnalyseSubTab: PropTypes.func.isRequired,
  debriefs: PropTypes.arrayOf(PropTypes.object).isRequired,
  expandedDebriefs: PropTypes.object.isRequired,
  historyFilter: PropTypes.string.isRequired,
  onSetHistoryFilter: PropTypes.func.isRequired,
  onCreateDebrief: PropTypes.func,
  onToggleDebrief: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
  onDeleteDebrief: PropTypes.func.isRequired,
  onSetExpandedDebriefs: PropTypes.func.isRequired
};
