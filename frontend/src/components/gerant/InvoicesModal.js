import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Download, ExternalLink, Loader, ChevronDown } from 'lucide-react';
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

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDate(unixTs) {
  if (!unixTs) return '—';
  const d = new Date(unixTs * 1000);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatAmount(amount, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

export default function InvoicesModal({ isOpen, onClose, onOpenBillingPortal }) {
  const [invoices, setInvoices] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInvoices = useCallback(async (startingAfter = null) => {
    const isFirst = !startingAfter;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = { limit: 24 };
      if (startingAfter) params.starting_after = startingAfter;
      const res = await api.get('/gerant/invoices', { params });
      const data = res.data;
      if (isFirst) {
        setInvoices(data.invoices || []);
      } else {
        setInvoices(prev => [...prev, ...(data.invoices || [])]);
      }
      setHasMore(data.has_more || false);
    } catch (err) {
      logger.error('Error fetching invoices:', err);
      toast.error('Impossible de charger les factures.');
    } finally {
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchInvoices();
  }, [isOpen, fetchInvoices]);

  const handleLoadMore = () => {
    if (!invoices.length) return;
    fetchInvoices(invoices[invoices.length - 1].id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mes factures</h2>
              <p className="text-indigo-200 text-sm">Historique de vos paiements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-gray-500 text-sm">Chargement des factures...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="p-4 bg-gray-100 rounded-full">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700">Aucune facture disponible</p>
              <p className="text-gray-500 text-sm">Vos factures apparaîtront ici après votre premier paiement.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => {
                const status = STATUS_LABELS[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-500' };
                const amount = inv.status === 'paid' ? inv.amount_paid : inv.amount_due;

                return (
                  <div key={inv.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">
                          {inv.number || inv.id}
                        </span>
                        {inv.plan && (
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                            {inv.plan}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(inv.created)}</p>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-800">{formatAmount(amount, inv.currency)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {inv.pdf_url && (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Télécharger PDF"
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {inv.hosted_url && (
                        <a
                          href={inv.hosted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Voir la facture"
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 flex items-center justify-center gap-2 text-indigo-600 hover:bg-indigo-50 rounded-xl border border-indigo-200 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loadingMore
                    ? <><Loader className="w-4 h-4 animate-spin" /> Chargement...</>
                    : <><ChevronDown className="w-4 h-4" /> Charger plus</>
                  }
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl bg-gray-50">
          <button
            onClick={onOpenBillingPortal}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            Gérer via Stripe
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
