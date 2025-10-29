import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState(null);
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
        
        // Check diagnostic status for sellers
        if (res.data.role === 'seller') {
          try {
            const diagRes = await axios.get(`${API}/diagnostic/me`);
            if (diagRes.data.status === 'completed') {
              setDiagnostic(diagRes.data.diagnostic);
            }
          } catch (err) {
            console.log('No diagnostic yet');
          }
        }
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogin = async (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    
    // Check diagnostic for new sellers
    if (userData.role === 'seller') {
      try {
        const diagRes = await axios.get(`${API}/diagnostic/me`);
        if (diagRes.data.status === 'completed') {
          setDiagnostic(diagRes.data.diagnostic);
        }
      } catch (err) {
        console.log('No diagnostic yet');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setDiagnostic(null);
  };

  const handleDiagnosticComplete = async (result) => {
    setDiagnostic(result);
    // Reload diagnostic from API to ensure fresh data
    try {
      const diagRes = await axios.get(`${API}/diagnostic/me`);
      if (diagRes.data.status === 'completed') {
        setDiagnostic(diagRes.data.diagnostic);
      }
    } catch (err) {
      console.log('Error reloading diagnostic');
    }
  };

  const handleContinueToDashboard = () => {
    setShowDiagnosticResult(false);
  };

  if (loading) {
    return (
      <div data-testid="loading-screen" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  // Show diagnostic result after completion (outside router)
  if (showDiagnosticResult && diagnostic) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <DiagnosticResult diagnostic={diagnostic} onContinue={handleContinueToDashboard} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
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
              !user ? (
                <Navigate to="/login" replace />
              ) : user.role !== 'seller' ? (
                <Navigate to="/" replace />
              ) : diagnostic ? (
                <Navigate to="/" replace />
              ) : (
                <DiagnosticForm onComplete={handleDiagnosticComplete} />
              )
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
      </BrowserRouter>
    </>
  );
}

export default App;
