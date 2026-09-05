'use client';

import { Mail, Linkedin, Github, Phone, FileDown, ArrowUpRight } from 'lucide-react';
import { Reveal, RevealItem } from '@/components/ui/Reveal';
import DecryptedText from '@/components/ui/DecryptedText';

export default function ContactSection() {
  const contactMethods = [
    {
      icon: Mail,
      label: 'Email',
      value: 'charleslantiguajorge@gmail.com',
      href: 'mailto:charleslantiguajorge@gmail.com',
    },
    {
      icon: Linkedin,
      label: 'LinkedIn',
      value: 'charles-lantigua-jorge',
      href: 'https://www.linkedin.com/in/charles-lantigua-jorge',
    },
    {
      icon: Github,
      label: 'GitHub',
      value: '@mpgamer75',
      href: 'https://github.com/mpgamer75',
    },
    {
      icon: Phone,
      label: 'Phone',
      value: '+33 7 67 80 40 34',
      href: 'tel:+33767804034',
    },
  ];

  return (
    <section id="contact" className="relative py-12 sm:py-16 md:py-20">
      {/* w-full: the section is a flex container, so without an explicit width this
          block would size to its content — and the no-wrap email row would push it
          wider than a phone screen instead of truncating. */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan text-cyber-primary">
            <DecryptedText text="Contact Me" animateOn="view" speed={50} encryptedClassName="text-cyber-brand/70" />
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-6 sm:mb-8 cyber-neon" />
          <p className="text-lg sm:text-xl text-cyber-secondary text-center max-w-2xl mx-auto mb-8 sm:mb-10 md:mb-12">
            Interested in working together? Feel free to reach out!
          </p>
        </Reveal>

        {/* Contact channels — one readout list, not four identical cards. */}
        <Reveal stagger className="mb-8 sm:mb-10 md:mb-12">
          <ul className="divide-y divide-cyber-primary/10 border-y border-cyber-primary/10">
            {contactMethods.map((method) => {
              const Icon = method.icon;
              const external = method.href.startsWith('http');
              return (
                <li key={method.label}>
                  <RevealItem>
                    <a
                      href={method.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className="group flex min-h-[64px] items-center gap-4 sm:gap-6 px-2 py-3 -mx-2 rounded-md transition-colors hover:bg-cyber-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                    >
                      <Icon className="flex-shrink-0 text-cyber-brand" size={22} aria-hidden="true" />
                      <span className="w-20 sm:w-24 flex-shrink-0 font-mono text-sm text-cyber-accent">
                        {method.label}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-base sm:text-lg text-white transition-colors group-hover:text-cyber-brand">
                        {method.value}
                      </span>
                      <ArrowUpRight
                        className="flex-shrink-0 text-cyber-accent transition-all group-hover:text-cyber-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        size={18}
                        aria-hidden="true"
                      />
                    </a>
                  </RevealItem>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.1}>
          <div className="cyber-card rounded-lg p-6 sm:p-7 md:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
              Ready to collaborate?
            </h3>
            <p className="text-cyber-secondary mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
              Feel free to contact me to discuss projects, opportunities or just to chat about cybersecurity!
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <a
                href="/cv.pdf"
                download
                data-fx="download"
                className="cyber-button cyber-button--primary inline-flex items-center justify-center gap-2"
                aria-label="Download my CV (PDF)"
              >
                <FileDown size={18} aria-hidden="true" />
                Download CV
              </a>
              <a
                href="mailto:charleslantiguajorge@gmail.com?subject=Let%27s%20work%20together"
                className="cyber-button inline-block"
              >
                Email me
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
