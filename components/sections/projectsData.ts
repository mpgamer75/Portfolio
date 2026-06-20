export interface Project {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePaths?: string[];
}

export const projects: Project[] = [
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
