import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import CompatibiliteSection from './guideProfilsModal/CompatibiliteSection';

export default function CompatibiliteModal({ storeIdParam, onClose }) {
  const [managerProfile, setManagerProfile] = useState(null);
  const [teamSellers, setTeamSellers] = useState([]);
  const [loading, setLoading] = useState(false);

  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [managerRes, diagRes, sellersRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/manager-diagnostic/me'),
        api.get(`/manager/sellers${storeParam}`),
      ]);
      setManagerProfile({
        ...managerRes.data,
        management_style:
          diagRes.data?.diagnostic?.profil_nom ||
          managerRes.data.management_style ||
          'Pilote',
      });
      const raw = sellersRes.data;
      setTeamSellers(Array.isArray(raw) ? raw : raw?.sellers || raw || []);
    } catch (err) {
      logger.error('CompatibiliteModal fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [storeParam]);

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
            teamSellers={teamSellers}
            loadingCompatibility={loading}
          />
        </div>
      </div>
    </div>
  );
}
