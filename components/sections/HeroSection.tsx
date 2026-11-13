'use client';

import { motion } from 'framer-motion';
import { ArrowRight, FileDown } from 'lucide-react';
import AnimatedText from '@/components/ui/AnimatedText';
import DecryptedText from '@/components/ui/DecryptedText';
import MagneticButton from '@/components/ui/MagneticButton';
import { socialLinks } from '@/lib/links';
import { EASE_OUT } from '@/lib/motion';

const subtitlePhrases = [
  'Cybersecurity Consultant',
  'Vulnerability Management',
  'Offensive Security & Tooling',
];

// Only the secondary rows animate in. The eyebrow, the h1 (LCP) and the CTA row
// are plain elements so they paint straight from the server HTML.
const rise = (order: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE_OUT, delay: order * 0.06 },
});

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen min-h-[100svh] flex items-center overflow-hidden px-4 sm:px-6 lg:px-8 pt-24 pb-16"
    >
      <div aria-hidden="true" className="absolute inset-0 hero-grid" />

      <div className="relative z-10 max-w-6xl mx-auto w-full">
        <div className="max-w-3xl text-center md:text-left">
          <p className="font-mono text-xs sm:text-sm text-cyber-accent mb-3 sm:mb-4">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-cyber-brand mr-2.5 align-middle"
            />
            <span className="align-middle">
              Cybersecurity Consultant · HeadMind Partners · Paris
            </span>
          </p>

          {/* 2rem below 360px: "Lantigua Jorge" in mono at text-4xl is ~302px,
              wider than a 320px viewport's 288px content box. */}
          <h1 className="text-[2rem] min-[360px]:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.98] mb-4 sm:mb-6">
            <DecryptedText
              text={'Charles\nLantigua Jorge'}
              animateOn="mount"
              speed={35}
              revealDirection="start"
              className="text-cyber-primary"
              encryptedClassName="text-cyber-brand/70"
            />
          </h1>

          <motion.div
            {...rise(0)}
            className="text-sm min-[360px]:text-base sm:text-2xl md:text-3xl font-semibold text-cyber-secondary mb-5 sm:mb-7 min-h-[1.5em] whitespace-nowrap flex items-center justify-center md:justify-start"
          >
            <span aria-hidden="true" className="text-cyber-brand2 font-mono mr-2">
              &gt;
            </span>
            <AnimatedText
              phrases={subtitlePhrases}
              typingSpeed={70}
              deletingSpeed={40}
              pauseDuration={2500}
            />
          </motion.div>

          <motion.p
            {...rise(1)}
            className="text-base sm:text-lg text-cyber-accent max-w-2xl mx-auto md:mx-0 mb-8 sm:mb-10 leading-relaxed"
          >
            I build offensive-security tooling and SOC automation — from Red Team
            scanners and crypto utilities to enterprise vulnerability management
            and threat detection.
          </motion.p>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center md:justify-start items-center mb-6 sm:mb-8">
            <MagneticButton className="inline-flex w-full sm:w-auto">
              <a
                href="/cv.pdf"
                download
                data-fx="download"
                className="cyber-button cyber-button--primary w-full text-center inline-flex items-center justify-center gap-2 sm:min-w-[180px]"
                aria-label="Download my CV (PDF)"
              >
                <FileDown size={18} aria-hidden="true" />
                Download CV
              </a>
            </MagneticButton>
            <a
              href="#projects"
              className="cyber-button w-full sm:w-auto text-center sm:min-w-[180px]"
              aria-label="View my projects"
            >
              View projects
            </a>
            <a
              href="#contact"
              className="group inline-flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-sm text-cyber-accent hover:text-cyber-brand transition-colors"
            >
              Contact
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </a>
          </div>

          <motion.div
            {...rise(2)}
            className="flex gap-1 justify-center md:justify-start items-center md:-ml-2.5"
          >
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-cyber-secondary hover:text-cyber-brand transition-colors"
                aria-label={label}
              >
                <Icon size={22} aria-hidden="true" />
              </a>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
