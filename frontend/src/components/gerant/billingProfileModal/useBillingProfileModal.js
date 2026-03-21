import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';
import { toast } from 'sonner';

export const EU_COUNTRIES = [
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
  { code: 'SK', name: 'Slovaquie' },
];

const DEFAULT_FORM = {
  company_name: '', billing_email: '',
  address_line1: '', address_line2: '',
  postal_code: '', city: '',
  country: 'FR', country_code: 'FR',
  vat_number: '', siren: '',
};

export default function useBillingProfileModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [validatingVAT, setValidatingVAT] = useState(false);
  const [error, setError] = useState(null);
  const [hasInvoices, setHasInvoices] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (isOpen) fetchBillingProfile();
  }, [isOpen]);

  const fetchBillingProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gerant/billing-profile');
      if (response.data.exists && response.data.profile) {
        const p = response.data.profile;
        setFormData({
          company_name: p.company_name || '',
          billing_email: p.billing_email || '',
          address_line1: p.address_line1 || '',
          address_line2: p.address_line2 || '',
          postal_code: p.postal_code || '',
          city: p.city || '',
          country: p.country || 'FR',
          country_code: p.country_code || 'FR',
          vat_number: p.vat_number || '',
          siren: p.siren || '',
        });
        setHasInvoices(p.has_invoices || false);
      }
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil de facturation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'country' ? { country_code: value } : {}),
    }));
    if (error) setError(null);
  };

  const validateForm = () => {
    const required = {
      company_name: 'Raison sociale',
      billing_email: 'Email de facturation',
      address_line1: 'Adresse',
      postal_code: 'Code postal',
      city: 'Ville',
      country: 'Pays',
    };
    for (const [field, label] of Object.entries(required)) {
      if (!formData[field]?.trim()) {
        setError(`Le champ "${label}" est obligatoire`);
        return false;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billing_email)) {
      setError("Format d'email invalide");
      return false;
    }
    if (formData.country !== 'FR' && formData.country !== '') {
      const isEU = EU_COUNTRIES.some(c => c.code === formData.country);
      if (isEU && !formData.vat_number?.trim()) {
        setError(`Le numéro de TVA intracommunautaire est obligatoire pour les pays UE hors France (pays sélectionné: ${formData.country})`);
        return false;
      }
    }
    if (formData.siren && !/^\d{9}$/.test(formData.siren.replace(/\s/g, ''))) {
      setError('Le SIREN doit contenir exactement 9 chiffres');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;

    try {
      setLoading(true);
      const submitData = {
        ...formData,
        postal_code: formData.postal_code.trim().toUpperCase(),
        vat_number: formData.vat_number ? formData.vat_number.replace(/\s/g, '').toUpperCase() : null,
        siren: formData.siren ? formData.siren.replace(/\s/g, '') : null,
        country: formData.country.toUpperCase(),
        country_code: formData.country_code.toUpperCase(),
      };
      if (!submitData.address_line2) delete submitData.address_line2;
      if (!submitData.vat_number) delete submitData.vat_number;
      if (!submitData.siren) delete submitData.siren;

      const response = await api.post('/gerant/billing-profile', submitData);
      toast.success('Profil de facturation enregistré avec succès !');
      logger.log('Profil de facturation sauvegardé:', response.data);
      if (onSuccess) onSuccess(response.data.profile);
      onClose();
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde du profil:', error);
      const msg = error.response?.data?.detail || "Erreur lors de l'enregistrement du profil de facturation";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isVATRequired = formData.country !== 'FR' && formData.country !== '' && EU_COUNTRIES.some(c => c.code === formData.country);
  const selectedCountry = EU_COUNTRIES.find(c => c.code === formData.country);

  return {
    loading, validatingVAT, error, hasInvoices, formData,
    isVATRequired, selectedCountry,
    handleChange, handleSubmit,
  };
}
