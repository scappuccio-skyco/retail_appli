import React from 'react';
import { LogOut, Settings, Headphones, BarChart3, Store, UserCog, Key, FileText, User, Receipt } from 'lucide-react';
import TutorialButton from '../../onboarding/TutorialButton';

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
  onOpenInvoices,
}) {
  return (
    <div className="bg-white shadow-md border-b-4 border-orange-500">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">

        {/* Titre + actions */}
        <div className="flex items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
          <div className="min-w-0 flex-1 max-w-[250px] sm:max-w-none">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
              🏢 <span className="hidden sm:inline">Dashboard </span>Gérant
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 truncate">
              Bonjour, {user?.name}
              {subscriptionInfo?.workspace_name && (
                <span className="inline-flex items-center gap-1 ml-2 text-[#1E40AF] font-semibold whitespace-nowrap">
                  • 🏪 {subscriptionInfo.workspace_name}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="hidden xs:inline">Données sécurisées</span>
                <span className="xs:hidden">Sécurisé</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border bg-orange-50 text-orange-800 border-orange-300">
                Espace Gérant
              </span>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={onOpenInvoices}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              title="Mes factures"
            >
              <Receipt className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Factures</span>
            </button>
            <button
              onClick={onOpenBillingProfile}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:shadow-md transition-all text-xs sm:text-sm"
              title="Informations de facturation B2B"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Facturation</span>
            </button>
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
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
            <TutorialButton onClick={onboarding.open} />
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
