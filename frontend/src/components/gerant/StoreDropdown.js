import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const StoreDropdown = ({ stores, selectedStoreIds, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState(selectedStoreIds);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    setTempSelection(selectedStoreIds);
  }, [selectedStoreIds, isOpen]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, tempSelection]);

  const openDropdown = () => {
    setTempSelection(selectedStoreIds);
    setIsOpen(true);
  };

  const closeDropdown = () => {
    onSelectionChange(tempSelection);
    setIsOpen(false);
  };

  const handleToggle = (storeId) => {
    if (Array.isArray(tempSelection)) {
      if (tempSelection.includes(storeId)) {
        const newSelection = tempSelection.filter(id => id !== storeId);
        setTempSelection(newSelection.length > 0 ? newSelection : null);
      } else {
        setTempSelection([...tempSelection, storeId]);
      }
    } else {
      setTempSelection([storeId]);
    }
  };

  const selectAll = () => {
    setTempSelection(null);
    setIsOpen(false);
    onSelectionChange(null);
  };

  const getDisplayText = () => {
    if (selectedStoreIds === null) {
      return {
        title: `🌐 Tous les magasins`,
        subtitle: `Accès à l'ensemble de vos ${stores.length} magasin${stores.length > 1 ? 's' : ''}`
      };
    }
    if (Array.isArray(selectedStoreIds) && selectedStoreIds.length > 0) {
      const names = selectedStoreIds
        .map(id => stores.find(s => s.id === id)?.name || id)
        .join(', ');
      return {
        title: `${selectedStoreIds.length} magasin${selectedStoreIds.length > 1 ? 's' : ''} sélectionné${selectedStoreIds.length > 1 ? 's' : ''}`,
        subtitle: names
      };
    }
    return {
      title: 'Sélectionnez des magasins',
      subtitle: ''
    };
  };

  const display = getDisplayText();
  const currentSelection = isOpen ? tempSelection : selectedStoreIds;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className="w-full px-4 py-3 text-left bg-white border border-gray-300 rounded-lg hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <span className={`text-base font-semibold block truncate ${selectedStoreIds === null ? 'text-blue-700' : 'text-purple-700'}`}>
              {display.title}
            </span>
            {display.subtitle && (
              <span className="text-xs text-gray-500 block truncate mt-0.5">
                {display.subtitle}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <div ref={dropdownRef} style={dropdownStyle} className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {/* Option: Tous les magasins */}
            <div
              onClick={selectAll}
              className={`px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-200 ${
                currentSelection === null ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    currentSelection === null ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}
                >
                  {currentSelection === null && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-blue-700 block">🌐 Tous les magasins</span>
                  <span className="text-xs text-gray-500">Accès complet à tous vos magasins</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase">Ou sélectionnez des magasins spécifiques :</p>
            </div>

            {/* Store List */}
            {stores.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 italic">Chargement des magasins...</div>
            ) : (
              stores.map((store) => {
                const isChecked = Array.isArray(currentSelection) && currentSelection.includes(store.id);
                return (
                  <div
                    key={store.id}
                    onClick={() => handleToggle(store.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer pointer-events-none"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 block">{store.name}</span>
                      {store.location && <span className="text-xs text-gray-500">{store.location}</span>}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer */}
            {Array.isArray(currentSelection) && currentSelection.length > 0 && (
              <div className="px-4 py-2 bg-purple-50 border-t border-purple-200">
                <p className="text-xs text-purple-700 font-medium">
                  ✓ {currentSelection.length} magasin{currentSelection.length > 1 ? 's' : ''} sélectionné
                  {currentSelection.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default StoreDropdown;
