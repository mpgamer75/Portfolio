'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Folder from '@/components/ui/Folder';
import ProjectDetailModal from '@/components/ui/ProjectDetailModal';
import Image from 'next/image';

// Définition du type Project
type Project = {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePaths?: string[];
};

export default function ProjectsSection() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // La liste des projets reste la même
  const projects: Project[] = [
    {
      title: 'Security Scanner',
      description: 'Security assessment tool in Bash for Red Teams, integrating OSINT, network, web and exploitation modules. Interactive interface and adaptive modes to optimize pentesting audits.',
      tech: ['Bash', 'Nmap', 'Nuclei', 'Subfinder', 'OSINT', 'Gobuster', 'Metasploit'],
      github: 'https://github.com/mpgamer75/security-scanner',
      featured: true,
      imagePaths: [
        '/images/projects/security-scanner1.png', 
        '/images/projects/security-scanner2.png', 
        '/images/projects/security-scanner3.png'
      ],
    },
    {
      title: 'Encryptor',
      description: 'Multi-platform file encryption utility in Bash and OpenSSL. Implementation of 8 modern algorithms (AES-256-GCM, ChaCha20) and secure key management via Elliptic Curve Cryptography (ECC).',
      tech: ['Bash', 'OpenSSL', 'Debian Packaging', 'GitHub Actions'],
      github: 'https://github.com/mpgamer75/encryptor',
      featured: true,
      imagePaths: [
        '/images/projects/encryptor1.png',
        '/images/projects/encryptor2.png',
        '/images/projects/encryptor3.png',
        '/images/projects/encryptor4.png',
        '/images/projects/encryptor5.png'
      ],
    },
    {
      title: 'SABER',
      description: 'Secure web platform with Next.js for document encryption and decryption. Backend and interface development to ensure confidentiality of sensitive data exchanges.',
      tech: ['Next.js', 'JavaScript', 'Web Cryptography', 'Vercel'],
      github: 'https://github.com/mpgamer75/fall2024-webtech-210',
      demo: 'https://fall2024-webtech-210-saber11-charles-projects-0eed9e6d.vercel.app/',
      featured: true,
      imagePaths: ['/images/projects/Saber.png'],
    },
    {
      title: 'IoC App Altice',
      description: 'Application for managing and analyzing Indicators of Compromise (IoC) to improve threat detection and incident response.',
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
        '/images/projects/IoC7.png'
      ],
    },
    {
      title: 'Warhammer 40k Terminal Display',
      description: 'Creative project combining passion for Warhammer 40k and development skills. Stylized and interactive terminal interface.',
      tech: ['Terminal', 'CLI', 'Creative Coding'],
      github: 'https://github.com/mpgamer75/Warhammer-40k-terminal-display',
      featured: false,
      imagePaths: [], // Tableau vide, affichera le placeholder
    },
  ];

  // Crée les "papiers" (les 5 fiches projet) pour le composant Folder
  const folderItems = projects.map((project, index) => (
    <div
      key={index}
      className="w-full h-full rounded-md overflow-hidden relative cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation(); // Empêche le dossier de s'ouvrir/fermer
        setSelectedProject(project); // Ouvre la modale pour CE projet
      }}
    >
      <div className="w-full h-full bg-white/95 rounded-lg flex flex-col items-center justify-start p-2 transition-all duration-300 group-hover:scale-105 border border-gray-400/30">
        <div className="w-full flex-grow relative mb-1">
          
          {/* CORRECTION: Remplace l'appel réseau par un placeholder local */}
          {(project.imagePaths && project.imagePaths.length > 0) ? (
            <Image
              src={project.imagePaths[0]}
              alt={project.title}
              fill
              className="object-contain" // Image entièrement visible
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            // Placeholder local pour le projet sans image (Warhammer)
            // Ceci ne fait pas d'appel réseau et n'est pas un SVG externe
            <div className="w-full h-full flex flex-col items-center justify-center text-cyber-darker/50 p-2 opacity-75">
              <svg 
                className="w-1/2 h-1/2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6l.01.01" />
              </svg>
              <p className="text-xs font-mono mt-1 text-center">No Preview</p>
            </div>
          )}
        </div>
        <div className="w-full flex-shrink-0">
          <h4 className="text-cyber-darker text-xs font-bold text-center px-1 truncate">
            {project.title}
          </h4>
        </div>
      </div>
      <div className="absolute inset-0 bg-cyber-primary/0 group-hover:bg-cyber-primary/20 transition-colors duration-300 rounded-lg" />
    </div>
  ));


  return (
    <>
      <section id="projects" className="relative py-20 min-h-screen flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4">
            <span className="text-cyber-primary">Projects</span>
          </h2>
          <div className="w-24 h-1 bg-cyber-primary mx-auto mb-16" />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring' }}
            className="flex justify-center items-center h-64"
          >
            <Folder
              color="var(--cyber-accent)" 
              size={3} 
              items={folderItems} 
            />
          </motion.div>
          
          <p className="text-center text-cyber-primary text-shadow font-mono mt-32 text-lg animate-pulse">
            Click the Folder to explore
          </p>

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
      </section>

      {/* Modale de Détail */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailModal 
            project={selectedProject} 
            onClose={() => setSelectedProject(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}