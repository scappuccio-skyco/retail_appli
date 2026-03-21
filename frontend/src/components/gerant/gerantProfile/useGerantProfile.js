import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { toast } from 'sonner';
import { logger } from '../../../utils/logger';

export default function useGerantProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company_name: '' });
  const [errors, setErrors] = useState({});

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gerant/profile');
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        company_name: response.data.company_name || '',
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
    if (!formData.name?.trim()) newErrors.name = 'Le nom est requis';
    if (!formData.email?.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format d'email invalide";
    }
    if (!formData.company_name?.trim()) newErrors.company_name = "Le nom de l'entreprise est requis";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const response = await api.put('/gerant/profile', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || '',
        company_name: formData.company_name.trim(),
      });
      setProfile(response.data.profile);
      setIsEditing(false);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      logger.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        company_name: profile.company_name || '',
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  const validatePasswordForm = () => {
    const newErrors = {};
    if (!passwordData.old_password?.trim()) newErrors.old_password = "L'ancien mot de passe est requis";
    if (!passwordData.new_password?.trim()) {
      newErrors.new_password = 'Le nouveau mot de passe est requis';
    } else if (passwordData.new_password.length < 8) {
      newErrors.new_password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (!passwordData.confirm_password?.trim()) {
      newErrors.confirm_password = 'La confirmation du mot de passe est requise';
    } else if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = 'Les mots de passe ne correspondent pas';
    }
    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = async () => {
    if (!validatePasswordForm()) return;
    setChangingPassword(true);
    try {
      await api.put('/gerant/profile/change-password', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      });
      toast.success('Mot de passe modifié avec succès');
      setShowPasswordSection(false);
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordErrors({});
    } catch (error) {
      logger.error('Error changing password:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification du mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  const togglePasswordSection = () => {
    setShowPasswordSection(prev => {
      if (!prev) {
        setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
        setPasswordErrors({});
      }
      return !prev;
    });
  };

  const cancelPasswordChange = () => {
    setShowPasswordSection(false);
    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    setPasswordErrors({});
  };

  return {
    profile, loading, saving, isEditing, setIsEditing,
    formData, errors,
    showPasswordSection, passwordData, setPasswordData,
    passwordErrors, setPasswordErrors,
    changingPassword, showPasswords, setShowPasswords,
    handleSubmit, handleChange, handleCancel,
    handlePasswordChange, togglePasswordSection, cancelPasswordChange,
  };
}
