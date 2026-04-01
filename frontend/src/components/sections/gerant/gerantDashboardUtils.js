/**
 * Utilitaires de période pour le dashboard gérant.
 */

export function getPeriodDates(type, offset) {
  const now = new Date();
  if (type === 'week') {
    const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  } else if (type === 'month') {
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = new Date(target.getFullYear(), target.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  } else {
    const year = now.getFullYear() + offset;
    const start = new Date(year, 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
}

export function getPeriodNumber(type, date) {
  if (type === 'week') {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  if (type === 'month') return date.getMonth() + 1;
  return date.getFullYear();
}

export function formatPeriod(type, offset) {
  const { start, end } = getPeriodDates(type, offset);
  const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
  if (type === 'week') return offset === 0 ? `Semaine actuelle (${fmt(start)} - ${fmt(end)})` : `Semaine du ${fmt(start)} au ${fmt(end)}`;
  if (type === 'month') {
    const name = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return offset === 0 ? `Mois actuel (${name})` : name.charAt(0).toUpperCase() + name.slice(1);
  }
  const year = start.getFullYear();
  return offset === 0 ? `Année actuelle (${year})` : `Année ${year}`;
}

export function getPeriodLabel(type, offset) {
  const { start } = getPeriodDates(type, offset);
  if (type === 'week') return offset === 0 ? 'CA Sem. en cours' : `CA Sem. ${getPeriodNumber(type, start)}`;
  if (type === 'month') return `CA ${start.toLocaleDateString('fr-FR', { month: 'short' })}`;
  return `CA ${start.getFullYear()}`;
}
