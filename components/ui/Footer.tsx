'use client';

import { navItems, socialLinks } from '@/lib/links';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-cyber-primary/20 glass-effect">
      <h2 className="sr-only">Site footer</h2>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid gap-8 md:grid-cols-3 items-start">
          {/* Brand + tagline */}
          <div className="text-center md:text-left">
            <a href="#home" className="text-xl font-bold text-cyber-primary font-mono">
              {'<CL />'}
            </a>
            <p className="mt-2 font-mono text-cyber-accent text-xs sm:text-sm">
              Cybersecurity Engineer · Paris, France
            </p>
          </div>

          {/* Section nav */}
          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-center gap-x-4 gap-y-2"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-mono text-xs sm:text-sm text-cyber-accent hover:text-cyber-primary transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Socials */}
          <div className="flex items-center justify-center md:justify-end gap-3">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={label}
                className="p-2 rounded-lg border border-cyber-primary/25 text-cyber-secondary hover:text-cyber-primary hover:border-cyber-brand hover:bg-cyber-brand/10 transition-colors"
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-cyber-primary/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
          <p className="text-cyber-accent text-xs sm:text-sm">
            © {currentYear} Charles Lantigua Jorge. All rights reserved.
          </p>
          <p className="text-cyber-accent/70 text-xs font-mono">v1.2.0</p>
        </div>
      </div>
    </footer>
  );
}
