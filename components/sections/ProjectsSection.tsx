'use client';

import { motion } from 'framer-motion';
import ProjectCard from '@/components/ui/ProjectCard';

export default function ProjectsSection() {
  const projects = [
    {
      title: 'Security Scanner',
      description: 'Security assessment tool in Bash for Red Teams, integrating OSINT, network, web and exploitation modules. Interactive interface and adaptive modes to optimize pentesting audits.',
      tech: ['Bash', 'Nmap', 'Nuclei', 'Subfinder', 'OSINT', 'Gobuster', 'Metasploit'],
      github: 'https://github.com/mpgamer75/security-scanner',
      featured: true,
      // imagePath: '/images/projects/security-scanner.png', // Uncomment when image is added
    },
    {
      title: 'Encryptor',
      description: 'Multi-platform file encryption utility in Bash and OpenSSL. Implementation of 8 modern algorithms (AES-256-GCM, ChaCha20) and secure key management via Elliptic Curve Cryptography (ECC).',
      tech: ['Bash', 'OpenSSL', 'Debian Packaging', 'GitHub Actions'],
      github: 'https://github.com/mpgamer75/encryptor',
      featured: true,
      // imagePath: '/images/projects/encryptor.png', // Uncomment when image is added
    },
    {
      title: 'SABER',
      description: 'Secure web platform with Next.js for document encryption and decryption. Backend and interface development to ensure confidentiality of sensitive data exchanges.',
      tech: ['Next.js', 'JavaScript', 'Web Cryptography', 'Vercel'],
      github: 'https://github.com/mpgamer75/fall2024-webtech-210',
      demo: 'https://fall2024-webtech-210-saber11-charles-projects-0eed9e6d.vercel.app/',
      featured: true,
      // imagePath: '/images/projects/saber.png', // Uncomment when image is added
    },
    {
      title: 'IoC App Altice',
      description: 'Application for managing and analyzing Indicators of Compromise (IoC) to improve threat detection and incident response.',
      tech: ['Python', 'Web Development', 'Cybersecurity'],
      github: 'https://github.com/mpgamer75/IoC-app-altice',
      featured: false,
      // imagePath: '/images/projects/ioc-app.png', // Uncomment when image is added
    },
    {
      title: 'Warhammer 40k Terminal Display',
      description: 'Creative project combining passion for Warhammer 40k and development skills. Stylized and interactive terminal interface.',
      tech: ['Terminal', 'CLI', 'Creative Coding'],
      github: 'https://github.com/mpgamer75/Warhammer-40k-terminal-display',
      featured: false,
      // imagePath: '/images/projects/warhammer.png', // Uncomment when image is added
    },
  ];

  return (
    <section id="projects" className="relative py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4">
            <span className="text-cyber-primary">Projects</span>
          </h2>
          <div className="w-24 h-1 bg-cyber-primary mx-auto mb-16" />

          {/* Projects Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <ProjectCard
                key={index}
                {...project}
                index={index}
              />
            ))}
          </div>

          {/* View more on GitHub */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-12"
          >
            <a
              href="https://github.com/mpgamer75"
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-button rounded-lg inline-block"
            >
              View more on GitHub
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}