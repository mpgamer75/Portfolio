import Navigation from '@/components/ui/Navigation';
import LiquidEther from '@/components/ui/LiquidEther';
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
      <LiquidEther />

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

