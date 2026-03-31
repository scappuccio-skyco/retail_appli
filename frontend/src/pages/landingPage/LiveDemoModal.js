import React, { useState } from 'react';
import { X, TrendingUp, Users, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { toast } from 'sonner';

const ROLES = [
  {
    key: 'gerant',
    label: 'Vue Gérant',
    icon: TrendingUp,
    description: 'Pilotez plusieurs boutiques, analysez les KPIs globaux et suivez la performance de vos équipes.',
    color: 'from-[#1E40AF] to-[#1E3A8A]',
    badge: 'Direction',
  },
  {
    key: 'manager',
    label: 'Vue Manager',
    icon: Users,
    description: 'Coachez votre équipe avec l\'IA, générez des briefs matinaux et des bilans personnalisés.',
    color: 'from-[#7C3AED] to-[#6D28D9]',
    badge: 'Terrain',
  },
  {
    key: 'seller',
    label: 'Vue Vendeur',
    icon: ShoppingBag,
    description: 'Saisissez vos KPIs, accédez à votre profil DISC et recevez des conseils de progression.',
    color: 'from-[#059669] to-[#047857]',
    badge: 'Vente',
  },
];

export default function LiveDemoModal({ show, onClose }) {
  const [loading, setLoading] = useState(null);

  if (!show) return null;

  const handleRoleClick = async (role) => {
    setLoading(role);
    try {
      const res = await api.post(`/demo/login?role=${role}`);
      const user = res.data?.user;
      if (!user) throw new Error('Réponse inattendue');
      // Redirection vers le dashboard selon le rôle
      const role_ = user.role;
      if (role_ === 'gerant' || role_ === 'gérant') {
        globalThis.location.href = '/gerant-dashboard';
      } else if (role_ === 'manager') {
        globalThis.location.href = '/dashboard';
      } else {
        globalThis.location.href = '/dashboard';
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Erreur lors de la connexion à la démo';
      toast.error(detail);
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white mb-1">Explorer la démo en direct</h2>
          <p className="text-white/70 text-sm">Choisissez un rôle pour découvrir l'application — lecture seule, aucune inscription requise.</p>
        </div>

        {/* Role cards */}
        <div className="p-6 space-y-3">
          {ROLES.map(({ key, label, icon: Icon, description, color, badge }) => (
            <button
              key={key}
              onClick={() => handleRoleClick(key)}
              disabled={loading !== null}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                {loading === key
                  ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                  : <Icon className="w-6 h-6 text-white" />
                }
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-800">{label}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{badge}</span>
                </div>
                <p className="text-sm text-gray-500 leading-snug">{description}</p>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-gray-400">
            Mode lecture seule · Données fictives · Aucun compte requis
          </p>
        </div>
      </div>
    </div>
  );
}
