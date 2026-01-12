import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Building2, Save, Loader, Edit2, Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';

export default function GerantProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: ''
  });
  const [errors, setErrors] = useState({});
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gerant/profile');
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        company_name: response.data.company_name || ''
      });
    } catch (error) {
      logger.error('Error fetching profile:', error);
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

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

    if (!formData.company_name || formData.company_name.trim() === '') {
      newErrors.company_name = 'Le nom de l\'entreprise est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/gerant/profile', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || '',
        company_name: formData.company_name.trim()
      });

      setProfile(response.data.profile);
      setIsEditing(false);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      logger.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
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

  const handleCancel = () => {
    // Reset form data to original profile
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        company_name: profile.company_name || ''
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  const validatePasswordForm = () => {
    const newErrors = {};

    if (!passwordData.old_password || passwordData.old_password.trim() === '') {
      newErrors.old_password = 'L\'ancien mot de passe est requis';
    }

    if (!passwordData.new_password || passwordData.new_password.trim() === '') {
      newErrors.new_password = 'Le nouveau mot de passe est requis';
    } else if (passwordData.new_password.length < 8) {
      newErrors.new_password = 'Le mot de passe doit contenir au moins 8 caractères';
    }

    if (!passwordData.confirm_password || passwordData.confirm_password.trim() === '') {
      newErrors.confirm_password = 'La confirmation du mot de passe est requise';
    } else if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = 'Les mots de passe ne correspondent pas';
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/gerant/profile/change-password', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });

      toast.success('Mot de passe modifié avec succès');
      setShowPasswordSection(false);
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordErrors({});
    } catch (error) {
      logger.error('Error changing password:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la modification du mot de passe';
      toast.error(errorMessage);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Impossible de charger le profil</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="w-7 h-7" />
                Mon Profil
              </h2>
              <p className="text-orange-100 mt-1">Gérez vos informations personnelles</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
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
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  } ${!isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  placeholder="Nom complet"
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
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } ${!isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  placeholder="email@example.com"
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
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  } ${!isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  placeholder="06 12 34 56 78"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de l'entreprise *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.company_name ? 'border-red-500' : 'border-gray-300'
                  } ${!isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  placeholder="Nom de votre entreprise"
                />
              </div>
              {errors.company_name && (
                <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
              )}
            </div>

            {/* Created At Info */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Compte créé le : {profile.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Security Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-orange-600" />
                  Sécurité
                </h3>
                <p className="text-sm text-gray-500 mt-1">Modifiez votre mot de passe</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(!showPasswordSection);
                  if (!showPasswordSection) {
                    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
                    setPasswordErrors({});
                  }
                }}
                className="px-4 py-2 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
              >
                {showPasswordSection ? 'Annuler' : 'Modifier le mot de passe'}
              </button>
            </div>

            {showPasswordSection && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                {/* Old Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ancien mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPasswords.old ? 'text' : 'password'}
                      value={passwordData.old_password}
                      onChange={(e) => {
                        setPasswordData(prev => ({ ...prev, old_password: e.target.value }));
                        if (passwordErrors.old_password) {
                          setPasswordErrors(prev => ({ ...prev, old_password: '' }));
                        }
                      }}
                      className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        passwordErrors.old_password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ancien mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.old ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.old_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.old_password}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => {
                        setPasswordData(prev => ({ ...prev, new_password: e.target.value }));
                        if (passwordErrors.new_password) {
                          setPasswordErrors(prev => ({ ...prev, new_password: '' }));
                        }
                      }}
                      className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        passwordErrors.new_password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Nouveau mot de passe (min. 8 caractères)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.new_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.new_password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmer le nouveau mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => {
                        setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }));
                        if (passwordErrors.confirm_password) {
                          setPasswordErrors(prev => ({ ...prev, confirm_password: '' }));
                        }
                      }}
                      className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        passwordErrors.confirm_password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Confirmer le nouveau mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.confirm_password}</p>
                  )}
                </div>

                {/* Password Change Button */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection(false);
                      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
                      setPasswordErrors({});
                    }}
                    className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                    disabled={changingPassword}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Modification...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Modifier le mot de passe
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
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
          )}
        </form>
      </div>
    </div>
  );
}
