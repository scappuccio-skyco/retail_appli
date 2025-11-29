import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

const DeleteStoreConfirmation = ({ store, onClose, onDelete }) => {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expectedText = store.name;

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      await onDelete(store.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">⚠️ Supprimer le Magasin</h2>
              <p className="text-white opacity-90 text-sm">Action irréversible - Procédure en 3 étapes</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Store Info */}
          <div className="bg-red-50 rounded-lg p-4 mb-6 border-2 border-red-200">
            <p className="text-sm text-red-600 mb-1 font-semibold">Magasin à supprimer</p>
            <p className="font-bold text-red-800 text-lg">{store.name}</p>
            <p className="text-sm text-red-700">{store.location}</p>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <p className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Étape 1/3 : Comprendre les conséquences
                </p>
                <ul className="text-sm text-yellow-800 space-y-2 ml-6 list-disc">
                  <li>Le magasin sera <strong>définitivement supprimé</strong></li>
                  <li>Tous les managers seront <strong>automatiquement suspendus</strong></li>
                  <li>Tous les vendeurs seront <strong>automatiquement suspendus</strong></li>
                  <li>Les KPIs historiques seront <strong>conservés</strong></li>
                  <li>L'équipe pourra être <strong>réactivée</strong> plus tard</li>
                </ul>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold"
              >
                Je comprends, continuer →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
                <p className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Étape 2/3 : Action automatique sur l'équipe
                </p>
                <div className="text-sm text-orange-800 space-y-2">
                  <p>🔄 <strong>Suspension automatique de l'équipe :</strong></p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Tous les managers du magasin passeront en statut "Suspendu"</li>
                    <li>Tous les vendeurs du magasin passeront en statut "Suspendu"</li>
                    <li>Ils n'auront plus accès à l'application</li>
                    <li>Vous pourrez les réactiver plus tard via l'onglet "Personnel"</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                >
                  ← Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold"
                >
                  Continuer →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                <p className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Étape 3/3 : Confirmation finale
                </p>
                <p className="text-sm text-red-700 mb-3">
                  Pour confirmer la suppression, tapez exactement le nom du magasin :
                </p>
                <div className="bg-white p-2 rounded border border-red-300 mb-3">
                  <p className="font-mono font-bold text-red-800">{expectedText}</p>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Tapez le nom du magasin..."
                  className="w-full p-3 border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                >
                  ← Retour
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading || confirmText !== expectedText}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>Suppression...</>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Supprimer Définitivement
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Warning */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 text-center">
          <p className="text-xs text-gray-600">
            ⚠️ Cette action est irréversible. Les données ne pourront pas être récupérées.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeleteStoreConfirmation;
