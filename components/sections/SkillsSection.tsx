'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Shield, Globe, Wrench, Award } from 'lucide-react';
import CredlyBadge from '@/components/ui/CredlyBadge';
import SkillsConstellationGate from '@/components/three/SkillsConstellationGate';

export default function SkillsSection() {
  // Mirrors the 3D constellation's selection for the assistive-tech live readout.
  const [focus, setFocus] = useState<{ cluster: number | null; skill: string | null }>({
    cluster: null,
    skill: null,
  });
  const handleFocusChange = useCallback(
    (cluster: number | null, skill: string | null) => setFocus({ cluster, skill }),
    [],
  );

  const skillCategories = [
    {
      icon: Shield,
      title: 'Security & Systems',
      context: 'Used in production at Airbus & AlticeDo SOC',
      items: ['Kali Linux', 'Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Fortinet', 'Trellix EDR', 'OSINT'],
      color: 'text-cyber-brand2',
    },
    {
      icon: Code2,
      title: 'Programming',
      context: 'Languages behind my tooling & automation work',
      items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
      color: 'text-cyber-brand2',
    },
    {
      icon: Globe,
      title: 'Web Development',
      context: 'Shipped SABER and this portfolio',
      items: ['Next.js', 'React', 'Node.js', 'Vercel', 'REST API'],
      color: 'text-cyber-brand2',
    },
    {
      icon: Wrench,
      title: 'Tools & Platforms',
      context: 'Daily drivers for builds, labs and AD',
      items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Active Directory'],
      color: 'text-cyber-brand2',
    },
  ];

  return (
    <section id="skills" className="relative py-12 sm:py-16 md:py-20">
      {/* Single full-width child: the section itself is display:flex (globals.css). */}
      <div className="w-full">
      {/* Heading (centered column) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
          <span className="text-cyber-primary">Skills</span>
        </h2>
        <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-6 sm:mb-8 cyber-neon" />
      </motion.div>

      {/* 3D constellation — full-width and unboxed; desktop-only & render-gated.
          On mobile / reduced-motion the gate renders nothing and the cards below take over. */}
      <SkillsConstellationGate onFocusChange={handleFocusChange} />
      <p className="hidden md:block text-center text-cyber-accent font-mono text-xs sm:text-sm mt-3 mb-12 md:mb-16 px-4">
        Interactive map of my skill domains — hover to inspect, click any node to zoom in and see where I use it
      </p>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Live region announcing the current constellation selection (canvas is decorative). */}
        <p className="sr-only" aria-live="polite">
          {focus.skill
            ? `Selected skill: ${focus.skill}`
            : focus.cluster !== null
              ? `Focused domain: ${skillCategories[focus.cluster].title}`
              : ''}
        </p>

        {/* Skill cards — MOBILE ONLY. On desktop the constellation above is the display. */}
        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {skillCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="cyber-card rounded-lg p-4 sm:p-5 md:p-6"
              >
                <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                  <div className="p-2 sm:p-3 rounded-lg flex-shrink-0 bg-cyber-brand/10">
                    <Icon className={category.color} size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white">{category.title}</h3>
                    <p className="text-xs text-cyber-accent font-mono mt-0.5">{category.context}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {category.items.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono rounded-lg border bg-cyber-darker text-cyber-secondary border-cyber-primary/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Desktop screen-reader fallback (the constellation canvas is decorative). */}
        <div className="hidden md:block sr-only" aria-label="Skills by domain">
          <ul>
            {skillCategories.map((category) => (
              <li key={category.title}>
                {category.title}: {category.items.join(', ')}
              </li>
            ))}
          </ul>
        </div>

        {/* Certifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-4 sm:mt-6 md:mt-8"
        >
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Award className="text-cyber-primary" size={28} />
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Certifications</h3>
          </div>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8">
            {/* Cisco Credly Badge */}
            <div className="flex flex-col items-center">
              <CredlyBadge badgeId="606eed2a-e969-489e-8f0f-049aa12e36ad" width={150} height={270} />
              <a
                href="https://www.credly.com/badges/606eed2a-e969-489e-8f0f-049aa12e36ad/public_url"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-sm text-cyber-secondary hover:text-cyber-primary transition-colors"
              >
                Cisco Introduction to Cybersecurity →
              </a>
            </div>

            {/* CompTIA Security+ Badge */}
            <div className="flex flex-col items-center">
              <CredlyBadge badgeId="892d3bff-6d4f-4b21-bdf7-2a14d28c5985" width={150} height={270} />
              <a
                href="https://www.credly.com/badges/892d3bff-6d4f-4b21-bdf7-2a14d28c5985/public_url"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-sm text-cyber-secondary hover:text-cyber-primary transition-colors"
              >
                CompTIA Security+ →
              </a>
            </div>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 sm:mt-12 md:mt-16 grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6"
        >
          <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">TryHackMe</div>
            <p className="text-cyber-accent text-sm sm:text-base">Active on the platform</p>
            <a
              href="https://tryhackme.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 sm:mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-xs sm:text-sm"
            >
              View profile →
            </a>
          </div>

          <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">GitHub</div>
            <p className="text-cyber-accent text-sm sm:text-base">Active profile with 5+ public repos</p>
            <a
              href="https://github.com/mpgamer75"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 sm:mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-xs sm:text-sm"
            >
              View profile →
            </a>
          </div>

          <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center sm:col-span-2 md:col-span-1">
            <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">ECE Paris</div>
            <p className="text-cyber-accent text-sm sm:text-base">Cybersecurity and Computer Science degree</p>
            <p className="text-cyber-secondary mt-3 sm:mt-4 text-xs sm:text-sm">2023 - 2026</p>
          </div>
        </motion.div>
      </div>
      </div>
    </section>
  );
}
