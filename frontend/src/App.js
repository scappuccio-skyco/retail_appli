import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import Login from './pages/Login';
import SellerDashboard from './pages/SellerDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import DiagnosticForm from './components/DiagnosticFormClass';
import DiagnosticResult from './components/DiagnosticResult';
import { Toaster } from 'sonner';

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
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setDiagnostic(null);
  };

  const handleDiagnosticComplete = async (result) => {
    console.log('🎯 handleDiagnosticComplete called with result:', result);
    console.log('🎯 Setting diagnostic state and showDiagnosticResult to true');
    
    // Set diagnostic immediately from the response
    setDiagnostic(result);
    setShowDiagnosticResult(true);
    
    console.log('🎯 States updated - diagnostic:', result, 'showDiagnosticResult: true');
    
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
    // Navigate to dashboard
    navigate('/');
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
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/diagnostic"
          element={
            (() => {
              console.log('🔍 /diagnostic route - user:', user?.email, 'role:', user?.role);
              console.log('🔍 /diagnostic route - diagnostic:', diagnostic ? 'EXISTS' : 'NULL');
              console.log('🔍 /diagnostic route - showDiagnosticResult:', showDiagnosticResult);
              
              if (!user) {
                console.log('➡️ Redirecting to /login (no user)');
                return <Navigate to="/login" replace />;
              }
              
              if (user.role !== 'seller') {
                console.log('➡️ Redirecting to / (not a seller)');
                return <Navigate to="/" replace />;
              }
              
              if (diagnostic && !showDiagnosticResult) {
                console.log('➡️ Redirecting to / (diagnostic exists, not showing result)');
                return <Navigate to="/" replace />;
              }
              
              if (diagnostic && showDiagnosticResult) {
                console.log('✅ Showing DiagnosticResult');
                return <DiagnosticResult diagnostic={diagnostic} onContinue={handleContinueToDashboard} />;
              }
              
              console.log('📝 Showing DiagnosticForm');
              return <DiagnosticForm onComplete={handleDiagnosticComplete} />;
            })()
          }
        />
        <Route
          path="/"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role === 'seller' ? (
              <SellerDashboard user={user} diagnostic={diagnostic} onLogout={handleLogout} />
            ) : (
              <ManagerDashboard user={user} onLogout={handleLogout} />
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
