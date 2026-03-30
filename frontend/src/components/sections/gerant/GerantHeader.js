import React from 'react';
import { LogOut, Settings, Headphones, BarChart3, Store, UserCog, Key, FileText, User } from 'lucide-react';
import Logo from '../../shared/Logo';
import TutorialButton from '../../onboarding/TutorialButton';
import NotificationBell from '../../notifications/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';

/**
 * Header du dashboard gérant : titre, welcome, badges, onglets, actions.
 */
export default function GerantHeader({
  user,
  subscriptionInfo,
  activeView,
  setActiveView,
  onLogout,
  onboarding,
  onOpenSubscription,
  onOpenSupport,
  onOpenBillingProfile,
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="bg-white shadow-md border-b-4 border-orange-500">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">

        {/* Titre + actions */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-1 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Logo variant="dashboard" size="sm" showByline={true} />
            </div>
            <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0" />
            {/* Magasin + badges */}
            {subscriptionInfo?.workspace_name && (
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700 flex-shrink-0">
                <span className="text-xs">🏪</span>
                <span className="max-w-[90px] sm:max-w-[160px] truncate">{subscriptionInfo.workspace_name}</span>
              </div>
            )}
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border bg-orange-50 text-orange-800 border-orange-300 flex-shrink-0">
              Espace Gérant
            </span>
          </div>

          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={onOpenBillingProfile}
              className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              title="Facturation — Profil B2B et factures"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Facturation</span>
            </button>
            <button
              onClick={onOpenSubscription}
              className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Mon abonnement</span>
            </button>
            <button
              onClick={onOpenSupport}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              title="Contacter le support"
            >
              <Headphones className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Support</span>
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
              onClick={onLogout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all text-xs sm:text-base"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Onglets de navigation */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="flex gap-1 border-b border-gray-200 min-w-max">
            {[
              { id: 'dashboard', icon: BarChart3, label: "Vue d'ensemble" },
              { id: 'stores',    icon: Store,    label: 'Magasins' },
              { id: 'staff',     icon: UserCog,  label: 'Personnel' },
              { id: 'api',       icon: Key,      label: 'Intégrations API' },
              { id: 'profile',   icon: User,     label: 'Profil' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all whitespace-nowrap ${
                  activeView === id
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
