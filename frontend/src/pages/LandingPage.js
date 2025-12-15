import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Check, Zap, Users, TrendingUp, Target, ChevronDown, Menu, X, Briefcase, Star, FileText, Shield, Building2, BarChart3, Settings, Calendar } from 'lucide-react';
import Logo from '../components/shared/Logo';

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

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
          <div className="flex justify-between items-center h-20 sm:h-24">
            {/* Logo rond + texte */}
            <Logo variant="header" size="md" />

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
                onClick={() => navigate('/login?register=true')}
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
              <button onClick={() => navigate('/login?register=true')} className="block w-full px-4 py-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-lg font-medium">
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
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-full shadow-sm mb-4 sm:mb-6 border-2 border-[#1E40AF]/20">
                <Zap className="w-4 h-4 text-[#F97316]" />
                <span className="text-xs sm:text-sm font-semibold text-[#1E40AF]">Propulsé par l'Intelligence Artificielle</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 sm:mb-6">
                <span className="text-[#1E40AF]">Transformez Vos Vendeurs en</span>{' '}
                <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                  Experts
                </span>
              </h1>
              
              {/* Sous-titre avec preuve - Taille réduite */}
              <p className="text-base sm:text-lg font-semibold text-[#F97316] mb-3 sm:mb-4 leading-relaxed">
                Objectif : Boostez vos ventes jusqu'à +30%
              </p>
              
              <p className="text-sm sm:text-base text-[#334155] mb-6 sm:mb-8 leading-relaxed">
                L'Assistant Intelligent qui coache vos vendeurs et rédige vos bilans RH, tout en sécurisant votre management.
                <span className="hidden sm:inline"><br />Analyse des compétences, coaching personnalisé et progression continue, grâce à l'intelligence artificielle.</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
                <button
                  onClick={() => navigate('/login?register=true')}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-base sm:text-lg font-semibold rounded-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                >
                  Essai Gratuit 14 Jours
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-[#1E40AF] text-base sm:text-lg font-semibold rounded-xl border-2 border-[#1E40AF] hover:bg-blue-50 transition-all"
                >
                  Demander une Démo
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#334155]">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" />
                  <span>Sans carte bancaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" />
                  <span>Résiliation à tout moment</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white max-h-[500px]">
                <img 
                  src="/hero-retail-boutique.png" 
                  alt="Vendeuse professionnelle en boutique moderne"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6 border-2 border-[#1E40AF]/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1E40AF]">+30%</p>
                    <p className="text-sm text-[#334155]">Objectif ventes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section - Preuve d'Expertise */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-50 to-slate-50 border-y border-[#1E40AF]/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <p className="text-lg sm:text-xl font-semibold text-[#334155] mb-8">
              Une solution conçue par des Managers Retail, pour des Managers Retail
            </p>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
              {/* Carte 1 - L'Expertise */}
              <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
                <div className="flex items-center justify-center w-12 h-12 bg-[#1E40AF]/10 rounded-full mb-4 mx-auto">
                  <Briefcase className="w-6 h-6 text-[#1E40AF]" />
                </div>
                <h3 className="text-lg font-bold text-[#1E40AF] mb-3">ADN 100% Retail</h3>
                <p className="text-[#334155] text-sm leading-relaxed">
                  Pas de théorie, que du terrain. Outil conçu par des Experts de la Vente et du Management cumulant plus de 20 ans d'expérience opérationnelle.
                </p>
                <p className="text-xs text-[#64748B] mt-4 font-medium">L'Équipe Fondatrice</p>
              </div>

              {/* Carte 2 - La Méthode */}
              <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
                <div className="flex items-center justify-center w-12 h-12 bg-[#F97316]/10 rounded-full mb-4 mx-auto">
                  <TrendingUp className="w-6 h-6 text-[#F97316]" />
                </div>
                <h3 className="text-lg font-bold text-[#1E40AF] mb-3">Méthodologie Éprouvée</h3>
                <p className="text-[#334155] text-sm leading-relaxed">
                  Basé sur les piliers de l'excellence Retail : Cérémonial de Vente, Vente Complémentaire et Coaching Situationnel.
                </p>
                <p className="text-xs text-[#64748B] mt-4 font-medium">Best Practices Retail</p>
              </div>

              {/* Carte 3 - L'Innovation */}
              <div className="bg-white rounded-xl p-6 shadow-md border-2 border-[#1E40AF]/20 hover:border-[#F97316] transition-colors">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-[#1E40AF] mb-3">Une Suite Complète</h3>
                <p className="text-[#334155] text-sm leading-relaxed">
                  Coaching IA, Analyse des Ventes, Préparation des Évaluations, Suivi des Objectifs & Challenges et Analyse d'Équipe. Tout ce qu'il faut pour piloter la performance.
                </p>
                <p className="text-xs text-[#64748B] mt-4 font-medium">Fonctionnalités Clés</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Accroche Marketing - Bannière Stratégie */}
          <div className="text-center mb-12 bg-gradient-to-r from-[#1E40AF]/10 via-[#F97316]/10 to-[#1E40AF]/10 rounded-2xl p-8 border-2 border-[#F97316]/30">
            <h2 className="text-3xl md:text-4xl font-bold text-[#334155] mb-6 max-w-4xl mx-auto leading-relaxed">
              Vous avez déjà les <strong className="text-[#1E40AF]">chiffres</strong>. Retail Performer AI vous donne la <strong className="text-[#F97316]">stratégie</strong>.
            </h2>
            <p className="text-xl md:text-2xl text-[#64748B] max-w-3xl mx-auto">
              Ne perdez plus de temps à interpréter des tableaux complexes. Notre IA analyse vos KPI en temps réel et génère les plans d&apos;action pour vos équipes.
            </p>
          </div>

          {/* Titre section */}
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
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
              <h3 className="text-2xl font-bold text-[#1E40AF] mb-6">Sans Retail Performer AI</h3>
              <ul className="space-y-4">
                {[
                  'Suivi manuel des performances sur Excel',
                  'Difficile d\'identifier les axes d\'amélioration',
                  'Coaching générique et peu personnalisé',
                  'Pas de vue d\'ensemble sur l\'équipe',
                  'Démotivation et turnover élevé'
                ].map((item, idx) => (
                  <li key={`problem-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-3">
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
                  'Coaching personnalisé adapté au profil DISC',
                  'Vue 360° de la performance d\'équipe',
                  'Sécurité Juridique : Une IA formée pour respecter les bonnes pratiques RH',
                  'Gain de temps Admin : Vos reportings et bilans rédigés en 10 secondes'
                ].map((item, idx) => (
                  <li key={`solution-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-3">
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
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
              Une Plateforme Complète et Intelligente
            </h2>
            <p className="text-xl text-[#334155] max-w-3xl mx-auto">
              Tout ce dont vous avez besoin pour développer l&apos;excellence de vos équipes commerciales
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Users className="w-8 h-8" />,
                color: 'from-[#1E40AF] to-[#1E3A8A]',
                title: 'Intelligence Comportementale (DISC)',
                description: "Ne parlez pas de la même façon à tous vos vendeurs. L'IA identifie le profil de chacun (Rouge, Jaune, Vert, Bleu) et vous dicte les mots exacts pour les motiver et les faire performer.",
                impact: 'Pour un management 100% personnalisé.'
              },
              {
                icon: <TrendingUp className="w-8 h-8" />,
                color: 'from-[#F97316] to-[#EA580C]',
                title: 'Briefs & Rituels d\'Animation',
                description: "Transformez vos KPI en discours mobilisateurs. Chaque matin, générez en 2 secondes le brief parfait : flash-back sur la veille, objectifs du jour et booster de motivation.",
                impact: 'Pour lancer la journée sur une victoire.'
              },
              {
                icon: <FileText className="w-8 h-8" />,
                color: 'from-[#8B5CF6] to-[#7C3AED]',
                title: 'Montée en Compétence',
                description: "L'évaluation n'est plus une corvée annuelle. Suivez la progression de vos équipes semaine après semaine, détectez les besoins de formation et validez les acquis en temps réel.",
                impact: 'Pour transformer vos vendeurs en experts.'
              },
              {
                icon: <Shield className="w-8 h-8" />,
                color: 'from-[#10B981] to-[#00B886]',
                title: 'Sérénité Managériale',
                description: "Soyez sûr de vos écrits. Qu'il s'agisse de recadrer, de féliciter ou d'évaluer, l'IA garantit un ton professionnel, constructif et toujours conforme aux bonnes pratiques RH.",
                impact: 'Pour manager avec assurance et sécurité.'
              }
            ].map((feature, idx) => (
              <div key={`feature-${idx}-${feature.title}`} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-[#1E40AF]/20 hover:border-[#F97316]">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-white mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-[#1E40AF] mb-3">{feature.title}</h3>
                <p className="text-[#334155] mb-3">{feature.description}</p>
                <p className="text-sm font-semibold text-[#F97316] italic">{feature.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
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
                <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Manager</h3>
                <p className="text-lg text-[#334155] mb-6">
                  Visualisez la performance de votre équipe en un coup d'œil. 
                  KPI, comparaisons, graphiques et alertes intelligentes.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Repérez un vendeur en difficulté avant que les KPI chutent',
                    'Comparez vos équipes en un clic',
                    'Recevez des alertes intelligentes sur les performances',
                    'Exportez vos rapports pour votre hiérarchie'
                  ].map((item, idx) => (
                    <li key={`manager-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
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
                  src="https://customer-assets.emergentagent.com/job_data-entry-flow/artifacts/5z9e54uo_image.png" 
                  alt="Dashboard Manager - Vue d'ensemble KPI"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Screenshot 2 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="md:order-2">
                <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Vendeur</h3>
                <p className="text-lg text-[#334155] mb-6">
                  Interface personnalisée pour chaque vendeur avec coach IA, défis quotidiens et suivi de performance.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Objectifs clairs chaque jour',
                    'Conseils personnalisés par l\'IA en temps réel',
                    'Analyse de progression semaine après semaine',
                    'Visualisation des compétences à développer'
                  ].map((item, idx) => (
                    <li key={`seller-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
                      <span className="text-[#334155]">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-gradient-to-r from-[#1E40AF]/10 to-[#1E40AF]/5 border-l-4 border-[#1E40AF] p-4 rounded-r-lg">
                  <p className="text-sm font-semibold text-[#1E40AF] mb-2">💡 Analyses des Ventes Intelligentes</p>
                  <p className="text-sm text-[#334155]">
                    Après chaque vente, analyse en quelques clics. L'IA analyse la situation et génère des recommandations personnalisées instantanées.
                  </p>
                </div>
              </div>
              <div className="md:order-1 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1E40AF]/20">
                <img 
                  src="https://customer-assets.emergentagent.com/job_data-entry-flow/artifacts/0z33pd4m_image.png" 
                  alt="Dashboard Vendeur - Mon Bilan Individuel"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Screenshot 3 - Dashboard Gérant */}
            <div className="grid md:grid-cols-2 gap-8 items-center pt-8 border-t border-gray-200">
              <div>
                <h3 className="text-3xl font-bold text-[#1E40AF] mb-4">Dashboard Gérant Multi-Magasins</h3>
                <p className="text-lg text-[#334155] mb-6">
                  Pilotez l'ensemble de votre réseau depuis une interface centralisée. 
                  Vision 360° de tous vos magasins, managers et vendeurs.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Vue consolidée du CA et des KPI de tous vos points de vente',
                    'Gestion centralisée des magasins (création, modification, équipes)',
                    'Suivi de tous vos managers et vendeurs en temps réel',
                    'Comparaison de performance entre magasins',
                    'Intégrations API pour synchroniser vos données existantes'
                  ].map((item, idx) => (
                    <li key={`gerant-feature-${idx}-${item.substring(0, 15)}`} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
                      <span className="text-[#334155]">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                    <Building2 className="w-6 h-6 text-orange-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-orange-600">∞</p>
                    <p className="text-xs text-gray-600">Magasins</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-600">∞</p>
                    <p className="text-xs text-gray-600">Managers</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-purple-600">100%</p>
                    <p className="text-xs text-gray-600">Visibilité</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border-l-4 border-purple-500 p-4 rounded-r-lg">
                  <p className="text-sm font-semibold text-purple-700 mb-2">🏢 Fonctionnalités Gérant Exclusives</p>
                  <p className="text-sm text-[#334155]">
                    Invitez vos managers par email, gérez les permissions, configurez vos intégrations API et accédez à des rapports consolidés pour votre direction.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-200">
                <img 
                  src="https://customer-assets.emergentagent.com/job_review-helper-8/artifacts/7vi2qv0s_image.png" 
                  alt="Dashboard Gérant - Vue Multi-Magasins"
                  className="w-full h-auto"
                  loading="lazy"
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
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
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
                Espace Manager inclus
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Small Team */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-slate-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Small Team</h3>
                <p className="text-[#334155] mb-4">Petites boutiques</p>
                {!isAnnual ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-[#334155]">29€</span>
                      <span className="text-[#334155]">/vendeur/mois</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      1 à 5 espaces vendeur
                    </p>
                    <p className="text-xs text-gray-600 mt-1">+ Espace Manager inclus</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-[#334155]">278€</span>
                      <span className="text-[#334155]">/vendeur/an</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      1 à 5 espaces vendeur
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Au lieu de 348€ • Économisez 70€/vendeur/an • Espace Manager inclus</p>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-4">
                {[
                  'Dashboard Manager & Vendeur',
                  'Diagnostic Profil Manager',
                  'Diagnostic Profil Vendeur',
                  'Coaching IA & Briefs Matinaux',
                  'Préparation des Évaluations',
                  'Suivi KPI, Objectifs & Challenges',
                  'Connexion API (Tous logiciels)'
                ].map((item, idx) => (
                  <li key={`starter-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 my-4 pt-4">
                <p className="text-sm font-semibold text-[#1E40AF] mb-3">Spécificités :</p>
                <ul className="space-y-3 mb-4">
                  {[
                    '1 à 5 vendeurs',
                    'Analyses IA illimitées',
                    'Support email sous 48h'
                  ].map((item, idx) => (
                    <li key={`starter-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                      <span className="text-[#334155] font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate('/login?register=true')}
                className="w-full py-3 bg-slate-100 text-[#334155] font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Essai Gratuit 14 Jours
              </button>
            </div>

            {/* Medium Team - NEUTRALISÉ */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-slate-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Medium Team</h3>
                <p className="text-[#334155] mb-4">Magasins moyens</p>
                {!isAnnual ? (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-[#334155]">25€</span>
                      <span className="text-[#334155]">/vendeur/mois</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      6 à 15 espaces vendeur
                    </p>
                    <p className="text-xs text-gray-600 mt-1">+ Espace Manager inclus</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-[#334155]">240€</span>
                      <span className="text-[#334155]">/vendeur/an</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      6 à 15 espaces vendeur
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Au lieu de 300€ • Économisez 60€/vendeur/an</p>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-4">
                {[
                  'Dashboard Manager & Vendeur',
                  'Diagnostic Profil Manager',
                  'Diagnostic Profil Vendeur',
                  'Coaching IA & Briefs Matinaux',
                  'Préparation des Évaluations',
                  'Suivi KPI, Objectifs & Challenges',
                  'Connexion API (Tous logiciels)'
                ].map((item, idx) => (
                  <li key={`pro-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 my-4 pt-4">
                <p className="text-sm font-semibold text-[#1E40AF] mb-3">Spécificités :</p>
                <ul className="space-y-3 mb-4">
                  {[
                    '6 à 15 vendeurs',
                    'Analyses IA illimitées',
                    'Support email sous 48h'
                  ].map((item, idx) => (
                    <li key={`pro-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                      <span className="text-[#334155] font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate('/login?register=true')}
                className="w-full py-3 bg-slate-100 text-[#334155] font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Essai Gratuit 14 Jours
              </button>
            </div>

            {/* Large Team */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-slate-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Large Team</h3>
                <p className="text-[#334155] mb-4">Pour réseaux & enseignes</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-[#1E40AF]">Sur devis</span>
                </div>
                <p className="text-sm text-green-600 font-semibold mt-2">16+ espaces vendeur</p>
                <p className="text-xs text-gray-600 mt-1">+ Espace Manager inclus</p>
              </div>

              <ul className="space-y-3 mb-4">
                {[
                  'Dashboard Manager & Vendeur',
                  'Diagnostic Profil Manager',
                  'Diagnostic Profil Vendeur',
                  'Coaching IA & Briefs Matinaux',
                  'Préparation des Évaluations',
                  'Suivi KPI, Objectifs & Challenges',
                  'Connexion API (Tous logiciels)'
                ].map((item, idx) => (
                  <li key={`enterprise-main-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                    <span className="text-[#334155]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 my-4 pt-4">
                <p className="text-sm font-semibold text-[#1E40AF] mb-3">Spécificités :</p>
                <ul className="space-y-3 mb-4">
                  {[
                    '16+ vendeurs',
                    'Analyses IA illimitées',
                    'Support prioritaire dédié'
                  ].map((item, idx) => (
                    <li key={`enterprise-spec-${idx}-${item.substring(0, 15)}`} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                      <span className="text-[#334155] font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => scrollToSection('contact')}
                className="w-full py-3 bg-slate-100 text-[#334155] font-semibold rounded-xl hover:bg-slate-200 transition-colors"
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
                <Check className="w-5 h-5 text-[#10B981]" />
                <span>14 jours d'essai gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#10B981]" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#10B981]" />
                <span>Résiliation à tout moment</span>
              </div>
              {isAnnual && (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#10B981]" />
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
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
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
                question: "Quel impact réel sur mes KPI (transformation, panier moyen, etc.) ?",
                answer: "Notre approche est mathématique : en identifiant quotidiennement les écarts de Panier Moyen ou de Taux de Transformation, l'IA permet de corriger le tir immédiatement. L'objectif est de ne plus attendre la fin du mois pour constater les pertes, mais d'agir jour après jour pour sécuriser votre Chiffre d'Affaires."
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
                answer: "Oui, toutes vos données sont hébergées en France, chiffrées et conformes au RGPD. Nous ne partageons jamais vos données avec des tiers. Pour l'IA de coaching, seuls les prénoms sont transmis (les noms de famille sont automatiquement anonymisés)."
              },
              {
                question: "L'IA conserve-t-elle mes données commerciales ?",
                answer: "Non. Nous utilisons des technologies LLM (Large Language Models) via des protocoles sécurisés 'Entreprise'. Vos données sont anonymisées avant traitement et ne sont jamais utilisées pour entraîner les modèles publics. Une fois l'analyse générée, les données brutes ne sont pas conservées par le fournisseur d'IA."
              },
              {
                question: "Faut-il installer un logiciel ?",
                answer: "Non, Retail Performer AI est 100% web. Accessible depuis n'importe quel navigateur, sur ordinateur, tablette ou smartphone."
              },
              {
                question: "Proposez-vous une formation ?",
                answer: "L'outil est conçu pour être 'Plug & Play'. Pas besoin de formation lourde : des guides interactifs sont intégrés directement dans chaque écran pour vous accompagner pas à pas. Pour les réseaux (Plans Large Team), nous proposons un onboarding personnalisé."
              }
            ].map((faq, idx) => (
              <div key={`faq-${idx}-${faq.question.substring(0, 20)}`} className="bg-blue-50 rounded-xl border-2 border-[#1E40AF]/20 overflow-hidden hover:border-[#F97316] transition-colors">
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
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à Transformer Votre Équipe ?
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-8">
            Rejoignez notre programme Pilote et co-construisez l'outil avec nous
          </p>
          <button
            onClick={() => navigate('/login?register=true')}
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
            <h2 className="text-4xl font-bold text-[#1E40AF] mb-4">
              Contactez-Nous
            </h2>
            <p className="text-xl text-[#334155]">
              Une question ? Notre équipe vous répond en moins de 24h
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Demo Request Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border-2 border-[#1E40AF]/20">
              <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">Réservez Votre Démonstration</h3>
              <p className="text-sm text-[#334155] mb-6">
                Découvrez comment Retail Performer AI peut transformer votre équipe en 30 minutes
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[#1E40AF]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E40AF]">Démonstration personnalisée</p>
                    <p className="text-sm text-[#334155]">30 minutes avec un expert</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E40AF]">Sans engagement</p>
                    <p className="text-sm text-[#334155]">Découvrez toutes les fonctionnalités</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#F97316]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E40AF]">Adapté à vos besoins</p>
                    <p className="text-sm text-[#334155]">Conseils personnalisés pour votre équipe</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDemoModal(true)}
                className="w-full py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
              >
                <Calendar className="w-5 h-5" />
                Je veux une démonstration
              </button>
              <p className="text-xs text-center text-[#64748B] mt-3">
                Réponse garantie sous 24h ouvrées
              </p>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 border-2 border-[#F97316]">
                <h3 className="text-xl font-bold text-[#1E40AF] mb-4">Informations de Contact</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[#334155] mb-1">Email</p>
                    <a href="mailto:hello@retailperformerai.com" className="text-[#EA580C] font-semibold hover:underline">
                      hello@retailperformerai.com
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
                <h3 className="text-xl font-bold text-[#1E40AF] mb-4">Horaires</h3>
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

      {/* Demo Request Modal - Calendly Integration */}
      {showDemoModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDemoModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
              <button
                onClick={() => setShowDemoModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Réserver une Démo</h2>
                  <p className="text-white/80">30 min avec un expert</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Choisissez votre créneau</h3>
                <p className="text-gray-600">
                  Sélectionnez directement un créneau disponible dans notre agenda Calendly.
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-[#1E40AF]">
                  📅 <strong>Ce qui vous attend :</strong> Une démonstration personnalisée de 30 minutes pour découvrir comment Retail Performer AI peut transformer votre équipe.
                </p>
              </div>

              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Confirmation immédiate par email
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Rappel automatique avant le RDV
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Lien de visioconférence inclus
                </li>
              </ul>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDemoModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <a
                  href="https://calendly.com/s-cappuccio-skyco/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDemoModal(false)}
                  className="flex-1 py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Ouvrir Calendly
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
