import React from 'react';
import { X, AlertTriangle, PauseCircle, Trash2, PlayCircle, XCircle, CheckCircle } from 'lucide-react';

export default function ConfirmActionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  action, // 'deactivate', 'delete', 'reactivate', 'cancel_subscription', 'reactivate_subscription'
  sellerName,
  subscriptionEndDate // for subscription actions
}) {
  if (!isOpen) return null;

  const configs = {
    deactivate: {
      icon: <PauseCircle className="w-12 h-12 text-orange-500" />,
      title: 'Mettre en sommeil',
      color: 'orange',
      message: `Voulez-vous mettre ${sellerName} en sommeil ?`,
      details: [
        '✓ Libère 1 siège',
        '✓ Réversible',
        '✓ Historique conservé',
        '✓ Le vendeur ne pourra plus se connecter',
        '💡 Vous pourrez le réactiver dans "Vendeurs archivés"'
      ],
      confirmText: 'Mettre en sommeil',
      cancelText: 'Annuler'
    },
    delete: {
      icon: <Trash2 className="w-12 h-12 text-red-500" />,
      title: 'Supprimer définitivement',
      color: 'red',
      message: `Voulez-vous supprimer ${sellerName} ?`,
      details: [
        '✓ Libère 1 siège',
        '⚠️ Action irréversible',
        '✓ Historique consultable dans "Vendeurs archivés"',
        '✓ Le vendeur ne pourra plus se connecter'
      ],
      confirmText: 'Supprimer',
      cancelText: 'Annuler'
    },
    reactivate: {
      icon: <PlayCircle className="w-12 h-12 text-green-500" />,
      title: 'Réactiver',
      color: 'green',
      message: `Voulez-vous réactiver ${sellerName} ?`,
      details: [
        '✓ Consomme 1 siège',
        '✓ Le vendeur pourra se reconnecter',
        '✓ Historique intact'
      ],
      confirmText: 'Réactiver',
      cancelText: 'Annuler'
    },
    cancel_subscription: {
      icon: <XCircle className="w-12 h-12 text-red-500" />,
      title: 'Annuler l\'abonnement',
      color: 'red',
      message: 'Voulez-vous vraiment annuler votre abonnement ?',
      details: [
        `✓ Votre abonnement reste actif jusqu'au ${subscriptionEndDate || 'fin de période'}`,
        '✓ Aucun remboursement pour la période en cours',
        '✓ Accès à toutes les fonctionnalités jusqu\'à la fin',
        '⚠️ Après cette date, votre équipe ne pourra plus accéder à l\'application',
        '💡 Vous pourrez réactiver l\'abonnement à tout moment avant la fin'
      ],
      confirmText: 'Annuler l\'abonnement',
      cancelText: 'Garder mon abonnement'
    },
    reactivate_subscription: {
      icon: <CheckCircle className="w-12 h-12 text-green-500" />,
      title: 'Réactiver l\'abonnement',
      color: 'green',
      message: 'Voulez-vous réactiver votre abonnement ?',
      details: [
        '✓ Votre abonnement reprendra automatiquement',
        '✓ Accès continu à toutes les fonctionnalités',
        '✓ Facturation au prochain cycle de renouvellement',
        '✓ Aucun frais supplémentaire'
      ],
      confirmText: 'Réactiver',
      cancelText: 'Annuler'
    }
  };

  const config = configs[action] || configs.deactivate;

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {config.icon}
            <h2 className="text-xl font-bold text-gray-800">{config.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 font-medium mb-4">{config.message}</p>
          
          <div className={
            action === 'deactivate' 
              ? 'bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2'
              : action === 'delete'
              ? 'bg-red-50 border border-red-200 rounded-lg p-4 space-y-2'
              : 'bg-green-50 border border-green-200 rounded-lg p-4 space-y-2'
          }>
            {config.details.map((detail, idx) => (
              <div key={idx} className="text-sm text-gray-700">
                {detail}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            {config.cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={
              action === 'deactivate'
                ? 'flex-1 px-4 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors'
                : action === 'delete'
                ? 'flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors'
                : 'flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors'
            }
          >
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
