import { useState, useMemo, useEffect } from 'react';

export const SECTION_NAMES = {
  performances: '📈 Mes Performances',
  objectives: '🎯 Objectifs & Challenges',
  coaching: '🤖 Mon coach IA',
  preparation: '📝 Préparer mon Entretien',
};

const AVAILABLE_SECTIONS = Object.keys(SECTION_NAMES);

export function useSellerPersonalization() {
  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem('seller_dashboard_filters');
    return saved ? JSON.parse(saved) : {
      showPerformances: true,
      showObjectives: true,
      showCoaching: true,
      showPreparation: true,
      periodFilter: 'all',
    };
  });

  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('seller_section_order');
    return saved ? JSON.parse(saved) : ['performances', 'objectives', 'coaching', 'preparation'];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('seller_dashboard_filters', JSON.stringify(dashboardFilters));
  }, [dashboardFilters]);

  useEffect(() => {
    localStorage.setItem('seller_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  const finalOrder = useMemo(() => {
    const validOrder = sectionOrder.filter(id => AVAILABLE_SECTIONS.includes(id) && id !== 'profile');
    const missing = AVAILABLE_SECTIONS.filter(id => !validOrder.includes(id));
    return [...validOrder, ...missing];
  }, [sectionOrder]);

  const toggleFilter = (filterName) => {
    setDashboardFilters(prev => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  const moveSectionUp = (sectionId) => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx > 0) {
      const next = [...sectionOrder];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setSectionOrder(next);
    }
  };

  const moveSectionDown = (sectionId) => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx < sectionOrder.length - 1) {
      const next = [...sectionOrder];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setSectionOrder(next);
    }
  };

  return {
    dashboardFilters,
    finalOrder,
    toggleFilter,
    moveSectionUp,
    moveSectionDown,
  };
}
