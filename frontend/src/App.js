import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
// DEPRECATED: Import massif fusionné dans GerantDashboard - Phase 3 Fusion Enterprise
// import ITAdminDashboard from './pages/ITAdminDashboard';
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
import { Toaster } from 'sonner';

// Legal pages
import LegalNotice from './pages/legal/LegalNotice';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';

// API Client unifié
import { api } from './lib/apiClient';
import { logger } from './utils/logger';

// Inner component that has access to navigate
function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [showDiagnosticResult, setShowDiagnosticResult] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
        
        // Check diagnostic status for sellers - MUST complete before setting loading to false
        if (res.data.role === 'seller') {
          try {
            const diagRes = await api.get('/seller/diagnostic/me');
            if (diagRes.data.status === 'completed') {
              setDiagnostic(diagRes.data.diagnostic);
              logger.log('Diagnostic loaded:', diagRes.data.diagnostic);
            } else {
              logger.log('Diagnostic not completed yet');
            }
          } catch (err) {
            logger.log('No diagnostic yet:', err.response?.status);
            // If 404, seller hasn't started diagnostic - this is expected
            setDiagnostic(null);
          }
        }
      } catch (err) {
        logger.log('Auth error:', err);
        localStorage.removeItem('token');
        setUser(null);
      }
    }
    // Only set loading to false after ALL data fetching is complete
    setLoading(false);
  };

  const handleLogin = async (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    
    // Vérifier si l'utilisateur vient du tunnel Early Adopter
    const earlyAdopterData = localStorage.getItem('early_adopter_candidate');
    const isEarlyAdopter = earlyAdopterData !== null;
    
    // Si c'est un early adopter et qu'il vient de s'inscrire, rediriger vers welcome-pilot
    if (isEarlyAdopter && (userData.role === 'gérant' || userData.role === 'gerant')) {
      logger.log('✅ Early Adopter detected, redirecting to welcome-pilot');
      window.location.href = '/welcome-pilot';
      return;
    }
    
    // Redirection selon le rôle
    logger.log('🔍 User role for redirect:', userData.role, 'Type:', typeof userData.role);
    if (userData.role === 'gérant' || userData.role === 'gerant') {
      // Gérant → Dashboard Gérant
      logger.log('✅ Redirecting to gerant-dashboard');
      window.location.href = '/gerant-dashboard';
      return;
    }
    
    if (userData.role === 'it_admin') {
      // IT Admin → IT Admin Dashboard
      window.location.href = '/it-admin';
      return;
    }
    
    if (userData.role === 'superadmin' || userData.role === 'super_admin') {
      // Super Admin → Super Admin Dashboard
      window.location.href = '/superadmin';
      return;
    }
    
    // Check diagnostic for new sellers - ensure it completes before navigation
    if (userData.role === 'seller') {
      try {
        const diagRes = await api.get('/seller/diagnostic/me');
        if (diagRes.data.status === 'completed') {
          setDiagnostic(diagRes.data.diagnostic);
          logger.log('Diagnostic already completed:', diagRes.data.diagnostic);
        } else {
          logger.log('Diagnostic not completed');
          setDiagnostic(null);
        }
      } catch (err) {
        logger.log('No diagnostic yet:', err.response?.status);
        setDiagnostic(null);
      }
    }
    
    // Navigate to dashboard after successful login (Manager or Seller)
    // Using window.location for reliable redirect
    logger.log('⚠️ Fallback redirect to /dashboard for role:', userData.role);
    window.location.href = '/dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setDiagnostic(null);
  };

  const handleDiagnosticComplete = async (result) => {
    logger.log('🎯 handleDiagnosticComplete called with result:', result);
    logger.log('🎯 Result keys:', Object.keys(result));
    logger.log('🎯 Full result:', JSON.stringify(result, null, 2));
    logger.log('🎯 Setting diagnosticLoading to true');
    
    setDiagnosticLoading(true);
    
    // Set diagnostic immediately from the response
    setDiagnostic(result);
    
    logger.log('🎯 Diagnostic set, now setting showDiagnosticResult to true');
    setShowDiagnosticResult(true);
    
    logger.log('🎯 States updated - navigating or showing result');
    
    // Small delay to ensure state updates propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setDiagnosticLoading(false);
    
    // Fetch fresh diagnostic data from backend to ensure consistency
    try {
      const diagRes = await api.get('/seller/diagnostic/me');
      if (diagRes.data.status === 'completed') {
        setDiagnostic(diagRes.data.diagnostic);
        logger.log('🎯 Diagnostic reloaded from API:', diagRes.data.diagnostic);
      }
    } catch (err) {
      logger.error('❌ Error reloading diagnostic:', err);
    }
  };

  const handleContinueToDashboard = () => {
    setShowDiagnosticResult(false);
    navigate('/dashboard'); // Go to seller dashboard
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
            ) : user.role === 'it_admin' ? (
              <Navigate to="/it-admin" replace />
            ) : (user.role === 'gerant' || user.role === 'gérant') ? (
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
            ) : (user.role !== 'gerant' && user.role !== 'gérant') ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <GerantDashboard user={user} onLogout={handleLogout} />
            )
          }
        />
        
        {/* Manager View for Gerant - Allows gerant to access manager dashboard for a specific store */}
        <Route
          path="/manager-view"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (user.role !== 'gerant' && user.role !== 'gérant') ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ManagerDashboard user={user} onLogout={handleLogout} />
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
        
        {/* Manager Settings - Manager Only */}
        <Route
          path="/manager/settings"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role !== 'manager' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ManagerSettings />
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
        
        {/* DEPRECATED: IT Admin Dashboard - Fonctionnalité fusionnée dans GerantDashboard */}
        {/* <Route
          path="/it-admin"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role !== 'it_admin' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ITAdminDashboard user={user} onLogout={handleLogout} />
            )
          }
        /> */}
        
        {/* Redirection temporaire des IT Admin vers le GerantDashboard */}
        <Route
          path="/it-admin"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
        <CookieConsent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
