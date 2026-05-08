'use client';

import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/useIsMobile';
import Navigation from '@/components/ui/Navigation';
import ScrollProgress from '@/components/ui/ScrollProgress';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import ExperienceSection from '@/components/sections/ExperienceSection';
import ProjectsSection from '@/components/sections/ProjectsSection';
import SkillsSection from '@/components/sections/SkillsSection';
import ContactSection from '@/components/sections/ContactSection';
import Footer from '@/components/ui/Footer';
import Dock from '@/components/ui/Dock';

const Prism = dynamic(() => import('@/components/ui/Prism'), { ssr: false });
const MobileBackground = dynamic(
  () => import('@/components/ui/MobileBackground'),
  { ssr: false },
);

export default function HomeShell() {
  const isMobile = useIsMobile();

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
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
            suspendWhenOffscreen
          />
        ) : (
          <MobileBackground />
        )}
      </div>

      <Navigation />
      <ScrollProgress />

      <main
        id="main"
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

      <Footer />
      <Dock />
    </div>
  );
}
