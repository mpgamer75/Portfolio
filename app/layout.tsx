import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Inter } from 'next/font/google';
import MotionConfigProvider from '@/components/ui/MotionConfigProvider';
import './globals.css';

// Mono-forward identity: JetBrains Mono drives display/headings (ties to the
// DecryptedText motif), Inter carries body copy. Exposed as CSS variables.
// Only the weights actually set on mono text: 400 body/labels, 600 the hero
// subtitle, 700 headings + logo. (500 was downloaded but never used.)
const display = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Charles Lantigua Jorge | Cybersecurity Engineer & Developer',
    template: '%s | Charles Lantigua Jorge',
  },
  description:
    'Cybersecurity engineer and software developer specializing in offensive security, pentesting, and tool development.',
  keywords: [
    'cybersecurity',
    'developer',
    'pentesting',
    'security engineer',
    'software developer',
    'Charles Lantigua',
    'portfolio',
    'OSINT',
    'SOC analyst',
    'ECE Paris',
  ],
  authors: [{ name: 'Charles Lantigua Jorge' }],
  creator: 'Charles Lantigua Jorge',
  applicationName: 'Charles Lantigua Jorge — Portfolio',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en',
    title: 'Charles Lantigua Jorge | Portfolio',
    description:
      'Cybersecurity engineer and software developer specializing in offensive security, pentesting, and tool development.',
    siteName: 'Charles Lantigua Jorge',
    // og:image / twitter:image come from app/opengraph-image.tsx (file convention).
  },
  alternates: { canonical: '/' },
  twitter: {
    card: 'summary_large_image',
    title: 'Charles Lantigua Jorge | Portfolio',
    description:
      'Cybersecurity engineer and software developer specializing in offensive security, pentesting, and tool development.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#050814',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Structured data so search engines can attach the name, role and profiles to a
// single Person entity (rich results / knowledge panel signals).
const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Charles Lantigua Jorge',
  url: siteUrl,
  jobTitle: 'Cybersecurity Engineer',
  description:
    'Cybersecurity engineer and software developer specializing in offensive security, pentesting, and tool development.',
  email: 'mailto:charleslantiguajorge@gmail.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Paris', addressCountry: 'FR' },
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'ECE Paris' },
  knowsAbout: ['Cybersecurity', 'Penetration testing', 'SOC', 'OSINT', 'Python', 'Next.js'],
  sameAs: ['https://github.com/mpgamer75', 'https://www.linkedin.com/in/charles-lantigua-jorge'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // Static, trusted object — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <a href="#main" className="skip-to-content">
          Skip to main content
        </a>
        <MotionConfigProvider>{children}</MotionConfigProvider>
      </body>
    </html>
  );
}
