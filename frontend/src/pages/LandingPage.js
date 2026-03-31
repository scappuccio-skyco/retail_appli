import React, { useState } from 'react';
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
      <BannerSection />
      <HeaderSection
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        scrollToSection={scrollToSection}
      />
      <HeroSection scrollToSection={scrollToSection} onOpenLiveDemo={() => setShowLiveDemoModal(true)} />
      <SocialProofSection />
      <ProblemSolutionSection />
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
