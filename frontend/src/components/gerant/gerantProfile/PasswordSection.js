import React from 'react';
import { Lock, Eye, EyeOff, Loader } from 'lucide-react';

function PasswordField({ label, field, value, show, error, onChange, onToggleShow }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label} *</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder={label}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function PasswordSection({
  showPasswordSection, passwordData, setPasswordData,
  passwordErrors, setPasswordErrors,
  changingPassword, showPasswords, setShowPasswords,
  onToggle, onCancel, onSubmit,
}) {
  const updateField = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) setPasswordErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
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
          onClick={onToggle}
          className="px-4 py-2 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
        >
          {showPasswordSection ? 'Annuler' : 'Modifier le mot de passe'}
        </button>
      </div>

      {showPasswordSection && (
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <PasswordField
            label="Ancien mot de passe"
            value={passwordData.old_password}
            show={showPasswords.old}
            error={passwordErrors.old_password}
            onChange={(e) => updateField('old_password', e.target.value)}
            onToggleShow={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
          />
          <PasswordField
            label="Nouveau mot de passe"
            value={passwordData.new_password}
            show={showPasswords.new}
            error={passwordErrors.new_password}
            onChange={(e) => updateField('new_password', e.target.value)}
            onToggleShow={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
          />
          <PasswordField
            label="Confirmer le nouveau mot de passe"
            value={passwordData.confirm_password}
            show={showPasswords.confirm}
            error={passwordErrors.confirm_password}
            onChange={(e) => updateField('confirm_password', e.target.value)}
            onToggleShow={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
              disabled={changingPassword}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              disabled={changingPassword}
            >
              {changingPassword ? (
                <><Loader className="w-5 h-5 animate-spin" />Modification...</>
              ) : (
                <><Lock className="w-5 h-5" />Modifier le mot de passe</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
