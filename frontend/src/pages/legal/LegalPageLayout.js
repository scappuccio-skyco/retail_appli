import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../../components/shared/Logo';

/**
 * Layout commun pour les pages légales (Mentions, CGU, Confidentialité).
 * Fournit : header, conteneur, titre, sous-titre, zone de contenu et footer de liens.
 */
export default function LegalPageLayout({
  title,
  subtitle,
  icon: Icon = null,
  children,
}) {
  useEffect(() => {
    globalThis.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo variant="header" size="sm" />
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-600 hover:text-[#1E40AF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <div className="text-center mb-12">
            {Icon && (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1E40AF]/10 rounded-full mb-4">
                <Icon className="w-8 h-8 text-[#1E40AF]" />
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-[#1E40AF] mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-500">{subtitle}</p>
            )}
          </div>

          <div className="space-y-10 text-gray-700 leading-relaxed">
            {children}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/legal" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Mentions Légales
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Conditions Générales
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/privacy" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Politique de Confidentialité
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/" className="text-gray-500 hover:text-[#1E40AF] transition-colors">
              Accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
