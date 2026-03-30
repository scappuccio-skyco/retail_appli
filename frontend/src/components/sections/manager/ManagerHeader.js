import React from 'react';
import { LogOut, Headphones, Settings, MapPin, ArrowLeftRight } from 'lucide-react';
import Logo from '../../shared/Logo';
import TutorialButton from '../../onboarding/TutorialButton';
import NotificationBell from '../../notifications/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';

/**
 * Header du dashboard manager — design navbar plat.
 * Logo · Magasin · Rôle · [spacer] · Tutoriel · Notifs · Config · Support · Avatar · Déconnexion
 */
export default function ManagerHeader({
  user,
  storeName,
  managerDiagnostic,
  onLogout,
  onboarding,
  onOpenProfile,
  onOpenDiagnostic,
  onToggleFilters,
  onOpenSupport,
  spaceLabel,
  isGerantSpace,
  isMultiStore,
  onSwitchStore,
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const initials = (user?.name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm mb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-3">

        {/* Logo */}
        <div className="flex-shrink-0">
          <Logo variant="dashboard" size="sm" showByline={true} />
        </div>

        <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0" />

        {/* Magasin */}
        <button
          onClick={isMultiStore ? onSwitchStore : undefined}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700 flex-shrink-0 ${
            isMultiStore ? 'hover:bg-gray-200 cursor-pointer transition-colors' : 'cursor-default'
          }`}
          title={isMultiStore ? 'Changer de magasin' : storeName}
        >
          <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="max-w-[90px] sm:max-w-[130px] truncate">{storeName || 'Magasin'}</span>
          {isMultiStore && <ArrowLeftRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        </button>

        {/* Badge rôle */}
        <span className={`hidden lg:inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border flex-shrink-0 ${
          isGerantSpace
            ? 'bg-orange-50 text-orange-800 border-orange-300'
            : 'bg-blue-50 text-blue-800 border-blue-300'
        }`}>
          {spaceLabel}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <TutorialButton
            onClick={onboarding.open}
            isCompleted={onboarding.isCompleted}
            currentStep={onboarding.currentStep}
            totalSteps={onboarding.totalSteps}
          />

          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />

          <button
            onClick={onToggleFilters}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Configuration"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Config</span>
          </button>

          <button
            onClick={onOpenSupport}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            title="Contacter le support"
          >
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
          </button>
        </div>

        <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0" />

        {/* Avatar + nom (cliquable → profil) */}
        <button
          onClick={managerDiagnostic ? onOpenProfile : onOpenDiagnostic}
          className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          title="Mon profil"
        >
          <div className="text-right leading-tight">
            <p className="text-[10px] text-gray-400">Bienvenue</p>
            <p className="text-sm font-semibold text-gray-800 max-w-[100px] truncate">{user?.name}</p>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            isGerantSpace ? 'bg-orange-500' : 'bg-[#1E40AF]'
          }`}>
            {initials}
          </div>
        </button>

        {/* Déconnexion */}
        <button
          data-testid="logout-button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Déconnexion"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden lg:inline">Déconnexion</span>
        </button>

      </div>
    </div>
  );
}
