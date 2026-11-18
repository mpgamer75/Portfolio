export interface Project {
  title: string;
  /** Optional short pitch for the grid card. Falls back to `description`. */
  tagline?: string;
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
    title: 'Mi SaludRD',
    tagline:
      'Medical appointment platform for the Dominican Republic: patients find a verified doctor and book in a few taps.',
    description:
      'Medical appointment platform for the Dominican Republic. Patients search verified doctors by specialty, location and insurer, then book online; doctors run their practice from their own panel on a paid plan. I built the Next.js web app on Supabase with Stripe subscriptions, and a Flutter mobile app on the same backend.',
    tech: ['Next.js', 'TypeScript', 'Supabase', 'Stripe', 'Tailwind CSS', 'Flutter'],
    demo: 'https://mi-saludrd.com',
    featured: true,
    imagePaths: [
      '/images/projects/misaludrd1.jpg',
      '/images/projects/misaludrd2.jpg',
      '/images/projects/misaludrd3.jpg',
    ],
  },
  {
    title: 'Lisa Tejada Boutique',
    tagline:
      "Online storefront for a women's fashion boutique in Santiago, with a cart that checks out over WhatsApp.",
    description:
      "Storefront for a women's fashion boutique in Santiago de los Caballeros: catalog, lookbook, wishlist and a cart that hands the order to WhatsApp, backed by an admin for products, stock and orders. Built as a Turborepo monorepo: a Next.js site on Supabase, plus a Tauri desktop point-of-sale app that shares the same pricing and order logic.",
    tech: ['Next.js', 'TypeScript', 'Supabase', 'Tauri', 'Turborepo', 'Vercel'],
    demo: 'https://lisatejada.com',
    featured: true,
    imagePaths: [
      '/images/projects/lisatejada1.jpg',
      '/images/projects/lisatejada2.jpg',
      '/images/projects/lisatejada3.jpg',
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
