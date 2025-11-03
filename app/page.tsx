import Navigation from '@/components/ui/Navigation';
import Prism from '@/components/ui/Prism';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import ExperienceSection from '@/components/sections/ExperienceSection';
import ProjectsSection from '@/components/sections/ProjectsSection';
import SkillsSection from '@/components/sections/SkillsSection';
import ContactSection from '@/components/sections/ContactSection';
import Footer from '@/components/ui/Footer';

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      {/* Animated background */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none bg-cyber-darker"> {/* AJOUTÉ ICI */}
        <Prism
          height={3.5}
          baseWidth={5.5}
          animationType="rotate"
          glow={1}
          noise={0} 
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          timeScale={0.5}
          bloom={1}
          suspendWhenOffscreen={true}
        />
      </div>

      {/* Navigation */}
      <Navigation />

      {/* Main content */}
      <main>
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