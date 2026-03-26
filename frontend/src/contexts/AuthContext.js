import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { api } from '../lib/apiClient';

/**
 * AuthContext — source de vérité pour l'utilisateur connecté.
 *
 * Expose :
 *   user          — objet utilisateur courant (ou null)
 *   loading       — true pendant la vérification initiale du token
 *   diagnostic    — résultat du diagnostic DISC vendeur (ou null)
 *   login()       — appelé après une connexion/inscription réussie
 *   logout()      — supprime le token et reset l'état
 *   refreshUser() — recharge /auth/me depuis le backend
 *   setDiagnostic — setter direct (pour handleDiagnosticComplete)
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [showDiagnosticResult, setShowDiagnosticResult] = useState(false);

  // ─── Vérification de session au démarrage ────────────────────────────────
  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);

      // Pour les vendeurs : charger le diagnostic
      if (res.data.role === 'seller') {
        try {
          const diagRes = await api.get('/seller/diagnostic/me');
          if (diagRes.data.status === 'completed') {
            setDiagnostic(diagRes.data.diagnostic);
          }
        } catch {
          setDiagnostic(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ─── Recharge les données utilisateur depuis l'API ───────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      return res.data;
    } catch (err) {
      logger.error('Error refreshing user:', err);
      return null;
    }
  }, []);

  // ─── Login (appelé par Login.js après succès) ────────────────────────────
  const login = useCallback(async (userData, _token, isRegistration = false) => {
    // Token is now stored in httpOnly cookie set by the backend — no localStorage
    setUser(userData);

    // Tunnel Early Adopter : redirection welcome-pilot uniquement à l'inscription
    const earlyAdopterData = localStorage.getItem('early_adopter_candidate');
    if (isRegistration && earlyAdopterData && (userData.role === 'gérant' || userData.role === 'gerant')) {
      localStorage.removeItem('early_adopter_candidate');
      globalThis.location.href = '/welcome-pilot';
      return;
    }
    if (!isRegistration && earlyAdopterData) {
      localStorage.removeItem('early_adopter_candidate');
    }

    // Redirection par rôle
    const role = userData.role;
    if (role === 'gérant' || role === 'gerant') {
      globalThis.location.href = '/gerant-dashboard';
      return;
    }
    if (role === 'superadmin' || role === 'super_admin') {
      globalThis.location.href = '/superadmin';
      return;
    }

    // Vendeur : charger le diagnostic avant la redirection
    if (role === 'seller') {
      try {
        const diagRes = await api.get('/seller/diagnostic/me');
        if (diagRes.data.status === 'completed') {
          setDiagnostic(diagRes.data.diagnostic);
        } else {
          setDiagnostic(null);
        }
      } catch {
        setDiagnostic(null);
      }
    }

    globalThis.location.href = '/dashboard';
  }, []);

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort: proceed even if server call fails
    }
    setUser(null);
    setDiagnostic(null);
  }, []);

  // ─── Complétion du diagnostic vendeur ───────────────────────────────────
  const handleDiagnosticComplete = useCallback(async (result) => {
    setDiagnosticLoading(true);
    setDiagnostic(result);
    setShowDiagnosticResult(true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    setDiagnosticLoading(false);

    // Recharger le diagnostic depuis le backend pour assurer la cohérence
    try {
      const diagRes = await api.get('/seller/diagnostic/me');
      if (diagRes.data.status === 'completed') {
        setDiagnostic(diagRes.data.diagnostic);
      }
    } catch (err) {
      logger.error('Error reloading diagnostic:', err);
    }
  }, []);

  const handleContinueToDashboard = useCallback(() => {
    setShowDiagnosticResult(false);
  }, []);

  const value = {
    user,
    setUser,
    loading,
    diagnostic,
    setDiagnostic,
    diagnosticLoading,
    showDiagnosticResult,
    login,
    logout,
    refreshUser,
    handleDiagnosticComplete,
    handleContinueToDashboard,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook pour consommer AuthContext.
 * @example
 *   const { user, logout } = useAuth();
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
