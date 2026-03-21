import React from 'react';
import PropTypes from 'prop-types';

export const TAB_BUTTON_BASE_CLASS = 'px-3 md:px-4 py-2 text-sm md:text-base font-semibold transition-all rounded-t-lg';

export function TabButton({ active, onClick, children, activeClass, inactiveClass, baseClass = TAB_BUTTON_BASE_CLASS }) {
  const className = `${baseClass} ${active ? activeClass : inactiveClass}`;
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
TabButton.propTypes = {
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  activeClass: PropTypes.string.isRequired,
  inactiveClass: PropTypes.string.isRequired,
  baseClass: PropTypes.string
};

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-6 text-gray-500">
      {Icon && <Icon className="w-16 h-16 mx-auto mb-4 text-gray-300" />}
      <p className="text-lg font-semibold mb-2">{title}</p>
      <p className="text-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}
EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  action: PropTypes.node
};

export function getHistoryEmptyTitle(historyFilter) {
  if (historyFilter === 'all') return 'Aucune analyse pour le moment';
  if (historyFilter === 'conclue') return 'Aucune vente conclue';
  return 'Aucune opportunité manquée';
}

export function getHistoryEmptySubtitle(historyFilter) {
  return historyFilter === 'all'
    ? 'Créez votre première analyse de vente pour recevoir un coaching personnalisé'
    : 'Aucune analyse de ce type pour le moment';
}

export function getHistoryListLabel(historyFilter, count) {
  if (historyFilter === 'all') return `Toutes vos analyses (${count})`;
  if (historyFilter === 'conclue') return `Ventes conclues (${count})`;
  return `Opportunités manquées (${count})`;
}
