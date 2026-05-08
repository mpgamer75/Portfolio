'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-cyber-darker">
      <p className="font-mono text-sm text-cyber-accent mb-4">ERR_404</p>
      <h1 className="text-5xl sm:text-6xl font-bold text-cyber-primary mb-4 glow-text">
        Page not found
      </h1>
      <p className="text-cyber-secondary max-w-md mb-8">
        The route you tried to reach has drifted off the grid. Let&apos;s get you back home.
      </p>
      <Link href="/" className="cyber-button rounded-lg">
        Return to home
      </Link>
    </main>
  );
}
