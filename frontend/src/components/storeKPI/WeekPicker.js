import React, { useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAY_NAMES = ['lu','ma','me','je','ve','sa','di'];

function dateToISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isoWeekToMonday(year, weekNo) {
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1) + (weekNo - 1) * 7);
  return monday;
}

export function weekLabel(isoWeek) {
  const [year, wPart] = isoWeek.split('-W');
  const weekNo = parseInt(wPart, 10);
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1) + (weekNo - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `S${weekNo} · ${fmt(monday)} – ${fmt(sunday)}`;
}

export function WeekPicker({ value, onChange, datesWithData }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);

  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, w] = value.split('-W');
      const m = isoWeekToMonday(parseInt(y, 10), parseInt(w, 10));
      return { year: m.getFullYear(), month: m.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const weeksWithData = useMemo(
    () => new Set((datesWithData || []).map(dateToISOWeek)),
    [datesWithData]
  );

  function getDateISOWeek(date) {
    const d = new Date(date);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function getWeekRows() {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1);
    const startDay = new Date(firstDay);
    const dow = startDay.getDay() === 0 ? 7 : startDay.getDay();
    startDay.setDate(startDay.getDate() - (dow - 1));
    const rows = [];
    const cur = new Date(startDay);
    for (let row = 0; row < 6; row++) {
      const weekStart = new Date(cur);
      const days = Array.from({ length: 7 }, () => { const d = new Date(cur); cur.setDate(cur.getDate() + 1); return d; });
      rows.push({ isoWeek: getDateISOWeek(weekStart), days });
      if (cur.getMonth() !== month && row >= 3) break;
    }
    return rows;
  }

  const weekRows = getWeekRows();
  const displayValue = value ? weekLabel(value) : 'Sélectionner une semaine';

  const handlePrev = () => setViewDate(prev => {
    const d = new Date(prev.year, prev.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const handleNext = () => setViewDate(prev => {
    const d = new Date(prev.year, prev.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div className="relative flex-1 max-w-md">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer bg-white text-left flex items-center justify-between text-sm font-medium text-gray-700"
      >
        <span>📅 {displayValue}</span>
        <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[9999] min-w-[300px]">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs font-bold text-gray-800">
                {MONTH_NAMES[viewDate.month]} {viewDate.year}
              </span>
              <button type="button" onClick={handleNext} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
              ))}
            </div>

            <div className="space-y-0.5">
              {weekRows.map(({ isoWeek, days }) => {
                const isSelected = value === isoWeek;
                const hasData = weeksWithData.has(isoWeek);
                return (
                  <button
                    key={isoWeek}
                    type="button"
                    onClick={() => { onChange(isoWeek); setIsOpen(false); }}
                    title={hasData ? 'Cette semaine a des données' : ''}
                    className={`w-full grid grid-cols-7 gap-0.5 rounded-lg px-0.5 py-0.5 transition-all border ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                        : hasData
                        ? 'bg-green-100 hover:bg-green-200 text-green-900 border-green-300'
                        : 'hover:bg-gray-100 text-gray-700 border-transparent'
                    }`}
                  >
                    {days.map((day, i) => (
                      <div key={i} className={`text-xs text-center py-1 rounded ${day.getMonth() !== viewDate.month ? 'opacity-30' : ''}`}>
                        {day.getDate()}
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-200 flex gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-100 rounded border border-green-300" />
                <span>Données</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-orange-500 rounded" />
                <span>Sélectionnée</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

WeekPicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  datesWithData: PropTypes.arrayOf(PropTypes.string),
};

export default WeekPicker;
