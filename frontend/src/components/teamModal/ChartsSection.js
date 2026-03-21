import React, { startTransition } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// Utility function to format numbers with spaces for thousands
const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Custom compact tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg p-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${entry.name}-${entry.value}-${index}`} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ChartsSection({
  chartData,
  visibleMetrics,
  setVisibleMetrics,
  visibleSellers,
  setVisibleSellers,
  sellers,
  teamData,
  isUpdatingCharts,
  periodFilter,
  setPeriodFilter,
  customDateRange,
  setCustomDateRange,
  showCustomDatePicker,
  setShowCustomDatePicker,
  hiddenSellerIds,
  setIsUpdatingCharts,
  prepareChartData,
}) {
  return (
    /* Charts Section */
    <div className="mt-8 space-y-6">
      {isUpdatingCharts && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          <p className="text-gray-600 mt-2 text-sm">Mise à jour des graphiques...</p>
        </div>
      )}
      {!isUpdatingCharts && (
      <div>
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-800">📊 Comparaison des Performances</h3>

          {/* Metric Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, ca: !prev.ca })))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                visibleMetrics.ca
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {visibleMetrics.ca ? '✓' : ''} CA
            </button>
            <button
              onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, ventes: !prev.ventes })))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                visibleMetrics.ventes
                  ? 'bg-[#10B981] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {visibleMetrics.ventes ? '✓' : ''} Ventes
            </button>
            <button
              onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, panierMoyen: !prev.panierMoyen })))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                visibleMetrics.panierMoyen
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {visibleMetrics.panierMoyen ? '✓' : ''} Panier Moy.
            </button>
          </div>
        </div>

        {/* Seller Filters */}
        <div className="flex items-start gap-2">
          <span className="text-xs sm:text-sm text-gray-600 font-medium mt-1.5">Vendeurs :</span>
          <div className="flex flex-wrap gap-2">
            {teamData
              .filter(seller =>
                !hiddenSellerIds.includes(seller.id) &&
                (!seller.status || seller.status === 'active')
              )
              .map((seller, idx) => {
              // Define colors for first 5 sellers
              const colors = [
                { bg: 'bg-blue-500', text: 'text-white' },
                { bg: 'bg-[#10B981]', text: 'text-white' },
                { bg: 'bg-[#F97316]', text: 'text-white' },
                { bg: 'bg-purple-500', text: 'text-white' },
                { bg: 'bg-pink-500', text: 'text-white' }
              ];
              const colorSet = colors[idx % 5] || { bg: 'bg-gray-500', text: 'text-white' };

              // Ne compter que les vendeurs actifs et sélectionnés
              const selectedCount = Object.entries(visibleSellers)
                .filter(([sellerId, isVisible]) => {
                  const s = teamData.find(sel => sel.id === sellerId);
                  return isVisible && s && !hiddenSellerIds.includes(sellerId) && (!s.status || s.status === 'active');
                }).length;
              const canSelect = visibleSellers[seller.id] || selectedCount < 5;

              return (
                <button
                  key={seller.id}
                  onClick={() => {
                    if (canSelect) {
                      // Démontage temporaire des graphiques pour éviter les erreurs React
                      setIsUpdatingCharts(true);
                      setTimeout(() => {
                        setVisibleSellers(prev => ({ ...prev, [seller.id]: !prev[seller.id] }));
                        setTimeout(() => setIsUpdatingCharts(false), 50);
                      }, 50);
                    }
                  }}
                  disabled={!canSelect || isUpdatingCharts}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    visibleSellers[seller.id]
                      ? `${colorSet.bg} ${colorSet.text}`
                      : canSelect
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title={!canSelect ? 'Maximum 5 vendeurs sélectionnés' : seller.name}
                >
                  {visibleSellers[seller.id] ? '✓ ' : ''}{seller.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1 ml-20">
          {Object.entries(visibleSellers)
            .filter(([sellerId, isVisible]) => {
              // Ne compter que les vendeurs actifs et visibles
              const seller = teamData.find(s => s.id === sellerId);
              return isVisible && seller && !hiddenSellerIds.includes(sellerId) && (!seller.status || seller.status === 'active');
            }).length} / 5 vendeurs sélectionnés
        </div>
      </div>

      {/* Period Filter - Duplicate for convenience */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-200">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">
              📅 <span className="hidden md:inline">Période :</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '7', label: '7 jours' },
                { value: '30', label: '30 jours' },
                { value: '90', label: '3 mois' },
                { value: 'all', label: 'Année' }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => {
                    setPeriodFilter(period.value);
                    setShowCustomDatePicker(false);
                  }}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    periodFilter === period.value
                      ? 'bg-[#1E40AF] text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-cyan-100'
                  }`}
                >
                  {period.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowCustomDatePicker(!showCustomDatePicker);
                  if (!showCustomDatePicker) {
                    // Only set to custom when opening the picker
                    setPeriodFilter('custom');
                  }
                }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  periodFilter === 'custom'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-cyan-100'
                }`}
              >
                📆 Personnalisée
              </button>
            </div>
          </div>

          {/* Custom Date Picker - Second Location */}
          {showCustomDatePicker && (
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setCustomDateRange(prev => ({ ...prev, start: newStart }));

                      // Set to custom mode if both dates will be set
                      if (newStart && customDateRange.end) {
                        setPeriodFilter('custom');
                      }
                    }}
                    onFocus={(e) => {
                      // Ouvrir le calendrier au focus
                      try {
                        if (typeof e.target.showPicker === 'function') {
                          e.target.showPicker();
                        }
                      } catch (error) {
                        // showPicker n'est pas supporté par ce navigateur
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setCustomDateRange(prev => ({ ...prev, end: newEnd }));

                      // Set to custom mode if both dates are now set
                      if (customDateRange.start && newEnd) {
                        setPeriodFilter('custom');
                      }
                    }}
                    onFocus={(e) => {
                      // Ouvrir le calendrier au focus
                      try {
                        if (typeof e.target.showPicker === 'function') {
                          e.target.showPicker();
                        }
                      } catch (error) {
                        // showPicker n'est pas supporté par ce navigateur
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
              {periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
                <p className="text-xs text-purple-700 mt-2">
                  ✅ Période active : du {new Date(customDateRange.start).toLocaleDateString('fr-FR')} au {new Date(customDateRange.end).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CA Chart */}
        {visibleMetrics.ca && (
          <div key={`chart-ca-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-blue-200">
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">💰 Chiffre d'Affaires (€)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                  angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                  textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                  height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (periodFilter === 'all') {
                      return date.toLocaleDateString('fr-FR', { month: 'short' });
                    } else if (periodFilter === '90') {
                      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    }
                    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                {teamData
                  .filter(seller =>
                    visibleSellers[seller.id] &&
                    !hiddenSellerIds.includes(seller.id) &&
                    (!seller.status || seller.status === 'active')
                  )
                  .map((seller, idx) => (
                  <Line
                    key={seller.id}
                    type="monotone"
                    dataKey={`ca_${seller.id}`}
                    name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                    stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ventes Chart */}
        {visibleMetrics.ventes && (
          <div key={`chart-ventes-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-green-200">
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">🛍️ Nombre de Ventes</h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                  angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                  textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                  height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (periodFilter === 'all') {
                      return date.toLocaleDateString('fr-FR', { month: 'short' });
                    } else if (periodFilter === '90') {
                      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    }
                    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                {teamData
                  .filter(seller =>
                    visibleSellers[seller.id] &&
                    !hiddenSellerIds.includes(seller.id) &&
                    (!seller.status || seller.status === 'active')
                  )
                  .map((seller, idx) => (
                  <Line
                    key={seller.id}
                    type="monotone"
                    dataKey={`ventes_${seller.id}`}
                    name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                    stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Panier Moyen Chart */}
        {visibleMetrics.panierMoyen && (
          <div key={`chart-panier-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-purple-200">
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">💳 Panier Moyen (€)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                  angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                  textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                  height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (periodFilter === 'all') {
                      return date.toLocaleDateString('fr-FR', { month: 'short' });
                    } else if (periodFilter === '90') {
                      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    }
                    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                {teamData
                  .filter(seller =>
                    visibleSellers[seller.id] &&
                    !hiddenSellerIds.includes(seller.id) &&
                    (!seller.status || seller.status === 'active')
                  )
                  .map((seller, idx) => (
                  <Line
                    key={seller.id}
                    type="monotone"
                    dataKey={`panier_${seller.id}`}
                    name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                    stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
