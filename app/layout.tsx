import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charles Lantigua Jorge | Cybersecurity Engineer & Developer',
  description: 'Passionate about offensive security, tool development and technological innovation',
  keywords: [
    'cybersecurity',
    'developer',
    'pentesting',
    'security engineer',
    'fullstack developer',
    'Charles Lantigua',
    'portfolio',
  ],
  authors: [{ name: 'Charles Lantigua Jorge' }],
  openGraph: {
    type: 'website',
    locale: 'en',
    title: 'Charles Lantigua Jorge | Portfolio',
    description: 'Passionate about offensive security, tool development and technological innovation',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

