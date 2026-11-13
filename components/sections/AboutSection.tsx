'use client';

import { MapPin, Briefcase, GraduationCap } from 'lucide-react';
import Image from 'next/image';
import CountUp from '@/components/ui/CountUp';
import { Reveal } from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import { BLUR_DATA_URL } from '@/lib/images';

export default function AboutSection() {
  return (
    <section id="about" className="relative py-12 sm:py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div>
          <Reveal>
            <SectionHeading text="About Me" speed={45} className="mb-8 sm:mb-12 md:mb-16" />
          </Reveal>

          <div className="grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
            {/* Image container */}
            <Reveal className="relative order-2 md:order-1">
              <div className="relative w-full aspect-square max-w-sm sm:max-w-md mx-auto group">
                {/* Decorative border with hover effect - Optimized */}
                <div
                  className="decorative-border absolute inset-0 border-2 border-cyber-brand/60 rounded-lg smooth-transition group-hover:border-cyber-brand"
                  style={{ transform: 'translate(12px, 12px)' }}
                />

                {/* Image container with hover effects - Performance optimized */}
                <div
                  className="relative rounded-lg h-full w-full overflow-hidden border-2 border-cyber-primary/40 group-hover:border-cyber-brand smooth-transition group-hover:shadow-[0_0_20px_rgba(52,211,153,0.35)] sm:group-hover:shadow-[0_0_30px_rgba(52,211,153,0.35)]"
                  style={{
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Overlay gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyber-brand/0 to-cyber-brand/10 opacity-0 group-hover:opacity-100 smooth-transition z-10" />

                  {/* Image with optimized zoom effect */}
                  <div
                    className="relative w-full h-full overflow-hidden"
                    style={{ transform: 'translateZ(0)' }}
                  >
                    <Image
                      src="/images/hero/photo_hero.jpg"
                      alt="Charles Lantigua Jorge"
                      fill
                      className="object-cover smooth-transition-slow group-hover:scale-105 sm:group-hover:scale-110"
                      // Below the fold on every viewport: let it lazy-load instead of
                      // competing with the hero for bandwidth at `priority`.
                      loading="lazy"
                      quality={75}
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      sizes="(max-width: 768px) 90vw, 45vw"
                      style={{
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }}
                    />
                  </div>

                  {/* Shine effect on hover - GPU accelerated */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 smooth-transition-slow pointer-events-none">
                    <div
                      className="shine-effect absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{
                        transform: 'translateX(-100%)',
                        transition: 'transform 1s ease-in-out',
                        willChange: 'transform',
                      }}
                    />
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Content */}
            <Reveal className="space-y-4 sm:space-y-6 order-1 md:order-2">
              <p className="text-base sm:text-lg text-white leading-relaxed font-medium">
                Cybersecurity consultant at HeadMind Partners in Paris, trained in Computer
                Science &amp; Cybersecurity Engineering at ECE Paris — I specialize in{' '}
                <span className="text-cyber-brand font-semibold">offensive security</span>,{' '}
                <span className="text-cyber-brand font-semibold">tool development</span> and{' '}
                <span className="text-cyber-brand font-semibold">threat analysis</span>.
              </p>
              <p className="text-sm sm:text-base text-cyber-accent leading-relaxed">
                Hands-on across SOC, pentesting and secure application development, I
                constantly push to deepen my technical skills.
              </p>

              <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6">
                <div className="flex items-center space-x-3 text-white">
                  <MapPin className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">Paris, France</span>
                </div>

                <div className="flex items-center space-x-3 text-white">
                  <Briefcase className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">
                    Cybersecurity Consultant · HeadMind Partners
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-white">
                  <GraduationCap className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">
                    ECE Paris · Cybersecurity Engineering
                  </span>
                </div>
              </div>

              {/* Facts — a terminal-style readout instead of the stat-card trio.
                  The two numeric lines link to their sections. */}
              <ul className="pt-6 sm:pt-8 space-y-2.5 font-mono text-sm sm:text-base">
                <li>
                  <a
                    href="#projects"
                    className="group inline-flex min-h-[44px] items-baseline gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker"
                    aria-label="20 public repos on GitHub — jump to my highlighted projects"
                  >
                    <span aria-hidden="true" className="text-cyber-brand">&gt;</span>
                    <span className="text-2xl sm:text-3xl font-bold text-cyber-primary tabular-nums">
                      <CountUp value={20} />
                    </span>
                    <span className="text-cyber-accent transition-colors group-hover:text-cyber-primary">
                      public repos on GitHub <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="#experience"
                    className="group inline-flex min-h-[44px] items-baseline gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker"
                    aria-label="3 internships — jump to my experience"
                  >
                    <span aria-hidden="true" className="text-cyber-brand">&gt;</span>
                    <span className="text-2xl sm:text-3xl font-bold text-cyber-primary tabular-nums">
                      <CountUp value={3} />
                    </span>
                    <span className="text-cyber-accent transition-colors group-hover:text-cyber-primary">
                      internships <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="#skills"
                    className="group inline-flex min-h-[44px] items-baseline gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker"
                    aria-label="3 certifications — jump to my skills and certifications"
                  >
                    <span aria-hidden="true" className="text-cyber-brand">&gt;</span>
                    <span className="text-2xl sm:text-3xl font-bold text-cyber-primary tabular-nums">
                      <CountUp value={3} />
                    </span>
                    <span className="text-cyber-accent transition-colors group-hover:text-cyber-primary">
                      certifications <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </li>
                <li className="inline-flex min-h-[44px] items-baseline gap-2.5">
                  <span aria-hidden="true" className="text-cyber-brand">&gt;</span>
                  <span className="text-2xl sm:text-3xl font-bold text-cyber-primary tabular-nums">
                    <CountUp value={3} />
                  </span>
                  <span className="text-cyber-accent">
                    languages <span className="text-cyber-secondary">· French, Spanish, English</span>
                  </span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
