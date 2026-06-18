'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Folder from '@/components/ui/Folder';
import ProjectDetailModal from '@/components/ui/ProjectDetailModal';
import Image from 'next/image';
import { useIsMobile } from '@/hooks/useIsMobile';

type Project = {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePaths?: string[];
};

const projects: Project[] = [
  {
    title: 'Security Scanner',
    description:
      'Security assessment tool in Bash for Red Teams, integrating OSINT, network, web and exploitation modules. Interactive interface and adaptive modes to optimize pentesting audits.',
    tech: ['Bash', 'Nmap', 'Nuclei', 'Subfinder', 'OSINT', 'Gobuster', 'Metasploit'],
    github: 'https://github.com/mpgamer75/security-scanner',
    featured: true,
    imagePaths: [
      '/images/projects/security-scanner1.png',
      '/images/projects/security-scanner2.png',
      '/images/projects/security-scanner3.png',
    ],
  },
  {
    title: 'Encryptor',
    description:
      'Multi-platform file encryption utility in Bash and OpenSSL. Implementation of 8 modern algorithms (AES-256-GCM, ChaCha20) and secure key management via Elliptic Curve Cryptography (ECC).',
    tech: ['Bash', 'OpenSSL', 'Debian Packaging', 'GitHub Actions'],
    github: 'https://github.com/mpgamer75/encryptor',
    featured: true,
    imagePaths: [
      '/images/projects/encryptor1.png',
      '/images/projects/encryptor2.png',
      '/images/projects/encryptor3.png',
      '/images/projects/encryptor4.png',
      '/images/projects/encryptor5.png',
    ],
  },
  {
    title: 'SABER',
    description:
      'End-to-end encrypted document platform built with Next.js and the Web Cryptography API. Files are encrypted client-side before upload, so plaintext never reaches the server — I built the crypto layer, API and interface, deployed on Vercel.',
    tech: ['Next.js', 'JavaScript', 'Web Cryptography', 'Vercel'],
    github: 'https://github.com/mpgamer75/fall2024-webtech-210',
    demo: 'https://fall2024-webtech-210-saber11-charles-projects-0eed9e6d.vercel.app/',
    featured: true,
    imagePaths: ['/images/projects/Saber.png'],
  },
  {
    title: 'IoC App Altice',
    description:
      'Built during my AlticeDo SOC internship: a Python application to ingest, normalise and correlate Indicators of Compromise (IPs, hashes, domains) so analysts can triage alerts and respond to incidents faster.',
    tech: ['Python', 'Web Development', 'Cybersecurity'],
    github: 'https://github.com/mpgamer75/IoC-app-altice',
    featured: false,
    imagePaths: [
      '/images/projects/IoC1.png',
      '/images/projects/IoC2.png',
      '/images/projects/IoC3.png',
      '/images/projects/IoC4.png',
      '/images/projects/IoC5.png',
      '/images/projects/IoC6.png',
      '/images/projects/IoC7.png',
    ],
  },
  {
    title: 'Warhammer 40k Terminal Display',
    description:
      'Creative project combining passion for Warhammer 40k and development skills. Stylized and interactive terminal interface.',
    tech: ['Terminal', 'CLI', 'Creative Coding'],
    github: 'https://github.com/mpgamer75/Warhammer-40k-terminal-display',
    featured: false,
    imagePaths: [],
  },
];

export default function ProjectsSection() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const isMobile = useIsMobile();

  // Memoize the rendered cards so the Folder doesn't reset its open/close
  // transitions every time the parent re-renders.
  const folderItems = useMemo(
    () =>
      projects.map((project, index) => (
        <button
          key={project.title}
          type="button"
          className="w-full h-full rounded-lg overflow-hidden relative cursor-pointer group block text-left"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProject(project);
          }}
          aria-label={`Open ${project.title} details`}
        >
          <div className="w-full h-full bg-cyber-darker/90 rounded-lg flex flex-col items-center justify-between p-2 sm:p-3 transition-all duration-300 group-hover:scale-[1.02] active:scale-[0.98] group-hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] border border-cyber-primary/30 group-hover:border-cyber-brand/70">
            {/* Image slot — dark placeholder so the card is visible even before the image loads */}
            <div className="w-full h-[80px] sm:h-[110px] relative rounded-md overflow-hidden bg-cyber-dark/60 border border-cyber-primary/15 flex items-center justify-center mb-1.5 sm:mb-2">
              {project.imagePaths && project.imagePaths.length > 0 ? (
                <Image
                  src={project.imagePaths[0]}
                  alt=""
                  fill
                  className="object-contain p-1"
                  sizes="(max-width: 640px) 150px, 200px"
                  priority={index < 3}
                  quality={isMobile ? 50 : 75}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-cyber-accent/70 p-2">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 mb-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-[8px] sm:text-[9px] font-mono text-center">No preview</p>
                </div>
              )}
            </div>
            {/* Title + tech badges — readable on the dark card */}
            <div className="w-full bg-cyber-darker/70 rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5 border-t border-cyber-primary/15">
              <h4 className="text-cyber-primary text-[10px] sm:text-xs font-bold text-center truncate mb-0.5 sm:mb-1 tracking-wide">
                {project.title}
              </h4>
              <div className="flex justify-center gap-1 flex-wrap">
                {project.tech.slice(0, 2).map((tech, i) => (
                  <span
                    key={i}
                    className="text-[7px] sm:text-[8px] font-mono text-cyber-secondary bg-cyber-primary/10 border border-cyber-primary/20 px-1 py-0.5 rounded"
                  >
                    {tech}
                  </span>
                ))}
                {project.tech.length > 2 && (
                  <span className="text-[7px] sm:text-[8px] font-mono text-cyber-secondary bg-cyber-primary/10 border border-cyber-primary/20 px-1 py-0.5 rounded">
                    +{project.tech.length - 2}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-cyber-brand/0 group-hover:bg-cyber-brand/10 transition-colors duration-300 rounded-lg pointer-events-none" />
        </button>
      )),
    [isMobile],
  );

  return (
    <>
      <section
        id="projects"
        className="relative py-12 sm:py-16 md:py-20 min-h-screen flex flex-col items-center justify-center px-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
            <span className="text-cyber-primary">Projects</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16 cyber-neon" />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring' }}
            className="flex justify-center items-center h-48 sm:h-56 md:h-64"
          >
            <Folder color="#34D399" size={isMobile ? 2 : 3} items={folderItems} />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center text-cyber-accent text-readable font-mono mt-16 sm:mt-24 md:mt-32 text-sm sm:text-base md:text-lg"
          >
            Click the folder to explore projects
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-8 sm:mt-10 md:mt-12"
          >
            <a
              href="https://github.com/mpgamer75"
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-button inline-block"
              aria-label="View more projects on GitHub"
            >
              View more on GitHub
            </a>
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailModal
            key={selectedProject.title}
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
