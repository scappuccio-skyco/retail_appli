import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, Headphones, Heart, Settings, MapPin, MoreHorizontal } from 'lucide-react';
import Logo from '../../shared/Logo';
import TutorialButton from '../../onboarding/TutorialButton';
import NotificationBell from '../../notifications/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';

/**
 * Header du dashboard vendeur — design navbar plat.
 * Mobile : Logo · Magasin · Tutorial · Bell · Support · ⋯ · Logout
 * Desktop : + Profil · Perso · Mon manager · Avatar
 */
export default function SellerHeader({
  user,
  storeName,
  diagnostic,
  onLogout,
  onboarding,
  onOpenProfile,
  onOpenDiagnosticForm,
  onToggleFilters,
  onOpenSupport,
  onOpenManagerCompat,
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

  const initials = (user?.name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleProfile = () => {
    diagnostic ? onOpenProfile() : onOpenDiagnosticForm();
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm mb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-1 sm:gap-3">

        {/* Logo */}
        <div className="flex-shrink-0">
          <Logo variant="dashboard" size="sm" showByline={true} />
        </div>

        <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0" />

        {/* Magasin */}
        {storeName && (
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="max-w-[90px] sm:max-w-[130px] truncate">{storeName}</span>
          </div>
        )}

        {/* Badge rôle */}
        <span className="hidden lg:inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border bg-purple-50 text-purple-800 border-purple-300 flex-shrink-0">
          Espace Vendeur
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

          {/* Profil, Perso, Mon manager — inline sur sm+, dans ⋯ sur mobile */}
          <button
            onClick={handleProfile}
            className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-gray-600 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
            title="Mon Profil de Vente"
          >
            <User className="w-4 h-4" />
            <span className="hidden md:inline">Profil</span>
          </button>

          <button
            onClick={onToggleFilters}
            className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Personnaliser l'affichage"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Perso</span>
          </button>

          {onOpenManagerCompat && (
            <button
              onClick={onOpenManagerCompat}
              className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Comprendre mon manager"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden md:inline">Mon manager</span>
            </button>
          )}

          <button
            onClick={onOpenSupport}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            title="Contacter le support"
          >
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
          </button>

          {/* Bouton ⋯ — mobile uniquement */}
          <div ref={moreRef} className="relative sm:hidden">
            <button
              onClick={() => setShowMore(v => !v)}
              className="flex items-center px-2 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Plus d'options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[170px]">
                <button
                  onClick={() => { handleProfile(); setShowMore(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4 text-pink-500 flex-shrink-0" />
                  Mon Profil
                </button>
                <button
                  onClick={() => { onToggleFilters(); setShowMore(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  Personnaliser
                </button>
                {onOpenManagerCompat && (
                  <button
                    onClick={() => { onOpenManagerCompat(); setShowMore(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Heart className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    Mon manager
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0" />

        {/* Avatar + nom — sm+ */}
        <button
          onClick={handleProfile}
          className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          title="Mon profil"
        >
          <div className="text-right leading-tight">
            <p className="text-[10px] text-gray-400">Bienvenue</p>
            <p className="text-sm font-semibold text-gray-800 max-w-[100px] truncate">{user?.name}</p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-purple-600">
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
