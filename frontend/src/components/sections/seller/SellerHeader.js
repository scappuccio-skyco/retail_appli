import React from 'react';
import { LogOut, User, Headphones, Heart } from 'lucide-react';
import Logo from '../../shared/Logo';
import TutorialButton from '../../onboarding/TutorialButton';
import NotificationBell from '../../notifications/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';

/**
 * Header du dashboard vendeur.
 * Affiche le logo, le nom de l'utilisateur, le magasin, le manager et les boutons d'action.
 */
export default function SellerHeader({
  user,
  storeName,
  managerName,
  diagnostic,
  onLogout,
  onboarding,
  onOpenProfile,
  onOpenDiagnosticForm,
  showFilters,
  onToggleFilters,
  onOpenSupport,
  onOpenManagerCompat,
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="max-w-7xl mx-auto mb-8">
      <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

        {/* Identité */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Logo variant="header" size="md" showByline={true} />
          <div>
            <p className="text-gray-600 text-sm sm:text-base">
              Bienvenue, {user.name}
              {storeName && (
                <span className="inline-flex items-center gap-1 ml-2 text-[#1E40AF] font-semibold whitespace-nowrap">
                  • 🏢 {storeName}
                </span>
              )}
              {managerName && (
                <span className="inline-flex items-center gap-1 ml-2 text-purple-600 font-semibold whitespace-nowrap">
                  • 👤 {managerName}
                </span>
              )}
            </p>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Données sécurisées
              </span>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border bg-purple-50 text-purple-800 border-purple-300">
                Espace Vendeur
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
        <div className="flex overflow-x-auto gap-2 items-center justify-start md:justify-end w-full md:w-auto mt-4 md:mt-0 pb-1 md:pb-0 flex-nowrap">
          <button
            onClick={() => diagnostic ? onOpenProfile() : onOpenDiagnosticForm()}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-white border-2 border-pink-500 text-pink-600 font-semibold rounded-xl hover:bg-pink-50 hover:shadow-md transition-all text-sm sm:text-base"
            title="Mon Profil de Vente"
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Profil</span>
          </button>

          <button
            onClick={onToggleFilters}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-white border-2 border-purple-500 text-purple-600 font-semibold rounded-xl hover:bg-purple-50 hover:shadow-md transition-all group text-sm sm:text-base"
            title="Personnaliser l'affichage du dashboard"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Personnaliser</span>
          </button>

          {onOpenManagerCompat && (
            <button
              onClick={onOpenManagerCompat}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all text-sm sm:text-base"
              title="Comprendre mon manager"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Mon manager</span>
            </button>
          )}

          <button
            onClick={onOpenSupport}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all text-sm sm:text-base"
            title="Contacter le support"
          >
            <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Support</span>
          </button>

          <TutorialButton onClick={onboarding.open} />

          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />

          <button
            data-testid="logout-button"
            onClick={onLogout}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all text-sm sm:text-base"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
