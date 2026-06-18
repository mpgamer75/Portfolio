'use client';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-cyber-primary/30 glass-effect">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-3 sm:space-y-4 md:space-y-0 text-center md:text-left">
          {/* Copyright */}
          <div className="text-cyber-accent text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            © {currentYear} Charles Lantigua Jorge. All rights reserved.
          </div>

          {/* Tagline */}
          <div className="flex items-center font-mono text-cyber-accent text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            <span className="hidden sm:inline">Cybersecurity Engineer · Paris, France</span>
            <span className="sm:hidden">Cybersecurity · Paris</span>
          </div>

          {/* Version */}
          <div className="text-cyber-accent text-xs sm:text-sm font-mono smooth-transition hover:text-cyber-primary">
            v1.2.0
          </div>
        </div>

        {/* Decorative line */}
        <div className="mt-4 sm:mt-6 h-1 bg-gradient-to-r from-transparent via-cyber-brand to-transparent opacity-40 smooth-transition hover:opacity-60" />
      </div>
    </footer>
  );
}