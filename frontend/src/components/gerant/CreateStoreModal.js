import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';

const CreateStoreModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    opening_hours: '9h-19h du Lundi au Samedi'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onCreate(formData);
      onClose();
    } catch (err) {
      console.error('Creation error:', err);
      let errorMessage = 'Erreur lors de la création du magasin';
      
      if (err.response?.data?.detail) {
        // Si detail est un tableau (erreurs de validation Pydantic)
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail
            .map(e => `${e.loc?.join(' > ') || 'Champ'}: ${e.msg}`)
            .join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Créer un Nouveau Magasin</h2>
              <p className="text-white opacity-90 text-sm">Ajoutez un nouveau point de vente à votre réseau</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Nom du magasin */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom du Magasin *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Ex: Skyco Marseille Vieux-Port"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Localisation */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ville & Code Postal *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                placeholder="Ex: 13001 Marseille"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Adresse complète */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Adresse Complète (Rue et Numéro)
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ex: 12 Quai du Port, 13001 Marseille"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ex: +33 4 91 90 00 00"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Horaires */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Horaires d'Ouverture
              </label>
              <input
                type="text"
                name="opening_hours"
                value={formData.opening_hours}
                onChange={handleChange}
                placeholder="Ex: 9h-19h du Lundi au Samedi"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le Magasin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStoreModal;
