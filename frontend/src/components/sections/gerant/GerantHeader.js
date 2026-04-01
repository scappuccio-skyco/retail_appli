import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, Headphones, BarChart3, Store, UserCog, Key, FileText, User, MoreHorizontal } from 'lucide-react';
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
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMore(false);
      }
    };
    if (showMore) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMore]);

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
          </div>

          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            {/* Facturation, Abonnement — inline sur sm+, dans ⋯ sur mobile */}
            <button
              onClick={onOpenBillingProfile}
              className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              title="Facturation — Profil B2B et factures"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xl:inline">Facturation</span>
            </button>
            <button
              onClick={onOpenSubscription}
              className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xl:inline">Mon abonnement</span>
            </button>

            {/* Bouton ⋯ — mobile uniquement */}
            <div ref={moreRef} className="relative sm:hidden">
              <button
                onClick={() => setShowMore(v => !v)}
                className="flex items-center px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Plus d'options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMore && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px]">
                  <button
                    onClick={() => { onOpenBillingProfile(); setShowMore(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    Facturation
                  </button>
                  <button
                    onClick={() => { onOpenSubscription(); setShowMore(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    Mon abonnement
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onOpenSupport}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              title="Contacter le support"
            >
              <Headphones className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xl:inline">Support</span>
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
        <div className="flex items-center border-b border-gray-200">
          {[
            { id: 'dashboard', icon: BarChart3, label: "Vue d'ensemble" },
            { id: 'stores',    icon: Store,    label: 'Magasins' },
            { id: 'staff',     icon: UserCog,  label: 'Personnel' },
            { id: 'api',       icon: Key,      label: 'API' },
            { id: 'profile',   icon: User,     label: 'Profil' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              title={label}
              className={`flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1 sm:gap-2 px-1 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all ${
                activeView === id
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <span className="hidden sm:inline-flex items-center ml-auto mr-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-orange-50 text-orange-800 border-orange-300 flex-shrink-0">
            Espace Gérant
          </span>
        </div>
      </div>
    </div>
  );
}
