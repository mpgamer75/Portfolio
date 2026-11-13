import Image from 'next/image';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';
import type { Certification } from '@/components/sections/certificationsData';

interface CertificationCardProps {
  certification: Certification;
}

/**
 * One horizontal certification card, identical for every entry: an 80px media
 * slot (local badge image, or a procedural emblem tile), the full untruncated
 * name, issuer/date in mono, optional skill chips and a footer row. The footer
 * always carries a "Certified" status, so a card with no verify link still
 * reads as complete; the Verify link is added only when a URL exists.
 *
 * Renders an <li> — use inside a list. Hover is border/glow only (.cyber-card).
 */
export default function CertificationCard({ certification }: CertificationCardProps) {
  const { name, subtitle, issuer, issued, credentialId, verifyUrl, skills, media } = certification;

  return (
    <SpotlightCard as="li" className="cyber-card group flex h-full flex-col rounded-lg p-4 sm:p-5">
      <div className="flex items-start gap-4">
        {/* Media slot */}
        <div
          aria-hidden="true"
          className="glare flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-cyber-brand/25 bg-cyber-brand/10"
        >
          {media.kind === 'image' ? (
            <Image src={media.src} alt="" fill sizes="80px" className="object-contain p-1.5" />
          ) : (
            <span className="flex flex-col items-center gap-1.5">
              <ShieldCheck size={26} className="text-cyber-brand" />
              <span className="font-mono text-[11px] font-bold leading-none tracking-wider text-cyber-brand">
                {media.code}
              </span>
            </span>
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-base font-bold leading-snug text-white">{name}</h4>
          {subtitle && (
            <p className="mt-1 text-sm leading-snug text-cyber-secondary">{subtitle}</p>
          )}
          <p className="mt-2 font-mono text-xs text-cyber-accent">
            {issuer}
            {issued && <span> · {issued}</span>}
          </p>
          {credentialId && (
            <p className="mt-1 break-all font-mono text-xs text-cyber-accent">ID {credentialId}</p>
          )}
        </div>
      </div>

      {skills && skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills covered">
          {skills.map((skill) => (
            <li
              key={skill}
              className="rounded-md border border-cyber-primary/15 bg-cyber-darker px-2 py-1 font-mono text-xs text-cyber-secondary"
            >
              {skill}
            </li>
          ))}
        </ul>
      )}

      {/* Footer — pinned to the bottom so the cards in a row line up. */}
      <div className="mt-auto pt-4">
        <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-cyber-primary/10 pt-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-cyber-brand">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyber-brand" />
            Certified
          </span>
          {verifyUrl && (
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Verify ${name} (opens in a new tab)`}
              className="-mr-1 inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 font-mono text-xs text-cyber-secondary transition-colors hover:text-cyber-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
            >
              Verify
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}
