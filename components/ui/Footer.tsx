'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-cyber-primary/30 glass-effect">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-3 sm:space-y-4 md:space-y-0 text-center md:text-left">
          <div className="text-gray-400 text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            © {currentYear} Charles Lantigua Jorge. {t('rights')}.
          </div>

          <div className="flex items-center space-x-2 text-gray-400 text-xs sm:text-sm smooth-transition hover:text-cyber-secondary">
            <span className="hidden sm:inline">{t('built')}</span>
            <span className="sm:hidden">{t('builtShort')}</span>
            <Heart
              className="text-cyber-accent hidden sm:inline smooth-transition hover:text-cyber-primary"
              size={14}
              fill="currentColor"
              aria-hidden="true"
            />
          </div>

          <div className="text-gray-400 text-xs sm:text-sm font-mono smooth-transition hover:text-cyber-primary">
            v1.1.0
          </div>
        </div>

        <div className="mt-4 sm:mt-6 h-1 bg-linear-to-r from-transparent via-cyber-primary to-transparent opacity-30 smooth-transition hover:opacity-50" />
      </div>
    </footer>
  );
}
