import React, { useState } from 'react';
import { User, Mail, Phone, Building2, Save, Loader, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import useGerantProfile from './gerantProfile/useGerantProfile';
import PasswordSection from './gerantProfile/PasswordSection';

function ProfileField({ label, name, type = 'text', icon: Icon, value, onChange, disabled, error, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function GerantProfile() {
  const s = useGerantProfile();
  const navigate = useNavigate();
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') return;
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      toast.success('Compte supprimé. Vous allez être déconnecté.');
      setTimeout(() => {
        localStorage.clear();
        navigate('/login');
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (s.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!s.profile) {
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
            {!s.isEditing && (
              <button
                onClick={() => s.setIsEditing(true)}
                className="px-4 py-2 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={s.handleSubmit} className="p-6">
          <div className="space-y-6">
            <ProfileField
              label="Nom complet *"
              name="name"
              icon={User}
              value={s.formData.name}
              onChange={s.handleChange}
              disabled={!s.isEditing}
              error={s.errors.name}
              placeholder="Nom complet"
            />
            <ProfileField
              label="Email *"
              name="email"
              type="email"
              icon={Mail}
              value={s.formData.email}
              onChange={s.handleChange}
              disabled={!s.isEditing}
              error={s.errors.email}
              placeholder="email@example.com"
            />
            <ProfileField
              label="Téléphone"
              name="phone"
              type="tel"
              icon={Phone}
              value={s.formData.phone}
              onChange={s.handleChange}
              disabled={!s.isEditing}
              error={s.errors.phone}
              placeholder="06 12 34 56 78"
            />
            <ProfileField
              label="Nom de l'entreprise *"
              name="company_name"
              icon={Building2}
              value={s.formData.company_name}
              onChange={s.handleChange}
              disabled={!s.isEditing}
              error={s.errors.company_name}
              placeholder="Nom de votre entreprise"
            />

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Compte créé le : {s.profile.created_at
                  ? new Date(s.profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'N/A'}
              </p>
            </div>
          </div>

          <PasswordSection
            showPasswordSection={s.showPasswordSection}
            passwordData={s.passwordData}
            setPasswordData={s.setPasswordData}
            passwordErrors={s.passwordErrors}
            setPasswordErrors={s.setPasswordErrors}
            changingPassword={s.changingPassword}
            showPasswords={s.showPasswords}
            setShowPasswords={s.setShowPasswords}
            onToggle={s.togglePasswordSection}
            onCancel={s.cancelPasswordChange}
            onSubmit={s.handlePasswordChange}
          />

          {/* Zone de danger — RGPD droit à l'effacement */}
          <div className="mt-8 border border-red-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDeleteZone(!showDeleteZone)}
              className="w-full flex items-center justify-between px-5 py-4 bg-red-50 hover:bg-red-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-red-700 font-semibold">
                <Trash2 className="w-5 h-5" />
                Supprimer mon compte
              </div>
              <span className="text-xs text-red-500">{showDeleteZone ? '▲ Fermer' : '▼ Ouvrir'}</span>
            </button>

            {showDeleteZone && (
              <div className="px-5 py-5 space-y-4 bg-white">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Cette action est irréversible.</p>
                    <p>Votre compte, vos données personnelles et votre abonnement seront supprimés conformément au RGPD. Les données historiques (KPI, performances) seront anonymisées.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tapez <strong>SUPPRIMER</strong> pour confirmer
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="SUPPRIMER"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
                  className="w-full py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? <><Loader className="w-4 h-4 animate-spin" />Suppression...</> : <><Trash2 className="w-4 h-4" />Supprimer définitivement mon compte</>}
                </button>
              </div>
            )}
          </div>

          {s.isEditing && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={s.handleCancel}
                className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                disabled={s.saving}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                disabled={s.saving}
              >
                {s.saving ? (
                  <><Loader className="w-5 h-5 animate-spin" />Enregistrement...</>
                ) : (
                  <><Save className="w-5 h-5" />Enregistrer</>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
