import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../../components/shared/Logo';

export default function HeaderSection({ mobileMenuOpen, setMobileMenuOpen, scrollToSection }) {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-[60px] sm:top-[52px] w-full bg-white/5 backdrop-blur-md z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 sm:h-24">
          {/* Logo rond + texte */}
          <Logo variant="header" size="md" />

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features')} className="text-white/90 hover:text-[#F97316] transition-colors font-medium">
              Fonctionnalités
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-white/90 hover:text-[#F97316] transition-colors font-medium">
              Tarifs
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-white/90 hover:text-[#F97316] transition-colors font-medium">
              FAQ
            </button>
            <button onClick={() => scrollToSection('contact')} className="text-white/90 hover:text-[#F97316] transition-colors font-medium">
              Contact
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-white border border-white/40 rounded-lg hover:bg-white/15 transition-colors font-medium"
            >
              Connexion
            </button>
            <button
              onClick={() => navigate('/early-access')}
              className="px-6 py-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Essai Gratuit
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3">
            <button onClick={() => scrollToSection('features')} className="block w-full text-left px-4 py-2 text-[#334155] hover:bg-blue-50 rounded-lg">
              Fonctionnalités
            </button>
            <button onClick={() => scrollToSection('pricing')} className="block w-full text-left px-4 py-2 text-[#334155] hover:bg-blue-50 rounded-lg">
              Tarifs
            </button>
            <button onClick={() => scrollToSection('faq')} className="block w-full text-left px-4 py-2 text-[#334155] hover:bg-blue-50 rounded-lg">
              FAQ
            </button>
            <button onClick={() => scrollToSection('contact')} className="block w-full text-left px-4 py-2 text-[#334155] hover:bg-blue-50 rounded-lg">
              Contact
            </button>
            <button onClick={() => navigate('/login')} className="block w-full text-left px-4 py-2 text-[#F97316] font-medium">
              Connexion
            </button>
            <button onClick={() => navigate('/early-access')} className="block w-full px-4 py-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-lg font-medium">
              Essai Gratuit
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
