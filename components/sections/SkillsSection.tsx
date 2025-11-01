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
    <section id="skills" className="relative py-20 bg-cyber-dark/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4">
            <span className="text-cyber-primary glow-text">Skills</span>
          </h2>
          <div className="w-24 h-1 bg-cyber-primary mx-auto mb-16" />

          {/* Skills Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {skillCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="cyber-card rounded-lg p-6"
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-cyber-primary/10 rounded-lg">
                      <Icon className={category.color} size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white">{category.title}</h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {category.items.map((skill, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.1 + i * 0.05 }}
                        whileHover={{ scale: 1.1 }}
                        className="px-3 py-1.5 text-sm font-mono bg-cyber-darker text-gray-300 border border-cyber-primary/30 rounded-lg hover:border-cyber-primary hover:text-cyber-primary transition-all duration-300 cursor-default"
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
            className="mt-16 grid md:grid-cols-3 gap-6"
          >
            <div className="cyber-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-cyber-primary mb-2">TryHackMe</div>
              <p className="text-gray-400">Active on the platform</p>
              <a
                href="https://tryhackme.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-sm"
              >
                View profile →
              </a>
            </div>

            <div className="cyber-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-cyber-primary mb-2">GitHub</div>
              <p className="text-gray-400">Active profile with 5+ public repos</p>
              <a
                href="https://github.com/mpgamer75"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-sm"
              >
                View profile →
              </a>
            </div>

            <div className="cyber-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-cyber-primary mb-2">ECE Paris</div>
              <p className="text-gray-400">Cybersecurity training</p>
              <p className="text-cyber-secondary mt-4 text-sm">2023 - 2026</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
