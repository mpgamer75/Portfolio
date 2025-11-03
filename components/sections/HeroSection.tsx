'use client';

import { motion } from 'framer-motion';
import { ArrowDown, Github, Linkedin, Mail } from 'lucide-react';

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Cyber grid background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        {/* Greeting */}
        <motion.p
          variants={itemVariants}
          className="text-cyber-accent text-lg sm:text-xl mb-4 font-mono text-shadow"
        >
          Hi, I&apos;m
        </motion.p>

        {/* Name with terminal effect */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-7xl md:text-8xl font-bold mb-6 text-cyber-primary text-shadow"
        >
          Charles
          <br />
          Lantigua Jorge
        </motion.h1>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          className="text-2xl sm:text-3xl md:text-4xl font-semibold text-cyber-secondary mb-6 text-shadow"
        >
          Cybersecurity Engineer & Developer
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl text-cyber-accent max-w-2xl mx-auto mb-12 text-shadow"
        >
          Passionate about offensive security, tool development and technological innovation
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
        >
          <a
            href="#projects"
            className="cyber-button rounded-lg w-full sm:w-auto text-center"
          >
            View my projects
          </a>
          <a
            href="#contact"
            className="cyber-button rounded-lg w-full sm:w-auto text-center bg-cyber-primary/10"
          >
            Contact me
          </a>
        </motion.div>

        {/* Social Links */}
        <motion.div
          variants={itemVariants}
          className="flex gap-6 justify-center items-center icon-shadow" 
        >
          <a
            href="https://github.com/mpgamer75"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyber-secondary hover:text-cyber-primary transition-colors duration-300"
            aria-label="GitHub"
          >
            <Github size={28} />
          </a>
          <a
            href="https://www.linkedin.com/in/charles-lantigua-jorge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyber-secondary hover:text-cyber-primary transition-colors duration-300"
            aria-label="LinkedIn"
          >
            <Linkedin size={28} />
          </a>
          <a
            href="mailto:charleslantiguajorge@gmail.com"
            className="text-cyber-secondary hover:text-cyber-primary transition-colors duration-300"
            aria-label="Email"
          >
            <Mail size={28} />
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2 icon-shadow" 
        >
          <ArrowDown className="text-cyber-accent" size={32} />
        </motion.div>
      </motion.div>
    </section>
  );
}