import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Surcharger console.error pour filtrer les erreurs d'extension
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  
  // Ignorer les erreurs d'extensions
  if (
    message.includes('MetaMask') ||
    message.includes('chrome-extension://') ||
    message.includes('Failed to connect') ||
    message.includes('moz-extension://') ||
    message.includes('safari-extension://')
  ) {
    return; // Ne rien afficher
  }
  
  // Appeler la fonction originale pour les autres erreurs
  originalConsoleError.apply(console, args);
};

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
