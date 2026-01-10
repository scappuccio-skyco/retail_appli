import React, { useState, useEffect } from 'react';
import { X, Building2, Mail, MapPin, Globe, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

// Liste des pays UE (ISO 3166-1 alpha-2)
const EU_COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'AT', name: 'Autriche' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'CY', name: 'Chypre' },
  { code: 'CZ', name: 'République tchèque' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'DK', name: 'Danemark' },
  { code: 'EE', name: 'Estonie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'FI', name: 'Finlande' },
  { code: 'GR', name: 'Grèce' },
  { code: 'HR', name: 'Croatie' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IT', name: 'Italie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'MT', name: 'Malte' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'SE', name: 'Suède' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SK', name: 'Slovaquie' }
];

const BillingProfileModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [validatingVAT, setValidatingVAT] = useState(false);
  const [error, setError] = useState(null);
  const [hasInvoices, setHasInvoices] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    billing_email: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    country: 'FR',
    country_code: 'FR',
    vat_number: '',
    siren: ''
  });

  // Charger le profil existant au montage
  useEffect(() => {
    if (isOpen) {
      fetchBillingProfile();
    }
  }, [isOpen]);

  const fetchBillingProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gerant/billing-profile');
      
      if (response.data.exists && response.data.profile) {
        const profile = response.data.profile;
        setFormData({
          company_name: profile.company_name || '',
          billing_email: profile.billing_email || '',
          address_line1: profile.address_line1 || '',
          address_line2: profile.address_line2 || '',
          postal_code: profile.postal_code || '',
          city: profile.city || '',
          country: profile.country || 'FR',
          country_code: profile.country_code || 'FR',
          vat_number: profile.vat_number || '',
          siren: profile.siren || ''
        });
        setHasInvoices(profile.has_invoices || false);
      }
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil de facturation:', error);
      // Pas d'erreur critique si le profil n'existe pas encore
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Si le pays change, mettre à jour country_code automatiquement
    if (name === 'country') {
      setFormData(prev => ({
        ...prev,
        country: value,
        country_code: value
      }));
    }
    
    // Nettoyer les erreurs
    if (error) setError(null);
  };

  const validateForm = () => {
    // Vérifier les champs obligatoires
    const requiredFields = {
      company_name: 'Raison sociale',
      billing_email: 'Email de facturation',
      address_line1: 'Adresse',
      postal_code: 'Code postal',
      city: 'Ville',
      country: 'Pays'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field] || formData[field].trim() === '') {
        setError(`Le champ "${label}" est obligatoire`);
        return false;
      }
    }

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.billing_email)) {
      setError('Format d\'email invalide');
      return false;
    }

    // Si pays UE hors FR, VAT number est obligatoire
    if (formData.country !== 'FR' && formData.country !== '') {
      const isEU = EU_COUNTRIES.some(c => c.code === formData.country);
      if (isEU && (!formData.vat_number || formData.vat_number.trim() === '')) {
        setError(`Le numéro de TVA intracommunautaire est obligatoire pour les pays UE hors France (pays sélectionné: ${formData.country})`);
        return false;
      }
    }

    // Valider le format SIREN (9 chiffres)
    if (formData.siren && !/^\d{9}$/.test(formData.siren.replace(/\s/g, ''))) {
      setError('Le SIREN doit contenir exactement 9 chiffres');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Nettoyer les données avant envoi
      const submitData = {
        ...formData,
        postal_code: formData.postal_code.trim().toUpperCase(),
        vat_number: formData.vat_number ? formData.vat_number.replace(/\s/g, '').toUpperCase() : null,
        siren: formData.siren ? formData.siren.replace(/\s/g, '') : null,
        country: formData.country.toUpperCase(),
        country_code: formData.country_code.toUpperCase()
      };

      // Supprimer les champs vides
      if (!submitData.address_line2) delete submitData.address_line2;
      if (!submitData.vat_number) delete submitData.vat_number;
      if (!submitData.siren) delete submitData.siren;

      const response = await api.post('/gerant/billing-profile', submitData);

      toast.success('Profil de facturation enregistré avec succès !');
      logger.log('Profil de facturation sauvegardé:', response.data);
      
      if (onSuccess) {
        onSuccess(response.data.profile);
      }
      
      onClose();
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde du profil:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de l\'enregistrement du profil de facturation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isVATRequired = formData.country !== 'FR' && formData.country !== '' && EU_COUNTRIES.some(c => c.code === formData.country);
  const selectedCountry = EU_COUNTRIES.find(c => c.code === formData.country);

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
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Erreur de validation</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {hasInvoices && (
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

          {/* Section: Identité Entreprise */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Identité Entreprise
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Raison sociale */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Raison sociale * <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Ma Boutique SARL"
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>

              {/* Email de facturation */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email de facturation * <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="billing_email"
                  value={formData.billing_email}
                  onChange={handleChange}
                  required
                  placeholder="facturation@entreprise.fr"
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>

              {/* SIREN (optionnel) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  SIREN <span className="text-gray-500 text-xs">(optionnel)</span>
                </label>
                <input
                  type="text"
                  name="siren"
                  value={formData.siren}
                  onChange={handleChange}
                  placeholder="123456789"
                  maxLength="9"
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">9 chiffres</p>
              </div>
            </div>
          </div>

          {/* Section: Adresse */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              Adresse de Facturation
            </h3>
            
            <div className="space-y-4">
              {/* Adresse ligne 1 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adresse * <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  required
                  placeholder="Ex: 123 Rue de la République"
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>

              {/* Adresse ligne 2 (complément) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Complément d'adresse <span className="text-gray-500 text-xs">(optionnel)</span>
                </label>
                <input
                  type="text"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Ex: Bâtiment A, Étage 2"
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>

              {/* Code postal et Ville */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Code postal * <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    required
                    placeholder="Ex: 75001"
                    disabled={loading}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ville * <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    placeholder="Ex: Paris"
                    disabled={loading}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Pays */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Pays * <span className="text-red-500">*</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                >
                  {EU_COUNTRIES.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Informations Fiscales */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Informations Fiscales
            </h3>
            
            <div className="space-y-4">
              {/* Numéro de TVA */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Numéro de TVA intracommunautaire
                  {isVATRequired && <span className="text-red-500"> *</span>}
                  {!isVATRequired && <span className="text-gray-500 text-xs"> (optionnel pour France)</span>}
                </label>
                <input
                  type="text"
                  name="vat_number"
                  value={formData.vat_number}
                  onChange={handleChange}
                  required={isVATRequired}
                  placeholder={formData.country === 'FR' ? 'FR12345678901' : `${formData.country}123456789`}
                  disabled={loading || validatingVAT}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.country === 'FR' 
                    ? 'Format: FR + 2 chiffres (clé) + 9 chiffres (SIREN)'
                    : `Format: ${formData.country} suivi de 2-12 caractères alphanumériques`
                  }
                </p>
                {isVATRequired && (
                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Obligatoire pour les pays UE hors France. Le numéro sera validé via VIES.
                  </p>
                )}
              </div>

              {selectedCountry && selectedCountry.code !== 'FR' && formData.vat_number && (
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
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || validatingVAT}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Enregistrer le profil
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillingProfileModal;
