import React from 'react';
import { LogOut, Sparkles, Headphones, ArrowLeftRight } from 'lucide-react';
import Logo from '../../shared/Logo';
import SyncModeBadge from '../../SyncModeBadge';
import TutorialButton from '../../onboarding/TutorialButton';
import NotificationBell from '../../notifications/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';

/**
 * Header du dashboard manager.
 * Affiche le logo, welcome, store name, badges rôle, et boutons d'action.
 */
export default function ManagerHeader({
  user,
  storeName,
  managerDiagnostic,
  onLogout,
  onboarding,
  onOpenProfile,
  onOpenDiagnostic,
  showFilters,
  onToggleFilters,
  onOpenSupport,
  spaceLabel,
  isGerantSpace,
  isMultiStore,
  onSwitchStore,
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="max-w-7xl mx-auto mb-8">
      <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

        {/* Identité */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Logo variant="header" size="md" showByline={true} />
          <div>
            <p className="text-gray-600 text-sm sm:text-base flex items-center flex-wrap gap-1">
              Bienvenue, {user.name}
              {storeName && (
                <span className="inline-flex items-center gap-1 ml-2 text-[#1E40AF] font-semibold whitespace-nowrap">
                  • 🏢 {storeName}
                </span>
              )}
              {isMultiStore && (
                <button
                  onClick={onSwitchStore}
                  className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 text-xs font-medium text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors whitespace-nowrap"
                  title="Changer de magasin"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  Changer
                </button>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Données sécurisées
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${
                isGerantSpace
                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}>
                {spaceLabel}
              </span>
              <span
                className="text-xs text-gray-500 cursor-help"
                title="Vos données sont chiffrées. Les noms de famille sont anonymisés dans les analyses IA. Aucune donnée n'est conservée par l'IA."
              >
                ℹ️
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap items-center justify-center md:justify-start w-full md:w-auto">
          <button
            onClick={managerDiagnostic ? onOpenProfile : onOpenDiagnostic}
            className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Profil</span>
          </button>

          <button
            onClick={onToggleFilters}
            className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Config</span>
          </button>

          <button
            onClick={onOpenSupport}
            className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
            title="Contacter le support"
          >
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
          </button>

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
            data-testid="logout-button"
            onClick={onLogout}
            className="px-3 py-2 flex items-center gap-1.5 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 hover:shadow-lg transition-all text-sm"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Sync Mode Badge */}
      <div className="mt-2">
        <SyncModeBadge />
      </div>
    </div>
  );
}
