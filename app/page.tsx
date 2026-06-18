'use client';

import { useSyncExternalStore } from 'react';
import Navigation from '@/components/ui/Navigation';
import Prism from '@/components/ui/Prism';
import MobileBackground from '@/components/ui/MobileBackground';
import ScrollProgress from '@/components/ui/ScrollProgress';
import ClickSpark from '@/components/ui/ClickSpark';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import ExperienceSection from '@/components/sections/ExperienceSection';
import ProjectsSection from '@/components/sections/ProjectsSection';
import SkillsSection from '@/components/sections/SkillsSection';
import ContactSection from '@/components/sections/ContactSection';
import Footer from '@/components/ui/Footer';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function HomePage() {
  const isMobile = useIsMobile();
  // Gate the background until after mount: render the plain dark layer first
  // (matches SSR), then mount the correct background. Removes the first-paint
  // background swap/flash and avoids spinning up WebGL on phones.
  // useSyncExternalStore keeps it hydration-safe (server + first paint = false).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="relative min-h-screen">
      {/* Animated background — fixed full-viewport layer */}
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
        {mounted && !isMobile && (
          <Prism
            height={3.5}
            baseWidth={5.5}
            animationType="rotate"
            glow={0.6}
            noise={0}
            scale={3.6}
            hueShift={0}
            colorFrequency={1}
            timeScale={0.4}
            bloom={0.5}
            suspendWhenOffscreen
            activeSelector="#home"
          />
        )}
        {mounted && isMobile && <MobileBackground />}
      </div>

      <Navigation />
      <ScrollProgress />
      <ClickSpark sparkColor="#34D399" duration={300} />

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
        <SkillsSection />
        <ProjectsSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  );
}
