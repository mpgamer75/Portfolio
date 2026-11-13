'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail, Linkedin, Github, Phone, FileDown, ArrowUpRight, Copy, Check } from 'lucide-react';
import { Reveal, RevealItem } from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';

const EMAIL = 'charleslantiguajorge@gmail.com';

const contactMethods = [
  {
    icon: Mail,
    label: 'Email',
    value: EMAIL,
    href: `mailto:${EMAIL}`,
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

export default function ContactSection() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copyEmail = async () => {
    try {
      // Unavailable on insecure origins and in some embedded browsers; the
      // mailto link beside the button still works there.
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      // Say so instead of looking dead; the address beside it is still selectable.
      setCopied(false);
      setCopyFailed(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopyFailed(false), 3000);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section id="contact" className="relative py-12 sm:py-16 md:py-20">
      {/* w-full: the section is a flex container, so without an explicit width this
          block would size to its content — and the no-wrap email row would push it
          wider than a phone screen instead of truncating. */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading text="Contact Me" speed={50} />
          <p className="font-mono text-sm sm:text-base text-cyber-accent text-center max-w-2xl mx-auto mb-8 sm:mb-10 md:mb-12">
            <span aria-hidden="true" className="text-cyber-brand">
              &gt;
            </span>{' '}
            Cybersecurity Consultant @ HeadMind Partners · Paris, France
          </p>
        </Reveal>

        {/* Contact channels — one readout list, not four identical cards. */}
        <Reveal stagger className="mb-8 sm:mb-10 md:mb-12">
          <ul className="divide-y divide-cyber-primary/10 border-y border-cyber-primary/10">
            {contactMethods.map((method) => {
              const Icon = method.icon;
              const external = method.href.startsWith('http');
              const isEmail = method.label === 'Email';
              return (
                <li key={method.label}>
                  <RevealItem className="flex items-center gap-1">
                    <a
                      href={method.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className="group flex flex-1 min-w-0 min-h-[64px] items-center gap-4 sm:gap-6 px-2 py-3 -ml-2 rounded-md transition-colors hover:bg-cyber-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                    >
                      <Icon className="flex-shrink-0 text-cyber-brand" size={22} aria-hidden="true" />
                      {/* On phones the label column is dropped so the full email /
                          handle fits; the icon still identifies the channel and the
                          label stays in the accessible name via sr-only. */}
                      <span className="hidden sm:block w-24 flex-shrink-0 font-mono text-sm text-cyber-accent">
                        {method.label}
                      </span>
                      <span className="sr-only sm:hidden">{method.label}: </span>
                      <span className="flex-1 min-w-0 break-all sm:break-normal sm:truncate text-[15px] sm:text-lg text-white transition-colors group-hover:text-cyber-brand">
                        {method.value}
                      </span>
                      <ArrowUpRight
                        className="flex-shrink-0 text-cyber-accent transition-all group-hover:text-cyber-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        size={18}
                        aria-hidden="true"
                      />
                    </a>
                    {/* Sibling of the link, never nested inside it. */}
                    {isEmail && (
                      <button
                        type="button"
                        onClick={copyEmail}
                        aria-label="Copy email address"
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-cyber-accent transition-colors hover:bg-cyber-brand/5 hover:text-cyber-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                      >
                        {copied ? (
                          <Check size={18} className="text-cyber-brand" aria-hidden="true" />
                        ) : (
                          <Copy size={18} aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </RevealItem>
                </li>
              );
            })}
          </ul>
          <span
            className={copyFailed ? 'mt-3 block text-center font-mono text-xs text-cyber-accent' : 'sr-only'}
            aria-live="polite"
          >
            {copied ? 'Email copied' : copyFailed ? 'Copy failed — select the address instead' : ''}
          </span>
        </Reveal>

        {/* CTA — one button row; the list above already says how to reach me. */}
        <Reveal delay={0.1}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <a
              href={`mailto:${EMAIL}?subject=Let%27s%20work%20together`}
              className="cyber-button cyber-button--primary inline-flex items-center justify-center gap-2"
            >
              <Mail size={18} aria-hidden="true" />
              Email me
            </a>
            <a
              href="/cv.pdf"
              download
              data-fx="download"
              className="cyber-button inline-flex items-center justify-center gap-2"
              aria-label="Download my CV (PDF)"
            >
              <FileDown size={18} aria-hidden="true" />
              Download CV
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
