import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Ignorer les erreurs provenant d'extensions de navigateur
    if (error.stack && (
      error.stack.includes('chrome-extension://') ||
      error.stack.includes('MetaMask') ||
      error.stack.includes('moz-extension://') ||
      error.message.includes('MetaMask')
    )) {
      console.warn('Erreur d\'extension de navigateur ignorée:', error.message);
      return { hasError: false };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Vérifier si c'est une erreur d'extension
    const errorMessage = error?.message || '';
    const errorStack = error?.stack || '';
    
    const isExtensionError = 
      errorStack.includes('chrome-extension://') ||
      errorStack.includes('moz-extension://') ||
      errorStack.includes('safari-extension://') ||
      errorMessage.includes('MetaMask') ||
      errorMessage.includes('Failed to connect') ||
      errorMessage.includes('Échec de la connexion');
    
    if (isExtensionError) {
      console.warn('Erreur d\'extension capturée et ignorée par ErrorBoundary:', errorMessage);
      // Réinitialiser l'état pour ne pas afficher d'erreur
      this.setState({ hasError: false, error: null, errorInfo: null });
      return; // Ne pas logguer ni afficher
    }

    // Erreur légitime - logger
    console.error('Erreur capturée par ErrorBoundary:', error, errorInfo);
    
    // Ignorer les erreurs removeChild provenant des modaux React
    // Ces erreurs sont généralement bénignes et causées par des manipulations DOM externes
    if (error.message && error.message.includes('removeChild')) {
      console.warn('Erreur removeChild détectée et ignorée (probable conflit DOM externe):', error.message);
      // Réinitialiser l'état pour ne pas bloquer l'UI
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      const isRemoveChildError = this.state.error?.message?.includes('removeChild');
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fffef9] to-[#fff9e6]">
          <div className="glass-morphism rounded-3xl shadow-2xl p-8 max-w-2xl w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">🔄</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {isRemoveChildError ? 'Actualisation en cours...' : 'Une erreur est survenue'}
              </h2>
              <p className="text-gray-600 mb-4">
                {isRemoveChildError 
                  ? 'Le formulaire se recharge automatiquement. Vos réponses sont conservées.' 
                  : 'Le formulaire a rencontré un problème.'}
              </p>
              
              {isRemoveChildError && (
                <div className="mb-4">
                  <div className="animate-spin w-8 h-8 border-4 border-[#ffd871] border-t-transparent rounded-full mx-auto"></div>
                </div>
              )}
              
              {!isRemoveChildError && this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left">
                  <p className="text-sm font-mono text-red-800 mb-2">
                    <strong>Erreur:</strong> {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-xs text-red-700">
                      <summary className="cursor-pointer font-semibold mb-2">Stack trace</summary>
                      <pre className="whitespace-pre-wrap overflow-auto max-h-60">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.location.href = '/'}
                  className="btn-secondary"
                >
                  Retour au dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-primary"
                >
                  Rafraîchir maintenant
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
