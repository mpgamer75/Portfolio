'use client';

import { Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-cyber-primary/30 bg-cyber-dark/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-gray-400 text-sm text-center md:text-left">
            © {currentYear} Charles Lantigua Jorge. All rights reserved.
          </div>

          {/* Built with */}
          <div className="flex items-center space-x-2 text-gray-400 text-sm">
            <span>Built with Next.js and Tailwind CSS</span>
            <Heart className="text-cyber-accent" size={16} fill="currentColor" />
          </div>

          {/* Version */}
          <div className="text-gray-400 text-sm font-mono">
            v1.0.0
          </div>
        </div>

        {/* Decorative line */}
        <div className="mt-6 h-1 bg-gradient-to-r from-transparent via-cyber-primary to-transparent opacity-30" />
      </div>
    </footer>
  );
}
