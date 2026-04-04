import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import BannerSection from './landingPage/BannerSection';
import HeaderSection from './landingPage/HeaderSection';
import HeroSection from './landingPage/HeroSection';
import SocialProofSection from './landingPage/SocialProofSection';
import ProblemSolutionSection from './landingPage/ProblemSolutionSection';
import FeaturesSection from './landingPage/FeaturesSection';
import ScreenshotsSection from './landingPage/ScreenshotsSection';
import PricingSection from './landingPage/PricingSection';
import FaqSection from './landingPage/FaqSection';
import CtaSection from './landingPage/CtaSection';
import ContactSection from './landingPage/ContactSection';
import FooterSection from './landingPage/FooterSection';
import DiscSection from './landingPage/DiscSection';
import DemoModal from './landingPage/DemoModal';
import LiveDemoModal from './landingPage/LiveDemoModal';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showLiveDemoModal, setShowLiveDemoModal] = useState(false);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Logiciel KPI Retail & Diagnostic DISC pour Managers | Retail Performer AI</title>
        <meta name="description" content="Pilotez vos KPI retail et coachez vos équipes avec le diagnostic DISC. Briefs IA personnalisés, suivi performance vendeurs, multi-magasins. Essai gratuit 30 jours. Dès 19€/vendeur/mois." />
        <link rel="canonical" href="https://retailperformerai.com" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://retailperformerai.com" />
        <meta property="og:title" content="Logiciel KPI Retail & Diagnostic DISC pour Managers | Retail Performer AI" />
        <meta property="og:description" content="Pilotez vos KPI retail et coachez vos équipes grâce au diagnostic DISC. Briefs IA personnalisés, suivi performance vendeurs, multi-magasins. Essai gratuit 30 jours." />
        <meta property="og:image" content="https://retailperformerai.com/hero-retail-boutique.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content="Retail Performer AI" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Logiciel KPI Retail & Diagnostic DISC pour Managers | Retail Performer AI" />
        <meta name="twitter:description" content="Pilotez vos KPI retail et coachez vos équipes grâce au diagnostic DISC. Briefs IA personnalisés, suivi performance vendeurs, multi-magasins. Essai gratuit 30 jours." />
        <meta name="twitter:image" content="https://retailperformerai.com/hero-retail-boutique.png" />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Retail Performer AI",
          "url": "https://retailperformerai.com",
          "description": "Plateforme de coaching commercial IA pour équipes retail. Diagnostics comportementaux DISC, briefs du matin générés par IA, suivi KPI, évaluations et bilans RH automatisés.",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "inLanguage": "fr",
          "offers": {
            "@type": "Offer",
            "price": "19",
            "priceCurrency": "EUR",
            "priceSpecification": {
              "@type": "UnitPriceSpecification",
              "price": "19",
              "priceCurrency": "EUR",
              "unitText": "vendeur/mois"
            },
            "description": "Essai gratuit 30 jours — Tarif Fondateur dès 19€/vendeur/mois"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Retail Performer AI",
            "url": "https://retailperformerai.com"
          },
          "featureList": [
            "Diagnostics comportementaux DISC pour vendeurs et managers",
            "Briefs du matin générés par intelligence artificielle",
            "Suivi KPI et objectifs en temps réel",
            "Évaluations et bilans RH automatisés",
            "Coaching personnalisé par profil comportemental",
            "Multi-magasins et multi-équipes",
            "Connexion API avec tous logiciels de caisse"
          ]
        })}</script>
      </Helmet>
      <BannerSection />
      <HeaderSection
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        scrollToSection={scrollToSection}
      />
      <HeroSection scrollToSection={scrollToSection} onOpenLiveDemo={() => setShowLiveDemoModal(true)} />
      <SocialProofSection />
      <ProblemSolutionSection />
      <DiscSection />
      <FeaturesSection />
      <ScreenshotsSection />
      <PricingSection
        isAnnual={isAnnual}
        setIsAnnual={setIsAnnual}
        scrollToSection={scrollToSection}
      />
      <FaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <CtaSection />
      <ContactSection setShowDemoModal={setShowDemoModal} />
      <FooterSection scrollToSection={scrollToSection} />
      <DemoModal showDemoModal={showDemoModal} setShowDemoModal={setShowDemoModal} />
      <LiveDemoModal show={showLiveDemoModal} onClose={() => setShowLiveDemoModal(false)} />
    </div>
  );
}
