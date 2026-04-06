import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../../components/shared/Logo';

export default function BlogLayout({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/">
              <Logo variant="header" size="sm" showByline={false} />
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-[#F97316] border-2 border-[#F97316] rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium"
              >
                Connexion
              </button>
              <button
                onClick={() => navigate('/early-access')}
                className="px-4 py-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-lg hover:shadow-md transition-all text-sm font-medium"
              >
                Essai gratuit
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#334155] text-white py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <Logo variant="footer" size="xs" showByline={false} />
          <div className="flex gap-6 text-sm text-slate-400">
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <Link to="/legal" className="hover:text-white transition-colors">Mentions légales</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
          </div>
          <p className="text-xs text-slate-500">© 2025 Retail Performer AI by SKY CO</p>
        </div>
      </footer>
    </div>
  );
}
