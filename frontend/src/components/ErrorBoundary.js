import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error);
    console.error('Error info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fffef9] to-[#fff9e6]">
          <div className="glass-morphism rounded-3xl shadow-2xl p-8 max-w-2xl w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Une erreur est survenue</h2>
              <p className="text-gray-600 mb-4">
                Le formulaire a rencontré un problème.
              </p>
              
              {/* Show error details in development */}
              {this.state.error && (
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
                  Rafraîchir la page
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
