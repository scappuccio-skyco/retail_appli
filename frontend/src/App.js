import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import { Toaster } from 'sonner';

// Lazy load pages for better performance (Code Splitting)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const ManagerSettings = lazy(() => import('./pages/ManagerSettings'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const DiagnosticForm = lazy(() => import('./components/DiagnosticFormScrollable'));
const DiagnosticResult = lazy(() => import('./components/DiagnosticResult'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
    </div>
  </div>
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Axios interceptor for auth token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
        const res = await axios.get(`${API}/auth/me`);
        setUser(res.data);
        
        // Check diagnostic status for sellers - MUST complete before setting loading to false
        if (res.data.role === 'seller') {
          try {
            const diagRes = await axios.get(`${API}/diagnostic/me`);
            if (diagRes.data.status === 'completed') {
              setDiagnostic(diagRes.data.diagnostic);
              console.log('Diagnostic loaded:', diagRes.data.diagnostic);
            } else {
              console.log('Diagnostic not completed yet');
            }
          } catch (err) {
            console.log('No diagnostic yet:', err.response?.status);
            // If 404, seller hasn't started diagnostic - this is expected
            setDiagnostic(null);
          }
        }
      } catch (err) {
        console.log('Auth error:', err);
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
    
    // Check diagnostic for new sellers - ensure it completes before navigation
    if (userData.role === 'seller') {
      try {
        const diagRes = await axios.get(`${API}/diagnostic/me`);
        if (diagRes.data.status === 'completed') {
          setDiagnostic(diagRes.data.diagnostic);
          console.log('Diagnostic already completed:', diagRes.data.diagnostic);
        } else {
          console.log('Diagnostic not completed');
          setDiagnostic(null);
        }
      } catch (err) {
        console.log('No diagnostic yet:', err.response?.status);
        setDiagnostic(null);
      }
    }
    
    // Navigate to dashboard after successful login
    // Using window.location for reliable redirect
    window.location.href = '/dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setDiagnostic(null);
  };

  const handleDiagnosticComplete = async (result) => {
    console.log('🎯 handleDiagnosticComplete called with result:', result);
    console.log('🎯 Result keys:', Object.keys(result));
    console.log('🎯 Full result:', JSON.stringify(result, null, 2));
    console.log('🎯 Setting diagnosticLoading to true');
    
    setDiagnosticLoading(true);
    
    // Set diagnostic immediately from the response
    setDiagnostic(result);
    
    console.log('🎯 Diagnostic set, now setting showDiagnosticResult to true');
    setShowDiagnosticResult(true);
    
    console.log('🎯 States updated - navigating or showing result');
    
    // Small delay to ensure state updates propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setDiagnosticLoading(false);
    
    // Fetch fresh diagnostic data from backend to ensure consistency
    try {
      const diagRes = await axios.get(`${API}/diagnostic/me`);
      if (diagRes.data.status === 'completed') {
        setDiagnostic(diagRes.data.diagnostic);
        console.log('🎯 Diagnostic reloaded from API:', diagRes.data.diagnostic);
      }
    } catch (err) {
      console.error('❌ Error reloading diagnostic:', err);
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
      <Toaster position="top-right" richColors />
      <Suspense fallback={<PageLoader />}>
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
        
        {/* Dashboard - Protected */}
        <Route
          path="/dashboard"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role === 'super_admin' ? (
              <Navigate to="/superadmin" replace />
            ) : user.role === 'seller' ? (
              <SellerDashboard user={user} diagnostic={diagnostic} onLogout={handleLogout} />
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
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
