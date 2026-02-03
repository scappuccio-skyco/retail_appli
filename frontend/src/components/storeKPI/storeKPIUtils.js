/**
 * Utilitaires pour StoreKPIModal : dates, formatage, agrégations.
 * Réduit la complexité cognitive du composant principal.
 */

/** Retourne la semaine courante au format ISO "YYYY-Wxx" */
export function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Formate une date pour l'affichage des graphiques.
 * @param {string} dateStr - YYYY-MM-DD, nom de mois, ou "YYYY-Sxx"
 */
export function formatChartDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.match(/^[A-Za-zÀ-ÿ]+$/)) return dateStr;
  if (dateStr.includes('-S') || dateStr.includes('-B')) return dateStr;
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/** Calcule les dates de début/fin pour une semaine ISO "YYYY-Wxx" */
export function getWeekStartEnd(selectedWeek) {
  const [year, week] = selectedWeek.split('-W');
  const weekNum = Number.parseInt(week, 10);
  const yearNum = Number.parseInt(year, 10);
  const jan4 = new Date(yearNum, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - (dayOfWeek - 1));
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return { startDate, endDate, days: 7 };
}

/** Calcule les dates de début/fin pour un mois "YYYY-MM" */
export function getMonthStartEnd(selectedMonth) {
  const [year, month] = selectedMonth.split('-');
  const startDate = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10), 0, 23, 59, 59, 999));
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  return { startDate, endDate, days };
}

/** Calcule les dates de début/fin pour une année */
export function getYearStartEnd(selectedYear) {
  const startDate = new Date(selectedYear, 0, 1);
  const endDate = new Date(selectedYear, 11, 31);
  return { startDate, endDate, days: 365 };
}

/**
 * Remplit les jours manquants dans une plage (vue mois) avec des entrées à zéro.
 */
export function fillMissingDays(historicalArray, startDate, endDate) {
  const filledArray = [];
  const existingDates = new Set(historicalArray.map(d => d.date));
  const endOfRange = new Date(endDate);
  endOfRange.setUTCHours(23, 59, 59, 999);
  let currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0);
  const emptyEntry = (dateStr) => ({
    date: dateStr,
    seller_ca: 0,
    seller_ventes: 0,
    seller_clients: 0,
    seller_articles: 0,
    seller_prospects: 0
  });
  while (currentDate <= endOfRange) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const existing = historicalArray.find(item => item.date === dateStr);
    filledArray.push(existing || emptyEntry(dateStr));
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  return filledArray;
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Agrège les données par mois (vue année). */
export function aggregateByMonth(historicalArray) {
  const monthMap = {};
  historicalArray.forEach(day => {
    const monthKey = day.date.substring(0, 7);
    const [, month] = monthKey.split('-');
    const monthName = MONTH_NAMES[Number.parseInt(month, 10) - 1];
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        date: monthName,
        sortKey: monthKey,
        seller_ca: 0,
        seller_ventes: 0,
        seller_clients: 0,
        seller_articles: 0,
        seller_prospects: 0,
        count: 0
      };
    }
    monthMap[monthKey].seller_ca += day.seller_ca;
    monthMap[monthKey].seller_ventes += day.seller_ventes;
    monthMap[monthKey].seller_clients += day.seller_clients;
    monthMap[monthKey].seller_articles += day.seller_articles;
    monthMap[monthKey].seller_prospects += day.seller_prospects;
    monthMap[monthKey].count++;
  });
  return Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** Ajoute les métriques dérivées (panier_moyen, taux_transformation, indice_vente) à chaque entrée. */
export function addDerivedMetrics(aggregatedData) {
  return aggregatedData.map(period => ({
    ...period,
    total_ca: period.seller_ca,
    total_ventes: period.seller_ventes,
    total_clients: period.seller_clients,
    total_articles: period.seller_articles,
    total_prospects: period.seller_prospects,
    panier_moyen: period.seller_ventes > 0 ? period.seller_ca / period.seller_ventes : 0,
    taux_transformation: period.seller_prospects > 0
      ? (period.seller_ventes / period.seller_prospects) * 100
      : 0,
    indice_vente: period.seller_ventes > 0 ? period.seller_articles / period.seller_ventes : 0
  }));
}

/** Filtre les entrées par plage de dates (UTC). */
export function filterByDateRange(historicalArray, startDate, endDate) {
  const startUTC = new Date(startDate);
  startUTC.setUTCHours(0, 0, 0, 0);
  const endUTC = new Date(endDate);
  endUTC.setUTCHours(23, 59, 59, 999);
  return historicalArray.filter(day => {
    const dayDate = new Date(day.date + 'T00:00:00Z');
    return dayDate >= startUTC && dayDate <= endUTC;
  });
}

/** Extrait les années uniques des données (tri décroissant). */
export function extractAvailableYears(historicalArray) {
  return [...new Set(historicalArray.map(d => new Date(d.date).getFullYear()))].sort((a, b) => b - a);
}

/** Calcule les totaux et indicateurs pour la vue liste (période). */
export function computePeriodTotals(historicalData) {
  const totals = historicalData.reduce((acc, entry) => {
    const ca = entry.total_ca ?? entry.seller_ca ?? 0;
    const ventes = entry.total_ventes ?? entry.seller_ventes ?? 0;
    const articles = entry.total_articles ?? entry.seller_articles ?? 0;
    const prospects = entry.total_prospects ?? entry.seller_prospects ?? 0;
    const clients = entry.total_clients ?? entry.seller_clients ?? 0;
    return {
      total_ca: acc.total_ca + (typeof ca === 'number' ? ca : 0),
      total_ventes: acc.total_ventes + (typeof ventes === 'number' ? ventes : 0),
      total_articles: acc.total_articles + (typeof articles === 'number' ? articles : 0),
      total_prospects: acc.total_prospects + (typeof prospects === 'number' ? prospects : 0),
      total_clients: acc.total_clients + (typeof clients === 'number' ? clients : 0)
    };
  }, { total_ca: 0, total_ventes: 0, total_articles: 0, total_prospects: 0, total_clients: 0 });
  const panierMoyen = totals.total_ventes > 0
    ? (totals.total_ca / totals.total_ventes).toFixed(2)
    : '0.00';
  const tauxTransfo = totals.total_prospects > 0
    ? ((totals.total_ventes / totals.total_prospects) * 100).toFixed(1)
    : '0.0';
  const indiceVente = totals.total_ventes > 0
    ? (totals.total_articles / totals.total_ventes).toFixed(2)
    : '0.00';
  return { ...totals, panierMoyen, tauxTransfo, indiceVente };
}

/** Formate une entrée date pour affichage liste (jour ou nom de mois). */
export function formatListDateLabel(entryDate) {
  if (entryDate.includes('-')) {
    return new Date(entryDate + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  return entryDate;
}
