'use client';

import { Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-cyber-primary/30 glass-effect">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-3 sm:space-y-4 md:space-y-0 text-center md:text-left">
          {/* Copyright */}
          <div className="text-gray-400 text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            © {currentYear} Charles Lantigua Jorge. All rights reserved.
          </div>

          {/* Built with */}
          <div className="flex items-center space-x-2 text-gray-400 text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            <span className="hidden sm:inline">Built with Next.js and Tailwind CSS</span>
            <span className="sm:hidden">Built with ❤️</span>
            <Heart className="text-cyber-accent hidden sm:inline smooth-transition hover:text-cyber-primary" size={14} fill="currentColor" />
          </div>

          {/* Version */}
          <div className="text-gray-400 text-xs sm:text-sm font-mono smooth-transition hover:text-cyber-primary">
            v1.0.0
          </div>
        </div>

        {/* Decorative line */}
        <div className="mt-4 sm:mt-6 h-1 bg-gradient-to-r from-transparent via-cyber-primary to-transparent opacity-30 smooth-transition hover:opacity-50" />
      </div>
    </footer>
  );
}