import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Désactiver l'overlay d'erreur React pour les erreurs d'extension
if (process.env.NODE_ENV === 'development') {
  const showErrorOverlay = (err) => {
    // Ne rien faire - overlay désactivé pour toutes les erreurs MetaMask
    const isExtensionError = 
      err?.message?.includes('MetaMask') ||
      err?.message?.includes('Failed to connect') ||
      err?.message?.includes('Échec de la connexion') ||
      err?.stack?.includes('chrome-extension://');
    
    if (!isExtensionError) {
      // Pour les autres erreurs, laisser React gérer
      console.error('Erreur React:', err);
    }
  };
  
  // Surcharger le handler d'erreur de React
  window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__ = {
    isSupportedErrorBoundaryVersion: () => true,
    registerErrorOverlay: () => {},
    clearErrorOverlay: () => {},
    reportBuildError: () => {},
    reportRuntimeError: (err) => {
      const isExtensionError = 
        err?.message?.includes('MetaMask') ||
        err?.message?.includes('Failed to connect') ||
        err?.message?.includes('Échec de la connexion') ||
        err?.stack?.includes('chrome-extension://');
      
      if (isExtensionError) {
        console.warn('Erreur d\'extension interceptée (overlay bloqué):', err.message);
        return; // Bloquer l'overlay
      }
      // Pour les autres erreurs, on laisse passer (comportement par défaut impossible à reproduire ici)
    }
  };
}

// Surcharger console.error pour filtrer les erreurs d'extension
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  const message = String(args[0] || '');
  const fullMessage = args.join(' ');
  
  // Ignorer les erreurs d'extensions
  if (
    message.includes('MetaMask') ||
    message.includes('chrome-extension://') ||
    message.includes('Failed to connect') ||
    message.includes('Échec de la connexion') ||
    message.includes('moz-extension://') ||
    message.includes('safari-extension://') ||
    fullMessage.includes('MetaMask') ||
    fullMessage.includes('chrome-extension://')
  ) {
    return; // Ne rien afficher
  }
  
  // Appeler la fonction originale pour les autres erreurs
  originalConsoleError.apply(console, args);
};

// Également filtrer les warnings
console.warn = (...args) => {
  const message = String(args[0] || '');
  
  if (
    message.includes('MetaMask') ||
    message.includes('chrome-extension://') ||
    message.includes('Failed to connect')
  ) {
    return; // Ne rien afficher
  }
  
  originalConsoleWarn.apply(console, args);
};

// Désactiver l'overlay d'erreur React pour les erreurs d'extension
if (process.env.NODE_ENV === 'development') {
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay, ...args) {
    // Intercepter les erreurs avant qu'elles n'atteignent l'overlay
    const wrappedCallback = function() {
      try {
        return callback.apply(this, arguments);
      } catch (error) {
        const isExtensionError = 
          error?.message?.includes('MetaMask') ||
          error?.message?.includes('Failed to connect') ||
          error?.message?.includes('Échec de la connexion') ||
          error?.stack?.includes('chrome-extension://');
        
        if (isExtensionError) {
          console.warn('Erreur d\'extension interceptée avant overlay:', error.message);
          return; // Ne pas propager
        }
        throw error; // Propager les autres erreurs
      }
    };
    return originalSetTimeout.call(this, wrappedCallback, delay, ...args);
  };
}

// Gestionnaire d'erreurs global pour filtrer les erreurs d'extensions tierces (MetaMask, etc.)
window.addEventListener('error', (event) => {
  // Ignorer les erreurs provenant d'extensions Chrome
  if (event.filename && (
    event.filename.includes('chrome-extension://') ||
    event.filename.includes('moz-extension://') ||
    event.filename.includes('safari-extension://')
  )) {
    console.warn('Erreur d\'extension de navigateur ignorée:', event.message);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
  
  // Ignorer spécifiquement les erreurs MetaMask
  if (event.message && (
    event.message.includes('MetaMask') ||
    event.message.includes('Failed to connect')
  )) {
    console.warn('Erreur MetaMask ignorée');
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true); // Utiliser la phase de capture

// Gestionnaire pour les promesses non gérées
window.addEventListener('unhandledrejection', (event) => {
  // Vérifier si c'est une erreur d'extension
  const isExtensionError = 
    (event.reason && event.reason.message && (
      event.reason.message.includes('MetaMask') ||
      event.reason.message.includes('chrome-extension') ||
      event.reason.message.includes('Failed to connect')
    )) ||
    (event.reason && typeof event.reason === 'string' && (
      event.reason.includes('MetaMask') ||
      event.reason.includes('chrome-extension')
    ));
  
  if (isExtensionError) {
    console.warn('Erreur d\'extension ignorée:', event.reason);
    event.preventDefault();
    return;
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
