import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Inter } from 'next/font/google';
import MotionConfigProvider from '@/components/ui/MotionConfigProvider';
import './globals.css';

// Mono-forward identity: JetBrains Mono drives display/headings (ties to the
// DecryptedText motif), Inter carries body copy. Exposed as CSS variables.
const display = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
    images: [
      {
        url: '/images/hero/photo_hero.jpg',
        width: 1200,
        height: 630,
        alt: 'Charles Lantigua Jorge — Cybersecurity Engineer',
      },
    ],
  },
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="skip-to-content">
          Skip to main content
        </a>
        <MotionConfigProvider>{children}</MotionConfigProvider>
      </body>
    </html>
  );
}
