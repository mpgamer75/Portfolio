import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import LocaleTransitionWrapper from '@/components/ui/LocaleTransitionWrapper';
import '../globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
    'Cybersecurity engineer and full-stack developer specializing in offensive security, pentesting, and tool development.',
  keywords: [
    'cybersecurity',
    'pentesting',
    'red team',
    'security engineer',
    'fullstack developer',
    'Charles Lantigua',
    'ECE Paris',
    'portfolio',
    'OSINT',
    'SOC analyst',
  ],
  authors: [{ name: 'Charles Lantigua Jorge' }],
  creator: 'Charles Lantigua Jorge',
  applicationName: 'Charles Lantigua Jorge — Portfolio',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    title: 'Charles Lantigua Jorge | Portfolio',
    description:
      'Cybersecurity engineer and full-stack developer specializing in offensive security and pentesting.',
    siteName: 'Charles Lantigua Jorge',
    images: [{ url: '/images/hero/photo_hero.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Charles Lantigua Jorge | Portfolio',
    description:
      'Cybersecurity engineer and full-stack developer specializing in offensive security and pentesting.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#050814',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={jetbrainsMono.variable}>
      <body>
        <a href="#main" className="skip-to-content">
          Skip to content
        </a>
        <NextIntlClientProvider>
          <LocaleTransitionWrapper>{children}</LocaleTransitionWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
