import React from 'react';
import { X, Building2, Mail, MapPin, Globe, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import useBillingProfileModal, { EU_COUNTRIES } from './billingProfileModal/useBillingProfileModal';

const BillingProfileModal = ({ isOpen, onClose, onSuccess }) => {
  const s = useBillingProfileModal({ isOpen, onClose, onSuccess });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Informations de Facturation B2B</h2>
              <p className="text-sm text-gray-600 mt-1">Informations obligatoires pour la facturation conforme (France / UE)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={s.loading}>
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={s.handleSubmit} className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          {s.error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Erreur de validation</p>
                <p className="text-sm text-red-700 mt-1">{s.error}</p>
              </div>
            </div>
          )}

          {s.hasInvoices && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800">Modification après facturation</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Des factures ont déjà été générées. Certains champs peuvent être verrouillés. Contactez le support si nécessaire.
                </p>
              </div>
            </div>
          )}

          {/* Identité Entreprise */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Identité Entreprise
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Raison sociale *</label>
                <input type="text" name="company_name" value={s.formData.company_name} onChange={s.handleChange} required placeholder="Ex: Ma Boutique SARL" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />Email de facturation *
                </label>
                <input type="email" name="billing_email" value={s.formData.billing_email} onChange={s.handleChange} required placeholder="facturation@entreprise.fr" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SIREN <span className="text-gray-500 text-xs">(optionnel)</span></label>
                <input type="text" name="siren" value={s.formData.siren} onChange={s.handleChange} placeholder="123456789" maxLength="9" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
                <p className="text-xs text-gray-500 mt-1">9 chiffres</p>
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              Adresse de Facturation
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse *</label>
                <input type="text" name="address_line1" value={s.formData.address_line1} onChange={s.handleChange} required placeholder="Ex: 123 Rue de la République" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Complément d'adresse <span className="text-gray-500 text-xs">(optionnel)</span></label>
                <input type="text" name="address_line2" value={s.formData.address_line2} onChange={s.handleChange} placeholder="Ex: Bâtiment A, Étage 2" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Code postal *</label>
                  <input type="text" name="postal_code" value={s.formData.postal_code} onChange={s.handleChange} required placeholder="Ex: 75001" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ville *</label>
                  <input type="text" name="city" value={s.formData.city} onChange={s.handleChange} required placeholder="Ex: Paris" disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />Pays *
                </label>
                <select name="country" value={s.formData.country} onChange={s.handleChange} required disabled={s.loading} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100">
                  {EU_COUNTRIES.map(country => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Informations Fiscales */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Informations Fiscales
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Numéro de TVA intracommunautaire
                  {s.isVATRequired ? <span className="text-red-500"> *</span> : <span className="text-gray-500 text-xs"> (optionnel pour France)</span>}
                </label>
                <input type="text" name="vat_number" value={s.formData.vat_number} onChange={s.handleChange} required={s.isVATRequired} placeholder={s.formData.country === 'FR' ? 'FR12345678901' : `${s.formData.country}123456789`} disabled={s.loading || s.validatingVAT} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100" />
                <p className="text-xs text-gray-500 mt-1">
                  {s.formData.country === 'FR'
                    ? 'Format: FR + 2 chiffres (clé) + 9 chiffres (SIREN)'
                    : `Format: ${s.formData.country} suivi de 2-12 caractères alphanumériques`}
                </p>
                {s.isVATRequired && (
                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Obligatoire pour les pays UE hors France. Le numéro sera validé via VIES.
                  </p>
                )}
              </div>
              {s.selectedCountry && s.selectedCountry.code !== 'FR' && s.formData.vat_number && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Auto-liquidation TVA:</strong> Pour les clients UE hors France avec numéro de TVA valide,
                    la TVA sera à 0% (auto-liquidation selon l'article 196 directive 2006/112/CE).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
            <button type="button" onClick={onClose} disabled={s.loading} className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button type="submit" disabled={s.loading || s.validatingVAT} className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg">
              {s.loading ? (
                <><Loader className="w-4 h-4 animate-spin" />Enregistrement...</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Enregistrer le profil</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillingProfileModal;
