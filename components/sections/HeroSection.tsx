'use client';

import { motion } from 'framer-motion';
import { FileDown } from 'lucide-react';
import AnimatedText from '@/components/ui/AnimatedText';
import DecryptedText from '@/components/ui/DecryptedText';
import MagneticButton from '@/components/ui/MagneticButton';
import { socialLinks } from '@/lib/links';

const subtitlePhrases = [
  'Cybersecurity Engineer',
  'Offensive Security & Tooling',
  'SOC Automation',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.4 } },
};

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden px-4 sm:px-6 lg:px-8"
    >
      <div aria-hidden="true" className="absolute inset-0 cyber-grid opacity-20" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto w-full"
      >
        <div className="max-w-3xl text-center md:text-left">
          <motion.p
            variants={itemVariants}
            className="text-cyber-accent text-sm sm:text-base md:text-lg mb-2 sm:mb-3 font-mono"
          >
            Hi, I&apos;m
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.98] mb-4 sm:mb-6"
          >
            <DecryptedText
              text={'Charles\nLantigua Jorge'}
              animateOn="mount"
              speed={50}
              revealDirection="start"
              className="text-cyber-primary"
              encryptedClassName="text-cyber-brand/70"
            />
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="text-lg sm:text-2xl md:text-3xl font-semibold text-cyber-secondary mb-5 sm:mb-7 h-[1.5em] flex items-center justify-center md:justify-start"
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
            variants={itemVariants}
            className="text-base sm:text-lg text-cyber-accent max-w-2xl mx-auto md:mx-0 mb-8 sm:mb-10 leading-relaxed"
          >
            I build offensive-security tooling and SOC automation — from Red Team
            scanners and crypto utilities to enterprise vulnerability management
            and threat detection.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start items-center mb-8 sm:mb-10"
          >
            <MagneticButton className="inline-flex w-full sm:w-auto">
              <a
                href="/cv.pdf"
                download
                data-fx="download"
                className="cyber-button cyber-button--primary w-full text-center inline-flex items-center justify-center gap-2 min-w-[180px]"
                aria-label="Download my CV (PDF)"
              >
                <FileDown size={18} aria-hidden="true" />
                Download CV
              </a>
            </MagneticButton>
            <a
              href="#projects"
              className="cyber-button w-full sm:w-auto text-center min-w-[180px]"
              aria-label="View my projects"
            >
              View projects
            </a>
            <a
              href="#contact"
              className="cyber-button w-full sm:w-auto text-center bg-cyber-primary/5 min-w-[180px]"
              aria-label="Contact me"
            >
              Contact
            </a>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="flex gap-4 sm:gap-5 justify-center md:justify-start items-center"
          >
            {socialLinks.map(({ href, label, Icon }) => (
              <motion.a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="relative p-3 rounded-xl bg-cyber-primary/5 border border-cyber-primary/30 hover:border-cyber-brand hover:bg-cyber-brand/10 smooth-transition"
                aria-label={label}
                whileHover={{ scale: 1.12, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon
                  size={24}
                  className="sm:w-7 sm:h-7 text-cyber-primary"
                  aria-hidden="true"
                />
              </motion.a>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
