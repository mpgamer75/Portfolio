'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-cyber-darker">
      <p className="font-mono text-sm text-cyber-accent mb-4">ERR_FATAL</p>
      <h1 className="text-4xl sm:text-5xl font-bold text-cyber-primary mb-4 glow-text">
        Something broke
      </h1>
      <p className="text-cyber-secondary max-w-md mb-8">
        An unexpected error occurred. The team has been notified.
      </p>
      <button onClick={reset} className="cyber-button rounded-lg">
        Try again
      </button>
    </main>
  );
}
