'use client';

import { MapPin, Calendar } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import SectionHeading from '@/components/ui/SectionHeading';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { jobs, type Job } from './experienceData';

const currentJob = jobs.find((job) => job.current);
const pastJobs = jobs.filter((job) => !job.current);

const jobKey = (job: Job) => `${job.company}-${job.period}`;

function TypeChip({ type }: { type: Job['type'] }) {
  return (
    <span className="flex-shrink-0 rounded-md border border-cyber-primary/20 px-2 py-0.5 font-mono text-[11px] leading-5 text-cyber-accent">
      {type}
    </span>
  );
}

function Highlights({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start text-sm sm:text-[15px] leading-relaxed text-cyber-secondary"
        >
          <span aria-hidden="true" className="mr-2 flex-shrink-0 text-cyber-brand2">
            ▹
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Full-width card for the role held today. Reads as complete with no highlights. */
function CurrentRoleCard({ job }: { job: Job }) {
  return (
    <SpotlightCard
      as="article"
      aria-labelledby="current-role-title"
      className="cyber-card rounded-lg"
      // .cyber-card's border colour is unlayered CSS, so a utility cannot tint
      // it; the emerald resting border and static glow are set inline.
      style={{
        borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
        boxShadow: 'var(--glow-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-t-lg border-b border-cyber-brand/20 bg-cyber-brand/5 px-4 py-2.5 sm:px-6 md:px-8">
        <span className="font-mono text-xs text-cyber-brand">&gt; current_role</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyber-brand/50 px-2.5 py-0.5 font-mono text-xs text-cyber-brand">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyber-brand/60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber-brand" />
          </span>
          Now
        </span>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3
            id="current-role-title"
            className="text-xl font-bold text-white break-words sm:text-2xl"
          >
            {job.title}
          </h3>
          <TypeChip type={job.type} />
        </div>
        <p className="mt-1 font-mono text-sm text-cyber-brand sm:text-base">{job.company}</p>

        <div className="mt-4 flex flex-col gap-2 text-sm text-cyber-accent sm:flex-row sm:flex-wrap sm:gap-x-6">
          <span className="inline-flex items-center gap-2">
            <MapPin size={14} className="flex-shrink-0 text-cyber-primary" aria-hidden="true" />
            <span className="break-words">{job.location}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Calendar size={14} className="flex-shrink-0 text-cyber-primary" aria-hidden="true" />
            <span>{job.period}</span>
          </span>
        </div>

        {job.summary && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-cyber-secondary sm:text-[15px]">
            {job.summary}
          </p>
        )}

        {job.highlights.length > 0 && (
          <div className="mt-4">
            <Highlights items={job.highlights} />
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

export default function ExperienceSection() {
  return (
    <section id="experience" className="relative py-12 sm:py-16 md:py-20 bg-cyber-dark/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            text="Professional Experience"
            speed={35}
            className="mb-8 sm:mb-12 md:mb-16"
          />
        </Reveal>

        {currentJob && (
          <Reveal>
            <CurrentRoleCard job={currentJob} />
          </Reveal>
        )}

        {pastJobs.length > 0 && (
          <>
            {currentJob && (
              <div className="mb-6 mt-10 flex items-center gap-4 sm:mb-8 sm:mt-12">
                <span className="font-mono text-xs tracking-widest text-cyber-accent">
                  {'// previously'}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-cyber-primary/10" />
              </div>
            )}

            {/* Single left rail. The rail (1px at x 7-8) and the 15px nodes
                (x 0-15) share the wrapper's left edge, so both centre on 7.5px. */}
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[7px] top-2 w-px bg-cyber-primary/10"
              />
              <span
                aria-hidden="true"
                className="rail-draw absolute bottom-0 left-[7px] top-2 w-px bg-cyber-brand/60"
              />

              <ol className="relative">
              {pastJobs.map((job) => (
                <li key={jobKey(job)} className="relative pb-8 pl-8 last:pb-0 sm:pb-10 sm:pl-10">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-[3px] h-[15px] w-[15px] rounded-full border-2 border-cyber-brand/70 bg-cyber-darker"
                  />

                  <Reveal className="md:grid md:grid-cols-[9.5rem_minmax(0,1fr)] md:gap-6">
                    <p className="mb-2 font-mono text-xs leading-5 text-cyber-accent md:mb-0">
                      {job.period}
                    </p>

                    <SpotlightCard className="cyber-card rounded-lg p-4 sm:p-5 md:p-6">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h3 className="text-lg font-bold text-white break-words sm:text-xl">
                          {job.title}
                        </h3>
                        <TypeChip type={job.type} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-cyber-secondary sm:text-base">
                        {job.company}
                      </p>

                      <div className="mb-4 mt-2 flex items-center gap-2 text-xs text-cyber-accent sm:text-sm">
                        <MapPin
                          size={14}
                          className="flex-shrink-0 text-cyber-primary"
                          aria-hidden="true"
                        />
                        <span className="break-words">{job.location}</span>
                      </div>

                      {job.summary && (
                        <p className="mb-3 text-sm leading-relaxed text-cyber-secondary sm:text-[15px]">
                          {job.summary}
                        </p>
                      )}

                      <Highlights items={job.highlights} />
                    </SpotlightCard>
                  </Reveal>
                </li>
              ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
