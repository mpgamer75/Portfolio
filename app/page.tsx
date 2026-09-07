'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/ui/Navigation';
import MobileBackground from '@/components/ui/MobileBackground';
import ScrollProgress from '@/components/ui/ScrollProgress';
import ClickSpark from '@/components/ui/ClickSpark';
import ButtonFX from '@/components/ui/ButtonFX';
import BackToTop from '@/components/ui/BackToTop';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import ExperienceSection from '@/components/sections/ExperienceSection';
import ProjectsSection from '@/components/sections/ProjectsSection';
import SkillsSection from '@/components/sections/SkillsSection';
import ContactSection from '@/components/sections/ContactSection';
import Footer from '@/components/ui/Footer';
import ProjectModalProvider from '@/components/ui/ProjectModalProvider';
import { useIsMobile } from '@/hooks/useIsMobile';

// Desktop-only WebGL backdrop (ogl). Code-split so phones — which render the
// CSS/canvas MobileBackground instead — never download the shader bundle.
const Prism = dynamic(() => import('@/components/ui/Prism'), { ssr: false });

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

  // The prism is the hero's backdrop; once the hero scrolls away it freezes
  // (Prism `activeSelector`) but its bright band would still cut through every
  // section's text. Dim the whole background layer past the hero — one opacity
  // transition on an already-composited layer, no per-frame work.
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('home');
    if (!hero) return;
    const io = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0.12 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <ProjectModalProvider>
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
          opacity: pastHero && !isMobile ? 0.55 : 1,
          transition: 'opacity 900ms ease',
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
      <ButtonFX />

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
      <BackToTop />
    </div>
    </ProjectModalProvider>
  );
}
