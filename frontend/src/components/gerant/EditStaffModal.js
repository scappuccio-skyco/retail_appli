import React, { useState } from 'react';
import { X, User, Mail, Phone, Save, Loader } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';

export default function EditStaffModal({ isOpen, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when user changes
  React.useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      setErrors({});
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Le nom est requis';
    }
    
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'L\'email est requis';
    } else {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.email)) {
        newErrors.email = 'Format d\'email invalide';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const emailChanged = formData.email.trim().toLowerCase() !== (user.email || '').toLowerCase();
      
      const response = await api.put(`/gerant/staff/${user.id}`, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || ''
      });

      toast.success('Informations mises à jour avec succès');
      
      // Afficher un avertissement si l'email a été modifié
      if (emailChanged) {
        toast.warning(
          'L\'email a été mis à jour. Le membre du personnel devra utiliser ce nouvel email pour sa prochaine connexion. Sa session actuelle reste active jusqu\'à expiration.',
          { duration: 8000 }
        );
      }
      
      onUpdate(response.data.user);
      onClose();
    } catch (error) {
      logger.error('Error updating staff member:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
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
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-[#1E40AF] flex items-center gap-2">
            <User className="w-6 h-6" />
            Modifier les informations
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Nom complet"
                  disabled={loading}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="email@example.com"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
                  placeholder="06 12 34 56 78"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
