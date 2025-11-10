import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Zap, Users, TrendingUp, Target, Star, ChevronDown, Menu, X } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/logo-retail-performer.png" alt="Retail Performer AI" className="h-12 w-auto" />
              <span className="text-xl font-bold text-[#1E40AF]">
                Retail Performer AI
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('features')} className="text-[#334155] hover:text-[#F97316] transition-colors font-medium">
                Fonctionnalités
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-[#334155] hover:text-[#F97316] transition-colors font-medium">
                Tarifs
              </button>
              <button onClick={() => scrollToSection('faq')} className="text-[#334155] hover:text-[#F97316] transition-colors font-medium">
                FAQ
              </button>
              <button onClick={() => scrollToSection('contact')} className="text-[#334155] hover:text-[#F97316] transition-colors font-medium">
                Contact
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-[#F97316] border-2 border-[#F97316] rounded-lg hover:bg-orange-50 transition-colors font-medium"
              >
                Connexion
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
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
              <button onClick={() => scrollToSection('pricing')} className="block w-full px-4 py-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-lg font-medium">
                Essai Gratuit
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-6 border-2 border-[#1E40AF]/20">
                <Zap className="w-4 h-4 text-[#F97316]" />
                <span className="text-sm font-semibold text-[#1E40AF]">Propulsé par l'Intelligence Artificielle</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-[#334155] leading-tight mb-6">
                Transformez Vos Vendeurs en{' '}
                <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                  Experts
                </span>
              </h1>
              
              <p className="text-xl text-[#334155] mb-8 leading-relaxed">
                La première plateforme de coaching pour le retail, qui transforme vos vendeurs en experts autonomes.<br />
                Analyse des compétences, coaching personnalisé et progression continue, grâce à l'intelligence artificielle.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-lg font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                >
                  Essai Gratuit 14 Jours
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="px-8 py-4 bg-white text-[#1E40AF] text-lg font-semibold rounded-xl border-2 border-[#1E40AF] hover:bg-blue-50 transition-all"
                >
                  Demander une Démo
                </button>
              </div>

              <div className="flex items-center gap-6 text-sm text-[#334155]">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#10B981]" />
                  <span>Sans carte bancaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#10B981]" />
                  <span>Résiliation à tout moment</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white max-h-[500px]">
                <img 
                  src="https://images.pexels.com/photos/5486132/pexels-photo-5486132.jpeg" 
                  alt="Équipe retail en réunion"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6 border-2 border-[#1E40AF]/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1E40AF]">+47%</p>
                    <p className="text-sm text-[#334155]">Performance moyenne</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Le Défi des Managers Retail
            </h2>
            <p className="text-xl text-[#334155] max-w-3xl mx-auto">
              Former, motiver et suivre vos vendeurs demande du temps et des outils adaptés. 
              Retail Performer AI simplifie tout.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Problem */}
            <div className="bg-gray-100 rounded-2xl p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-[#334155] mb-6">Sans Retail Performer AI</h3>
              <ul className="space-y-4">
                {[
                  'Suivi manuel des performances sur Excel',
                  'Difficile d\'identifier les axes d\'amélioration',
                  'Coaching générique et peu personnalisé',
                  'Pas de vue d\'ensemble sur l\'équipe',
                  'Démotivation et turnover élevé'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <X className="w-6 h-6 text-[#64748B] flex-shrink-0 mt-0.5" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution */}
            <div className="bg-gradient-to-br from-[#1E40AF]/10 to-[#1E40AF]/20 rounded-2xl p-8 border-2 border-[#1E40AF]">
              <h3 className="text-2xl font-bold text-[#1E40AF] mb-6">Avec Retail Performer AI</h3>
              <ul className="space-y-4">
                {[
                  'Dashboard automatisé en temps réel',
                  'IA qui identifie points forts et faiblesses',
                  'Coaching personnalisé pour chaque vendeur',
                  'Vue 360° de la performance d\'équipe',
                  'Gamification et motivation renforcée'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Une Plateforme Complète et Intelligente
            </h2>
            <p className="text-xl text-[#334155] max-w-3xl mx-auto">
              Tout ce dont vous avez besoin pour développer l'excellence de vos équipes commerciales
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Users className="w-8 h-8" />,
                color: 'from-[#1E40AF] to-[#1E3A8A]',
                title: 'Diagnostic DISC',
                description: 'Profil de personnalité complet pour chaque vendeur avec analyse détaillée'
              },
              {
                icon: <TrendingUp className="w-8 h-8" />,
                color: 'from-[#F97316] to-[#EA580C]',
                title: 'Dashboard Manager',
                description: 'KPI en temps réel, comparaisons vendeurs et analyses prédictives'
              },
              {
                icon: <Zap className="w-8 h-8" />,
                color: 'from-[#1E40AF] to-[#1E3A8A]',
                title: 'Coaching IA',
                description: 'Recommandations personnalisées et plans d\'action sur-mesure'
              },
              {
                icon: <Target className="w-8 h-8" />,
                color: 'from-[#10B981] to-[#00B886]',
                title: 'Challenges & Gamification',
                description: 'Objectifs motivants et système de niveaux pour engager vos équipes'
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]/20 hover:border-[#F97316]">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-white mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-[#334155] mb-3">{feature.title}</h3>
                <p className="text-[#334155]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Une Interface Moderne et Intuitive
            </h2>
            <p className="text-xl text-[#334155]">
              Découvrez la puissance de Retail Performer AI
            </p>
          </div>

          <div className="space-y-12">
            {/* Screenshot 1 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold text-[#334155] mb-4">Dashboard Manager</h3>
                <p className="text-lg text-[#334155] mb-6">
                  Visualisez la performance de votre équipe en un coup d'œil. 
                  KPI, comparaisons, graphiques et alertes intelligentes.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Suivi CA, ventes, panier moyen',
                    'Comparaisons entre vendeurs',
                    'Graphiques d\'évolution',
                    'Export PDF des rapports'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#F97316]" />
                      <span className="text-[#334155]">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-gradient-to-r from-[#F97316]/10 to-[#EA580C]/5 border-l-4 border-[#F97316] p-4 rounded-r-lg">
                  <p className="text-sm font-semibold text-[#F97316] mb-2">🤝 Gestion de Conflit Manager-Vendeur</p>
                  <p className="text-sm text-[#334155]">
                    Gérez les situations délicates avec des recommandations IA basées sur les profils DISC, les performances et l'historique de chaque vendeur.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1E40AF]/20">
                <img 
                  src="/dashboard-manager.png" 
                  alt="Dashboard Manager - Vue d'ensemble KPI"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Screenshot 2 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="md:order-2">
                <h3 className="text-3xl font-bold text-[#334155] mb-4">Dashboard Vendeur</h3>
                <p className="text-lg text-[#334155] mb-6">
                  Interface personnalisée pour chaque vendeur avec coach IA, défis quotidiens et suivi de performance.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Coach IA personnalisé',
                    'Défis quotidiens motivants',
                    'Suivi de ses propres KPI',
                    'Radar de compétences et progression'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#F97316]" />
                      <span className="text-[#334155]">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-gradient-to-r from-[#1E40AF]/10 to-[#1E40AF]/5 border-l-4 border-[#1E40AF] p-4 rounded-r-lg">
                  <p className="text-sm font-semibold text-[#1E40AF] mb-2">💡 Débriefs de Vente Intelligents</p>
                  <p className="text-sm text-[#334155]">
                    Après chaque vente non conclue, débrief en quelques clics. L'IA analyse la situation et génère des recommandations personnalisées instantanées.
                  </p>
                </div>
              </div>
              <div className="md:order-1 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1E40AF]/20">
                <img 
                  src="/dashboard-vendeur.png" 
                  alt="Dashboard Vendeur - Mon Bilan Individuel"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Tarifs Simples et Transparents
            </h2>
            <p className="text-xl text-[#334155] mb-4">
              Choisissez la formule qui correspond à votre équipe
            </p>
            
            {/* Toggle Mensuel/Annuel */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className={`text-lg font-semibold ${!isAnnual ? 'text-[#334155]' : 'text-slate-400'}`}>
                Mensuel
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
                  isAnnual ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    isAnnual ? 'transform translate-x-8' : ''
                  }`}
                />
              </button>
              <span className={`text-lg font-semibold ${isAnnual ? 'text-[#334155]' : 'text-slate-400'}`}>
                Annuel
              </span>
              {isAnnual && (
                <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                  Économisez 20%
                </span>
              )}
            </div>

            <div className="inline-flex items-center gap-3 bg-orange-50 border-2 border-[#F97316] rounded-full px-6 py-3">
              <Users className="w-5 h-5 text-[#EA580C]" />
              <p className="text-sm font-semibold text-[#334155]">
                Toutes les formules incluent : Espace Manager complet + Accès vendeurs illimités
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-slate-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#334155] mb-2">Starter</h3>
                <p className="text-[#334155] mb-4">Pour petites boutiques</p>
                {!isAnnual ? (
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-[#334155]">29€</span>
                    <span className="text-[#334155]">/vendeur/mois</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-[#334155]">278€</span>
                      <span className="text-[#334155]">/vendeur/an</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      Au lieu de 348€ • Économisez 70€/an
                    </p>
                  </div>
                )}
                <p className="text-sm text-slate-500 mt-2">1 à 5 vendeurs</p>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Accès Manager + Vendeurs',
                  'Dashboard manager complet',
                  'Diagnostic DISC par vendeur',
                  'Suivi KPI en temps réel',
                  'Objectifs individuels',
                  'Support email'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#F97316] flex-shrink-0" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => scrollToSection('contact')}
                className="w-full py-3 bg-slate-100 text-[#334155] font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Essai Gratuit 14 Jours
              </button>
            </div>

            {/* Professional - RECOMMENDED */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl border-4 border-[#F97316] relative transform md:scale-105">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  RECOMMANDÉ
                </div>
              </div>

              <div className="text-center mb-6 pt-4">
                <h3 className="text-2xl font-bold text-[#334155] mb-2">Professional</h3>
                <p className="text-[#334155] mb-4">Pour magasins moyens</p>
                {!isAnnual ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">249€</span>
                      <span className="text-[#334155]">/mois</span>
                    </div>
                    <p className="text-sm text-[#EA580C] font-semibold mt-2">Jusqu'à 15 vendeurs inclus</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">2 390€</span>
                      <span className="text-[#334155]">/an</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      Au lieu de 2 988€ • Économisez 598€/an
                    </p>
                    <p className="text-xs text-[#EA580C] font-semibold mt-1">Jusqu'à 15 vendeurs inclus</p>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Tout Starter +',
                  'Vue équipe avec graphiques',
                  'Coaching IA personnalisé',
                  'Challenges & gamification',
                  'Analyses comparatives vendeurs',
                  'Historique 365 jours',
                  'Support prioritaire + onboarding'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#F97316] flex-shrink-0" />
                    <span className="text-[#334155] font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => scrollToSection('contact')}
                className="w-full py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Essai Gratuit 14 Jours
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]/30">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#334155] mb-2">Enterprise</h3>
                <p className="text-[#334155] mb-4">Pour réseaux & enseignes</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-[#334155]">Sur devis</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">16+ vendeurs</p>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Tout Professional +',
                  'Dashboard réseau consolidé',
                  'Multi-magasins illimité',
                  'API & intégrations',
                  'Account manager dédié',
                  'Formation équipe management',
                  'SLA personnalisés'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-blue-700 flex-shrink-0" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => scrollToSection('contact')}
                className="w-full py-3 bg-[#1E40AF]/10 text-[#334155] font-semibold rounded-xl hover:bg-blue-200 transition-colors"
              >
                Nous Contacter
              </button>
            </div>
          </div>

          {/* Pricing Footer */}
          <div className="text-center mt-12">
            {isAnnual && (
              <div className="inline-block mb-6 px-6 py-3 bg-green-50 border-2 border-green-200 rounded-xl">
                <p className="text-green-800 font-bold text-lg">
                  🎉 Vous économisez jusqu'à 20% avec le paiement annuel !
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 text-sm text-[#334155] flex-wrap">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#F97316]" />
                <span>14 jours d'essai gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#F97316]" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#F97316]" />
                <span>Résiliation à tout moment</span>
              </div>
              {isAnnual && (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#F97316]" />
                  <span className="font-semibold">Facturation annuelle</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Questions Fréquentes
            </h2>
            <p className="text-xl text-[#334155]">
              Tout ce que vous devez savoir sur Retail Performer AI
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "Comment fonctionne l'essai gratuit de 14 jours ?",
                answer: "Aucune carte bancaire requise. Vous testez toutes les fonctionnalités pendant 14 jours. À la fin de l'essai, vous choisissez votre formule ou arrêtez simplement."
              },
              {
                question: "Puis-je changer de formule à tout moment ?",
                answer: "Oui, absolument. Vous pouvez passer d'une formule à l'autre à tout moment selon l'évolution de votre équipe. Le changement est instantané."
              },
              {
                question: "Comment l'IA analyse-t-elle les performances ?",
                answer: "Notre IA analyse vos KPI (CA, ventes, panier moyen), les compare aux objectifs et à l'équipe, puis génère des recommandations personnalisées pour chaque vendeur."
              },
              {
                question: "Mes données sont-elles sécurisées ?",
                answer: "Oui, toutes vos données sont hébergées en France, chiffrées et conformes au RGPD. Nous ne partageons jamais vos données avec des tiers."
              },
              {
                question: "Faut-il installer un logiciel ?",
                answer: "Non, Retail Performer AI est 100% web. Accessible depuis n'importe quel navigateur, sur ordinateur, tablette ou smartphone."
              },
              {
                question: "Proposez-vous une formation ?",
                answer: "Oui, nous offrons un onboarding personnalisé pour tous les plans Professional et Enterprise. Des tutoriels vidéo sont également disponibles."
              }
            ].map((faq, idx) => (
              <div key={idx} className="bg-blue-50 rounded-xl border-2 border-[#1E40AF]/20 overflow-hidden hover:border-[#F97316] transition-colors">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#1E40AF]/10 transition-colors"
                >
                  <span className="font-semibold text-[#334155]">{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-[#F97316] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-[#334155]">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-900 to-blue-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à Transformer Votre Équipe ?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Rejoignez les managers qui font déjà confiance à Retail Performer AI
          </p>
          <button
            onClick={() => scrollToSection('contact')}
            className="px-8 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-lg font-semibold rounded-xl hover:shadow-2xl transition-all inline-flex items-center gap-2"
          >
            Commencer l'Essai Gratuit
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-blue-100 text-sm mt-4">
            14 jours gratuits • Sans carte bancaire • Résiliation à tout moment
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#334155] mb-4">
              Contactez-Nous
            </h2>
            <p className="text-xl text-[#334155]">
              Une question ? Notre équipe vous répond en moins de 24h
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-blue-50 rounded-2xl p-8 border-2 border-[#1E40AF]/20">
              <h3 className="text-2xl font-bold text-[#334155] mb-6">Demander une Démo</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">Nom complet</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border-2 border-[#1E40AF]/30 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-[#F97316] bg-white"
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">Email professionnel</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 border-2 border-[#1E40AF]/30 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-[#F97316] bg-white"
                    placeholder="jean@entreprise.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">Nombre de vendeurs</label>
                  <select className="w-full px-4 py-3 border-2 border-[#1E40AF]/30 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-[#F97316] bg-white">
                    <option>1-5 vendeurs</option>
                    <option>6-15 vendeurs</option>
                    <option>16+ vendeurs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">Message</label>
                  <textarea 
                    rows="4" 
                    className="w-full px-4 py-3 border-2 border-[#1E40AF]/30 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-[#F97316] bg-white"
                    placeholder="Parlez-nous de votre besoin..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  Envoyer la Demande
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 border-2 border-[#F97316]">
                <h3 className="text-xl font-bold text-[#334155] mb-4">Informations de Contact</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[#334155] mb-1">Email</p>
                    <a href="mailto:contact@retailperformerai.com" className="text-[#EA580C] font-semibold hover:underline">
                      contact@retailperformerai.com
                    </a>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#334155] mb-1">Adresse</p>
                    <p className="text-slate-800">
                      25 allée Rose Dieng-Kuntz<br />
                      75019 Paris, France
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-8 border-2 border-[#1E40AF]/30">
                <h3 className="text-xl font-bold text-[#334155] mb-4">Horaires</h3>
                <p className="text-slate-800">
                  Lundi - Vendredi : 9h - 18h<br />
                  Samedi - Dimanche : Fermé
                </p>
                <p className="text-sm text-[#334155] mt-4">
                  Réponse sous 24h ouvrées
                </p>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80" 
                  alt="Service client professionnel et accueillant"
                  className="w-full h-48 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#334155] text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Company */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo-retail-performer.png" alt="Retail Performer AI" className="h-10 w-auto" />
                <span className="text-xl font-bold">Retail Performer AI</span>
              </div>
              <p className="text-[#64748B] text-sm">
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
                <li><a href="mailto:contact@retailperformerai.com" className="hover:text-[#EA580C] transition-colors">Email</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold mb-4 text-[#F97316]">Légal</h4>
              <ul className="space-y-2 text-sm text-[#64748B]">
                <li><a href="#" className="hover:text-[#EA580C] transition-colors">Mentions légales</a></li>
                <li><a href="#" className="hover:text-[#EA580C] transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-[#EA580C] transition-colors">CGU</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-8 text-center text-sm text-slate-500">
            <p>© 2025 Retail Performer AI. Tous droits réservés.</p>
            <p className="mt-2">25 allée Rose Dieng-Kuntz, 75019 Paris, France</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
