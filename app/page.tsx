'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/ui/Navigation';
import Prism from '@/components/ui/Prism';
import MobileBackground from '@/components/ui/MobileBackground';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import ExperienceSection from '@/components/sections/ExperienceSection';
import ProjectsSection from '@/components/sections/ProjectsSection';
import SkillsSection from '@/components/sections/SkillsSection';
import ContactSection from '@/components/sections/ContactSection';
import Footer from '@/components/ui/Footer';

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Animated background - Optimized for performance */}
      <div
        className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none bg-cyber-darker"
        style={{
          willChange: 'auto',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
        }}
      >
        {!isMobile ? (
          <Prism
            height={3.5}
            baseWidth={5.5}
            animationType="rotate"
            glow={0.9}
            noise={0}
            scale={3.6}
            hueShift={0}
            colorFrequency={1}
            timeScale={0.4}
            bloom={0.9}
            suspendWhenOffscreen={true}
          />
        ) : (
          <MobileBackground />
        )}
      </div>

      {/* Navigation */}
      <Navigation />

      {/* Main content - Isolated layer for better performance */}
      <main
        style={{
          willChange: 'auto',
          transform: 'translateZ(0)',
        }}
      >
        <HeroSection />
        <AboutSection />
        <ExperienceSection />
        <ProjectsSection />
        <SkillsSection />
        <ContactSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}