import React, { useState, useEffect, useCallback } from 'react';
import { X, Building2, Mail, MapPin, Globe, FileText, AlertCircle, CheckCircle, Loader, Receipt, Download, ExternalLink, ChevronDown } from 'lucide-react';
import useBillingProfileModal, { EU_COUNTRIES } from './billingProfileModal/useBillingProfileModal';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

const STATUS_LABELS = {
  paid: { label: 'Payée', color: 'bg-green-100 text-green-700' },
  open: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  void: { label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
  uncollectible: { label: 'Impayée', color: 'bg-red-100 text-red-700' },
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-500' },
};

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const formatDate = (ts) => { if (!ts) return '—'; const d = new Date(ts * 1000); return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`; };
const formatAmount = (amount, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);

function InvoicesTab({ onOpenBillingPortal }) {
  const [invoices, setInvoices] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInvoices = useCallback(async (startingAfter = null) => {
    const isFirst = !startingAfter;
    if (isFirst) setLoading(true); else setLoadingMore(true);
    try {
      const params = { limit: 24 };
      if (startingAfter) params.starting_after = startingAfter;
      const res = await api.get('/gerant/invoices', { params });
      if (isFirst) setInvoices(res.data.invoices || []); else setInvoices(prev => [...prev, ...(res.data.invoices || [])]);
      setHasMore(res.data.has_more || false);
    } catch (err) {
      logger.error('Error fetching invoices:', err);
      toast.error('Impossible de charger les factures.');
    } finally {
      if (isFirst) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader className="w-8 h-8 text-purple-500 animate-spin" />
      <p className="text-gray-500 text-sm">Chargement des factures...</p>
    </div>
  );

  if (invoices.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="p-4 bg-gray-100 rounded-full"><Receipt className="w-8 h-8 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">Aucune facture disponible</p>
      <p className="text-gray-500 text-sm">Vos factures apparaîtront ici après votre premier paiement.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {invoices.map(inv => {
        const status = STATUS_LABELS[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-500' };
        const amount = inv.status === 'paid' ? inv.amount_paid : inv.amount_due;
        return (
          <div key={inv.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0"><Receipt className="w-5 h-5 text-purple-600" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-800 text-sm">{inv.number || inv.id}</span>
                {inv.plan && <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{inv.plan}</span>}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(inv.created)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-gray-800">{formatAmount(amount, inv.currency)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {inv.pdf_url && (
                <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" title="Télécharger PDF" className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                </a>
              )}
              {inv.hosted_url && (
                <a href={inv.hosted_url} target="_blank" rel="noopener noreferrer" title="Voir la facture" className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button onClick={() => fetchInvoices(invoices[invoices.length - 1].id)} disabled={loadingMore} className="w-full py-3 flex items-center justify-center gap-2 text-purple-600 hover:bg-purple-50 rounded-xl border border-purple-200 transition-colors text-sm font-medium disabled:opacity-50">
          {loadingMore ? <><Loader className="w-4 h-4 animate-spin" /> Chargement...</> : <><ChevronDown className="w-4 h-4" /> Charger plus</>}
        </button>
      )}
      {onOpenBillingPortal && (
        <div className="pt-2 border-t border-gray-100">
          <button onClick={onOpenBillingPortal} className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
            <ExternalLink className="w-4 h-4" /> Gérer via Stripe
          </button>
        </div>
      )}
    </div>
  );
}

const BillingProfileModal = ({ isOpen, onClose, onSuccess, initialTab = 'profile', onOpenBillingPortal }) => {
  const s = useBillingProfileModal({ isOpen, onClose, onSuccess });
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Facturation</h2>
              <p className="text-sm text-gray-600 mt-1">Profil B2B et historique des factures</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={s.loading}>
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'profile' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Building2 className="w-4 h-4" /> Profil B2B
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'invoices' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Receipt className="w-4 h-4" /> Mes factures
          </button>
        </div>

        {/* Body — Factures */}
        {activeTab === 'invoices' && (
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <InvoicesTab onOpenBillingPortal={onOpenBillingPortal} />
          </div>
        )}

        {/* Body — Profil B2B */}
        {activeTab === 'profile' && (
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
            <button type="submit" disabled={s.loading || s.validatingVAT} className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg">
              {s.loading ? (
                <><Loader className="w-4 h-4 animate-spin" />Enregistrement...</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Enregistrer le profil</>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default BillingProfileModal;
