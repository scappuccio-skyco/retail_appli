import React from 'react';
import { TrendingUp, Download } from 'lucide-react';
import KPICalendar from '../KPICalendar';
import { WeekPicker } from '../storeKPI/WeekPicker';
import { getWeekStartEnd } from '../storeKPI/storeKPIUtils';
import DayView from './bilanTab/DayView';
import WeekView from './bilanTab/WeekView';
import MonthYearView from './bilanTab/MonthYearView';

export default function BilanTab({
  viewMode, setViewMode,
  selectedDay, setSelectedDay,
  selectedWeek, setSelectedWeek,
  selectedMonth, setSelectedMonth,
  selectedYear, setSelectedYear,
  periodLoading, periodEntries, periodBilan, periodGenerating,
  periodAggregates, periodChartData, yearMonthlyData, datesWithData,
  bilanData, kpiEntries, displayedKpiCount, setDisplayedKpiCount,
  exportingPDF, setExportingPDF, wasGenerating,
  weekInfo, periodRange, kpiConfig, user, isReadOnly,
  generatingBilan, currentWeekOffset,
  contentRef, bilanSectionRef,
  setEditingEntry, setActiveTab,
  generatePeriodBilan, onRegenerate, onLoadMoreKpi, onWeekChange,
  chartData, sellerAvailableYears, exportToPDF,
}) {
  return (
    <div>
      {/* Action bar */}
      <div className="px-4 py-3 bg-gray-50 border-b space-y-3">
        {/* Row 1: view selector + action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-1.5">
            {[
              { id: 'jour', label: '📅 Jour' },
              { id: 'semaine', label: '📅 Semaine' },
              { id: 'mois', label: '🗓️ Mois' },
              { id: 'annee', label: '📆 Année' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all border-2 ${
                  viewMode === id
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {viewMode === 'semaine' && onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={generatingBilan}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                <span>{generatingBilan ? 'Génération...' : (bilanData?.synthese ? 'Regénérer' : 'Générer')}</span>
              </button>
            )}
            {(viewMode === 'jour' || viewMode === 'mois' || viewMode === 'annee') && (
              <button
                onClick={generatePeriodBilan}
                disabled={periodGenerating || periodLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <TrendingUp className={`w-4 h-4 ${periodGenerating ? 'animate-spin' : ''}`} />
                <span>{periodGenerating ? 'Génération...' : (periodBilan?.synthese ? 'Regénérer IA' : 'Générer IA')}</span>
              </button>
            )}
            <button
              onClick={exportToPDF}
              disabled={exportingPDF}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${exportingPDF ? 'animate-bounce' : ''}`} />
              <span>{exportingPDF ? 'Export...' : 'PDF'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: temporal navigation */}
        {viewMode === 'jour' && (
          <div className="flex items-center gap-2">
            <KPICalendar
              selectedDate={selectedDay}
              onDateChange={setSelectedDay}
              datesWithData={datesWithData}
            />
          </div>
        )}
        {viewMode === 'semaine' && (
          <WeekPicker
            value={selectedWeek}
            onChange={(newWeek) => {
              setSelectedWeek(newWeek);
              if (onWeekChange) {
                const { startDate: targetMonday } = getWeekStartEnd(newWeek);
                const now = new Date();
                const dow = now.getDay() || 7;
                const currentMonday = new Date(now);
                currentMonday.setDate(now.getDate() - dow + 1);
                currentMonday.setHours(0, 0, 0, 0);
                const diffWeeks = Math.round((targetMonday - currentMonday) / (7 * 24 * 3600 * 1000));
                onWeekChange(diffWeeks);
              }
            }}
            datesWithData={datesWithData}
          />
        )}
        {viewMode === 'mois' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            onClick={(e) => { try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch (_) {} }}
            className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none cursor-pointer bg-white"
          />
        )}
        {viewMode === 'annee' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white cursor-pointer"
          >
            {sellerAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={contentRef} data-pdf-content className="p-6">
        {viewMode === 'jour' && (
          <DayView
            periodLoading={periodLoading}
            periodEntries={periodEntries}
            kpiConfig={kpiConfig}
            periodBilan={periodBilan}
            periodGenerating={periodGenerating}
            periodRange={periodRange}
            generatePeriodBilan={generatePeriodBilan}
            isDemo={!!user?.is_demo}
          />
        )}

        {(viewMode === 'mois' || viewMode === 'annee') && (
          <MonthYearView
            viewMode={viewMode}
            periodLoading={periodLoading}
            periodAggregates={periodAggregates}
            periodEntries={periodEntries}
            yearMonthlyData={yearMonthlyData}
            periodChartData={periodChartData}
            kpiConfig={kpiConfig}
            periodRange={periodRange}
            periodBilan={periodBilan}
            periodGenerating={periodGenerating}
            generatePeriodBilan={generatePeriodBilan}
            isDemo={!!user?.is_demo}
          />
        )}

        {viewMode === 'semaine' && (
          <WeekView
            bilanData={bilanData}
            periodLoading={periodLoading}
            periodEntries={periodEntries}
            kpiConfig={kpiConfig}
            chartData={periodChartData.length > 0 ? periodChartData : chartData}
            generatingBilan={generatingBilan}
            bilanSectionRef={bilanSectionRef}
            onRegenerate={onRegenerate}
            isDemo={!!user?.is_demo}
          />
        )}
      </div>
    </div>
  );
}
