import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/App.css';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SellerDashboard from './pages/SellerDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import GerantDashboard from './pages/GerantDashboard';
import ManagerSettings from './pages/ManagerSettings';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import RegisterGerant from './pages/RegisterGerant';
import RegisterManager from './pages/RegisterManager';
import RegisterSeller from './pages/RegisterSeller';
import InvitationPage from './pages/InvitationPage';
import EarlyAccess from './pages/EarlyAccess';
import EarlyAccessSuccess from './pages/EarlyAccessSuccess';
import WelcomePilot from './pages/WelcomePilot';
import DiagnosticForm from './components/DiagnosticFormScrollable';
import DiagnosticResult from './components/DiagnosticResult';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsent from './components/CookieConsent';
import DemoBanner from './components/DemoBanner';
import { Toaster } from 'sonner';

// Legal pages
import LegalNotice from './pages/legal/LegalNotice';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';

// Blog pages
import BlogIndex from './pages/blog/BlogIndex';
import ProfilDiscRetail from './pages/blog/ProfilDiscRetail';
import KpiRetail from './pages/blog/KpiRetail';

// Contextes
import { AuthProvider, SubscriptionProvider, useAuth } from './contexts';

// Inner component that has access to navigate + auth context
function AppContent() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    diagnostic,
    diagnosticLoading,
    showDiagnosticResult,
    login: handleLogin,
    logout: handleLogout,
    handleDiagnosticComplete,
    handleContinueToDashboard: handleContinueToDashboardCtx,
  } = useAuth();

  const handleContinueToDashboard = () => {
    handleContinueToDashboardCtx();
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div data-testid="loading-screen" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <>
      {user?.is_demo && <DemoBanner />}
      <Toaster
        position="top-right" 
        richColors
        expand={false}
        toastOptions={{
          duration: 3000,
          style: {
            padding: '12px 16px',
            fontSize: '14px',
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        }}
      />
      <Routes>
        {/* Landing Page - Public */}
        <Route
          path="/"
          element={<LandingPage />}
        />
        
        {/* Login Page */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        
        {/* Forgot Password Page */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Reset Password Page */}
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Registration Pages - Public */}
        <Route path="/register/gerant/:token" element={<RegisterGerant />} />
        <Route path="/register/manager/:token" element={<RegisterManager />} />
        <Route path="/register/seller/:token" element={<RegisterSeller />} />
        
        {/* Invitation Page - Public */}
        <Route path="/invitation/:token" element={<InvitationPage />} />
        
        {/* Legal Pages - Public */}
        <Route path="/legal" element={<LegalNotice />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Blog */}
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/profil-disc-retail" element={<ProfilDiscRetail />} />
        <Route path="/blog/kpi-retail" element={<KpiRetail />} />
        
        {/* Early Access Pages - Public */}
        <Route path="/early-access" element={<EarlyAccess />} />
        <Route path="/early-access-success" element={<EarlyAccessSuccess />} />
        <Route path="/welcome-pilot" element={<WelcomePilot />} />
        
        {/* Dashboard - Protected */}
        <Route
          path="/dashboard"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role === 'super_admin' ? (
              <Navigate to="/superadmin" replace />
            ) : (user.role === 'gerant') ? (
              <Navigate to="/gerant-dashboard" replace />
            ) : user.role === 'seller' ? (
              <SellerDashboard user={user} diagnostic={diagnostic} onLogout={handleLogout} />
            ) : (
              <ManagerDashboard user={user} onLogout={handleLogout} />
            )
          }
        />
        
        {/* Gerant Dashboard - Gerant Only */}
        <Route
          path="/gerant-dashboard"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (user.role !== 'gerant') ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <GerantDashboard user={user} onLogout={handleLogout} />
            )
          }
        />
        
        {/* Manager View - Gérant n'a plus accès : redirection vers dashboard gérant avec message */}
        <Route
          path="/manager-view"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (user.role === 'gerant') ? (
              <Navigate to="/gerant-dashboard" replace state={{ message: 'Accès réservé au personnel opérationnel' }} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        
        {/* Diagnostic - Seller Only */}
        <Route
          path="/diagnostic"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role !== 'seller' ? (
              <Navigate to="/dashboard" replace />
            ) : diagnosticLoading ? (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl font-medium text-gray-600">Analyse en cours...</div>
              </div>
            ) : diagnostic && showDiagnosticResult ? (
              <DiagnosticResult diagnostic={diagnostic} onContinue={handleContinueToDashboard} />
            ) : (
              <DiagnosticForm onComplete={handleDiagnosticComplete} />
            )
          }
        />
        
        {/* Manager Settings - Manager Only ; gérant redirigé vers son dashboard avec message */}
        <Route
          path="/manager/settings"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (user.role === 'gerant') ? (
              <Navigate to="/gerant-dashboard" replace state={{ message: 'Accès réservé au personnel opérationnel' }} />
            ) : user.role !== 'manager' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ManagerSettings />
            )
          }
        />
        {/* Catch-all /manager/* : gérant redirigé vers dashboard gérant avec message */}
        <Route
          path="/manager/*"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (user.role === 'gerant') ? (
              <Navigate to="/gerant-dashboard" replace state={{ message: 'Accès réservé au personnel opérationnel' }} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        
        {/* SuperAdmin Dashboard - SuperAdmin Only */}
        <Route
          path="/superadmin"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role !== 'super_admin' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SuperAdminDashboard />
            )
          }
        />
        
      </Routes>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <AppContent />
              <CookieConsent />
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
