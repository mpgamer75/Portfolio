'use client';

import { motion } from 'framer-motion';
import { Code2, Shield, Globe, Wrench, Award } from 'lucide-react';

export default function SkillsSection() {
  const skillCategories = [
    {
      icon: Code2,
      title: 'Programming',
      items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
      color: 'text-cyber-primary',
    },
    {
      icon: Shield,
      title: 'Security & Systems',
      items: ['Kali Linux', 'Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Fortinet', 'Trellix EDR', 'OSINT'],
      color: 'text-cyber-secondary',
    },
    {
      icon: Globe,
      title: 'Web Development',
      items: ['Next.js', 'React', 'Node.js', 'Vercel', 'REST API'],
      color: 'text-cyber-accent',
    },
    {
      icon: Wrench,
      title: 'Tools & Platforms',
      items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Active Directory'],
      color: 'text-cyber-primary',
    },
    {
      icon: Award,
      title: 'Certifications',
      items: ['Cisco Introduction to Cybersecurity'],
      color: 'text-cyber-secondary',
    },
  ];

  return (
    <section id="skills" className="relative py-12 sm:py-16 md:py-20 bg-cyber-dark/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
            <span className="text-cyber-primary">Skills</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16 cyber-neon" />

          {/* Skills Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
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
                    <div className="p-2 sm:p-3 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                      <Icon className={category.color} size={24} />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">{category.title}</h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {category.items.map((skill, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.1 + i * 0.05 }}
                        whileHover={{ scale: 1.1 }}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono bg-cyber-darker text-gray-300 border border-cyber-primary/30 rounded-lg hover:border-cyber-primary hover:text-cyber-primary transition-all duration-300 cursor-default"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

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
              <p className="text-gray-400 text-sm sm:text-base">Active on the platform</p>
              
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
              <p className="text-gray-400 text-sm sm:text-base">Active profile with 5+ public repos</p>
              
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
              <p className="text-gray-400 text-sm sm:text-base">Cybersecurity training</p>
              <p className="text-cyber-secondary mt-3 sm:mt-4 text-xs sm:text-sm">2023 - 2026</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}