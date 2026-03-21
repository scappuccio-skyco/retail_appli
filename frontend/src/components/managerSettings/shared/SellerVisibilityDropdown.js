import React from 'react';

/**
 * Reusable seller visibility dropdown with multi-select checkboxes.
 * Used in both CreateChallengeTab and CreateObjectiveTab.
 */
export default function SellerVisibilityDropdown({
  visible,
  onVisibleChange,
  sellers,
  selectedSellers,
  setSelectedSellers,
  dropdownRef,
  isDropdownOpen,
  setIsDropdownOpen,
}) {
  const safeSellers = Array.isArray(sellers) ? sellers : [];
  const safeSelected = Array.isArray(selectedSellers) ? selectedSellers : [];

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      {/* Checkbox Visible */}
      <label className="flex items-center gap-3 p-3 sm:p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all flex-shrink-0 w-full sm:w-auto">
        <input
          type="checkbox"
          checked={visible !== false}
          onChange={(e) => {
            const isChecked = e.target.checked;
            onVisibleChange(isChecked);
            if (!isChecked) {
              setSelectedSellers([]);
              setIsDropdownOpen(false);
            }
          }}
          className="w-5 h-5 text-blue-600 flex-shrink-0"
        />
        <div>
          <p className="font-semibold text-gray-800 text-sm sm:text-base">👁️ Visible par les vendeurs</p>
          <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir cet élément</p>
        </div>
      </label>

      {/* Multi-select dropdown — only for collective type */}
      {visible !== false && (
        <div className="flex-1 w-full p-3 sm:p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <p className="text-xs sm:text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
            <button
              type="button"
              onClick={() => {
                if (safeSelected.length === safeSellers.length) {
                  setSelectedSellers([]);
                } else {
                  setSelectedSellers(safeSellers.map(s => s.id));
                }
              }}
              className="text-xs px-2 sm:px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all whitespace-nowrap"
            >
              {safeSelected.length === safeSellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Si aucun vendeur n'est sélectionné, tous les vendeurs verront cet élément
          </p>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
            >
              <span className="text-gray-700">
                {safeSelected.length === 0
                  ? 'Sélectionner les vendeurs...'
                  : `${safeSelected.length} vendeur${safeSelected.length > 1 ? 's' : ''} sélectionné${safeSelected.length > 1 ? 's' : ''}`
                }
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {safeSellers.map((seller) => (
                  <label
                    key={seller.id}
                    className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={safeSelected.includes(seller.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSellers([...safeSelected, seller.id]);
                        } else {
                          setSelectedSellers(safeSelected.filter(id => id !== seller.id));
                        }
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 font-medium">{seller.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {safeSelected.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {safeSelected.map(sellerId => {
                const seller = safeSellers.find(s => s.id === sellerId);
                return seller ? (
                  <span
                    key={sellerId}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                  >
                    {seller.name}
                    <button
                      type="button"
                      onClick={() => setSelectedSellers(safeSelected.filter(id => id !== sellerId))}
                      className="ml-1 hover:text-green-900 font-bold text-lg leading-none"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
