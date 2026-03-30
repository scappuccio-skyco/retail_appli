import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import CompatibiliteSection from './guideProfilsModal/CompatibiliteSection';

export default function CompatibiliteModal({ storeIdParam, sellers = [], onClose }) {
  const [managerProfile, setManagerProfile] = useState(null);
  const [managerFullDiagnostic, setManagerFullDiagnostic] = useState(null);
  const [enrichedSellers, setEnrichedSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiCompatibilityAdvice, setAiCompatibilityAdvice] = useState({});
  const [loadingAdviceIds, setLoadingAdviceIds] = useState(new Set());

  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sellerIds = sellers.map(s => s.id).filter(Boolean);

      const requests = [
        api.get('/auth/me'),
        api.get(`/manager-diagnostic/me${storeParam}`),
      ];
      if (sellerIds.length > 0) {
        requests.push(
          api.post(`/manager/team/seller-profiles${storeParam}`, { seller_ids: sellerIds })
        );
      }

      const [managerRes, diagRes, profilesRes] = await Promise.all(requests);

      const fullDiagnostic = diagRes.data?.diagnostic || null;
      setManagerFullDiagnostic(fullDiagnostic);
      setManagerProfile({
        ...managerRes.data,
        management_style:
          fullDiagnostic?.profil_nom ||
          managerRes.data.management_style ||
          'Pilote',
      });

      // Enrichir chaque vendeur avec son style de vente depuis le batch profiles
      const profilesMap = profilesRes?.data || {};
      setEnrichedSellers(sellers.map(s => ({
        ...s,
        style_vente: s.style_vente || profilesMap[s.id]?.style || null,
      })));
    } catch (err) {
      logger.error('CompatibiliteModal fetch error:', err);
      setEnrichedSellers(sellers);
    } finally {
      setLoading(false);
    }
  }, [storeParam, sellers]);

  const generateCompatibilityAdvice = async (seller) => {
    if (!managerFullDiagnostic || !seller?.style_vente) return;
    const sellerId = seller.id;
    setLoadingAdviceIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await api.post(`/manager/compatibility-advice${storeParam}`, {
        manager_diagnostic: managerFullDiagnostic,
        seller_name: seller.name,
        seller_style: seller.style_vente,
        seller_id: seller.id,
      });
      setAiCompatibilityAdvice(prev => ({ ...prev, [sellerId]: res.data }));
    } catch (err) {
      logger.error('Error generating compatibility advice:', err);
    } finally {
      setLoadingAdviceIds(prev => { const s = new Set(prev); s.delete(sellerId); return s; });
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">👥 Compatibilité avec mon équipe</h2>
            <p className="text-white opacity-80 text-sm mt-0.5">
              Adapte ton management à chaque profil vendeur
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Rafraîchir"
              className="text-white opacity-70 hover:opacity-100 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all disabled:opacity-30"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-white opacity-70 hover:opacity-100 p-1.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <CompatibiliteSection
            managerProfile={managerProfile}
            managerFullDiagnostic={managerFullDiagnostic}
            teamSellers={enrichedSellers}
            loadingCompatibility={loading}
            aiCompatibilityAdvice={aiCompatibilityAdvice}
            loadingAdviceIds={loadingAdviceIds}
            onGenerateAdvice={generateCompatibilityAdvice}
          />
        </div>
      </div>
    </div>
  );
}
