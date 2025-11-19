'use client';

import { motion } from 'framer-motion';
import { Github, Linkedin, Mail } from 'lucide-react';

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  // Icônes sociales apparaissent immédiatement
  const socialVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, delay: 0 },
    },
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Cyber grid background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto w-full text-center"
      >
        {/* Greeting */}
        <motion.p
          variants={itemVariants}
          className="text-cyber-accent text-base sm:text-lg md:text-xl mb-3 sm:mb-4 font-mono text-shadow"
        >
          Hi, I&apos;m
        </motion.p>

        {/* Name with terminal effect */}
        <motion.h1
          variants={itemVariants}
          className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 sm:mb-6 text-cyber-primary text-shadow leading-tight"
        >
          Charles
          <br />
          Lantigua Jorge
        </motion.h1>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-cyber-secondary mb-4 sm:mb-6 text-shadow px-2"
        >
          Cybersecurity Engineer & Developer
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-base sm:text-lg md:text-xl text-cyber-accent max-w-2xl mx-auto mb-8 sm:mb-12 text-shadow px-4"
        >
          Passionate about cybersecurity, tool development and technological innovation
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-8 sm:mb-12 px-4"
        >
          <a
            href="#projects"
            className="cyber-button rounded-lg w-full sm:w-auto text-center min-w-[200px]"
            aria-label="View my projects"
          >
            View my projects
          </a>
          <a
            href="#contact"
            className="cyber-button rounded-lg w-full sm:w-auto text-center bg-cyber-primary/10 min-w-[200px]"
            aria-label="Contact me"
          >
            Contact me
          </a>
        </motion.div>

        {/* Social Links - Always visible with glow */}
        <motion.div
          initial="visible"
          animate="visible"
          variants={socialVariants}
          className="flex gap-5 sm:gap-7 justify-center items-center mb-8 sm:mb-12"
        >
          <motion.a
            href="https://github.com/mpgamer75"
            target="_blank"
            rel="noopener noreferrer"
            className="relative p-3 rounded-xl bg-cyber-primary/10 border-2 border-cyber-primary/50 hover:border-cyber-primary hover:bg-cyber-primary/15 smooth-transition group shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            aria-label="GitHub"
            whileHover={{ scale: 1.15, y: -3 }}
            whileTap={{ scale: 0.95 }}
          >
            <Github
              size={28}
              className="sm:w-8 sm:h-8 text-cyber-primary drop-shadow-[0_0_10px_rgba(255,255,255,1)] group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,1)]"
            />
            <div className="absolute inset-0 rounded-xl bg-cyber-primary/0 group-hover:bg-cyber-primary/10 smooth-transition" />
          </motion.a>
          <motion.a
            href="https://www.linkedin.com/in/charles-lantigua-jorge"
            target="_blank"
            rel="noopener noreferrer"
            className="relative p-3 rounded-xl bg-cyber-primary/10 border-2 border-cyber-primary/50 hover:border-cyber-primary hover:bg-cyber-primary/15 smooth-transition group shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            aria-label="LinkedIn"
            whileHover={{ scale: 1.15, y: -3 }}
            whileTap={{ scale: 0.95 }}
          >
            <Linkedin
              size={28}
              className="sm:w-8 sm:h-8 text-cyber-primary drop-shadow-[0_0_10px_rgba(255,255,255,1)] group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,1)]"
            />
            <div className="absolute inset-0 rounded-xl bg-cyber-primary/0 group-hover:bg-cyber-primary/10 smooth-transition" />
          </motion.a>
          <motion.a
            href="mailto:charleslantiguajorge@gmail.com"
            className="relative p-3 rounded-xl bg-cyber-primary/10 border-2 border-cyber-primary/50 hover:border-cyber-primary hover:bg-cyber-primary/15 smooth-transition group shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            aria-label="Email"
            whileHover={{ scale: 1.15, y: -3 }}
            whileTap={{ scale: 0.95 }}
          >
            <Mail
              size={28}
              className="sm:w-8 sm:h-8 text-cyber-primary drop-shadow-[0_0_10px_rgba(255,255,255,1)] group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,1)]"
            />
            <div className="absolute inset-0 rounded-xl bg-cyber-primary/0 group-hover:bg-cyber-primary/10 smooth-transition" />
          </motion.a>
        </motion.div>
      </motion.div>
    </section>
  );
}