import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../../components/shared/Logo';

export default function FooterSection({ scrollToSection }) {
  const navigate = useNavigate();

  return (
    <footer className="bg-[#334155] text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Company - Logo rond + texte */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="mb-4">
              <Logo variant="footer" size="sm" />
            </div>
            <p className="text-[#94A3B8] text-xs sm:text-sm">
              La plateforme de coaching intelligente pour les équipes retail
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold mb-4 text-[#F97316]">Produit</h4>
            <ul className="space-y-2 text-sm text-[#64748B]">
              <li><button onClick={() => scrollToSection('features')} className="hover:text-[#EA580C] transition-colors">Fonctionnalités</button></li>
              <li><button onClick={() => scrollToSection('pricing')} className="hover:text-[#EA580C] transition-colors">Tarifs</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-[#EA580C] transition-colors">Se connecter</button></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold mb-4 text-[#F97316]">Support</h4>
            <ul className="space-y-2 text-sm text-[#64748B]">
              <li><button onClick={() => scrollToSection('faq')} className="hover:text-[#EA580C] transition-colors">FAQ</button></li>
              <li><button onClick={() => scrollToSection('contact')} className="hover:text-[#EA580C] transition-colors">Contact</button></li>
              <li><a href="mailto:hello@retailperformerai.com" className="hover:text-[#EA580C] transition-colors">Email</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4 text-[#F97316]">Légal</h4>
            <ul className="space-y-2 text-sm text-[#94A3B8]">
              <li><Link to="/legal" className="hover:text-white transition-colors">Mentions légales</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Confidentialité</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">CGU/CGV</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8 text-center text-sm text-slate-500">
          <p>© 2025 Retail Performer AI by SKY CO. Tous droits réservés.</p>
          <p className="mt-2">25 allée Rose Dieng-Kuntz, 75019 Paris, France</p>
          <p className="mt-2 text-xs text-slate-600">
            <Link to="/legal" className="hover:text-slate-400 transition-colors">Mentions légales</Link>
            {' • '}
            <Link to="/terms" className="hover:text-slate-400 transition-colors">CGU</Link>
            {' • '}
            <Link to="/privacy" className="hover:text-slate-400 transition-colors">Confidentialité</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
