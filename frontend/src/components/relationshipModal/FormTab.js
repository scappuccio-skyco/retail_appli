import React from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';

export default function FormTab({
  activeFormTab,
  activeSellers,
  selectedSeller,
  setSelectedSeller,
  isSellerDropdownOpen,
  setIsSellerDropdownOpen,
  sellerDropdownRef,
  situationType,
  setSituationType,
  situationTypes,
  description,
  setDescription,
  conflictContexte,
  setConflictContexte,
  conflictComportement,
  setConflictComportement,
  conflictImpact,
  setConflictImpact,
  conflictTentatives,
  setConflictTentatives,
  onSubmit,
}) {
  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-purple-500 rounded-xl p-4 border-2 border-purple-600">
        <p className="text-sm text-white font-bold">
          💡 <strong>Recommandations IA personnalisées</strong> : Les conseils sont adaptés aux profils de
          personnalité, performances et historique de debriefs.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Seller selection — custom dropdown */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👤 Membre de l'équipe concerné
          </label>
          <div className="relative" ref={sellerDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
              className={`w-full px-4 py-3 border-2 ${
                isSellerDropdownOpen ? 'border-purple-500' : 'border-gray-300'
              } rounded-lg focus:border-purple-500 focus:outline-none bg-white text-left flex items-center justify-between transition-colors`}
            >
              <span className={selectedSeller ? 'text-gray-900' : 'text-gray-400'}>
                {selectedSeller
                  ? activeSellers.find(s => s.id === selectedSeller)?.name ||
                    `${activeSellers.find(s => s.id === selectedSeller)?.first_name || ''} ${
                      activeSellers.find(s => s.id === selectedSeller)?.last_name || ''
                    }`.trim()
                  : 'Sélectionner un vendeur...'}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${isSellerDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isSellerDropdownOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {activeSellers.length === 0 ? (
                  <div className="px-4 py-3 text-gray-500 text-sm">Aucun vendeur actif disponible</div>
                ) : (
                  activeSellers.map(seller => (
                    <button
                      key={seller.id}
                      type="button"
                      onClick={() => {
                        setSelectedSeller(seller.id);
                        setIsSellerDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        selectedSeller === seller.id
                          ? 'bg-purple-100 text-purple-700 font-semibold'
                          : 'text-gray-900'
                      }`}
                    >
                      {seller.name ||
                        `${seller.first_name || ''} ${seller.last_name || ''}`.trim() ||
                        'Vendeur sans nom'}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-700 mt-1 font-semibold">
            {activeSellers.length > 0
              ? `✓ ${activeSellers.length} vendeur(s) actif(s) disponible(s)`
              : '⚠️ Aucun vendeur actif disponible'}
          </p>
        </div>

        {/* Situation type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">📋 Type de situation</label>
          <select
            value={situationType}
            onChange={e => setSituationType(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
            required
          >
            <option value="" style={{ color: '#6b7280' }}>Choisir le type de situation...</option>
            {situationTypes[activeFormTab].map(type => (
              <option key={type.value} value={type.value} style={{ color: '#1f2937' }}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description — structured for conflict, free text for relationnel */}
        {activeFormTab === 'conflit' ? (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              📝 Description structurée du conflit
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contexte *</label>
              <textarea
                value={conflictContexte}
                onChange={e => setConflictContexte(e.target.value)}
                placeholder="Quelle est la situation générale ? Depuis quand ? Dans quel contexte ?"
                rows={2}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Comportement observé *</label>
              <textarea
                value={conflictComportement}
                onChange={e => setConflictComportement(e.target.value)}
                placeholder="Qu'avez-vous observé concrètement ? Faits précis, sans jugement..."
                rows={2}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Impact sur l'équipe / le magasin
              </label>
              <textarea
                value={conflictImpact}
                onChange={e => setConflictImpact(e.target.value)}
                placeholder="Quelles sont les conséquences observées ? Ambiance, performance, clients..."
                rows={2}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tentatives précédentes</label>
              <textarea
                value={conflictTentatives}
                onChange={e => setConflictTentatives(e.target.value)}
                placeholder="Avez-vous déjà essayé quelque chose ? Qu'est-ce qui n'a pas fonctionné ?"
                rows={2}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              * Champs obligatoires — Plus vous détaillez, plus les conseils seront précis
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">📝 Description détaillée</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez la situation en détail : contexte, ce qui s'est passé, ce que le vendeur a dit, vos préoccupations..."
              rows={6}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Plus vous donnez de détails, plus les recommandations seront précises
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          Obtenir des recommandations
        </button>
      </form>
    </div>
  );
}
