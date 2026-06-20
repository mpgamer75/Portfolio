'use client';

import Image from 'next/image';
import { Terminal, Code2, Shield, ShieldCheck } from 'lucide-react';
import type { Project } from '@/components/sections/projectsData';
import { BLUR_DATA_URL } from '@/lib/images';

/** Deterministic glyph for the image-less fallback, keyed off the lead tech. */
function GlyphIcon({ tech, size }: { tech: string; size: number }) {
  const t = tech.toLowerCase();
  const cls = 'relative text-cyber-brand';
  if (t.includes('bash') || t.includes('terminal') || t.includes('cli')) {
    return <Terminal className={cls} size={size} />;
  }
  if (t.includes('osint') || t.includes('crypto') || t.includes('openssl') || t.includes('security')) {
    return <ShieldCheck className={cls} size={size} />;
  }
  if (t.includes('python') || t.includes('next') || t.includes('java') || t.includes('script') || t.includes('react')) {
    return <Code2 className={cls} size={size} />;
  }
  return <Shield className={cls} size={size} />;
}

interface ProjectPreviewProps {
  project: Project;
  isMobile?: boolean;
  priority?: boolean;
}

/**
 * The preview surface for a project: the first screenshot (blur-up) when available,
 * otherwise an on-brand generated card (solid emerald tint + lead tech). Must sit in
 * a `relative`, sized parent.
 */
export default function ProjectPreview({ project, isMobile, priority }: ProjectPreviewProps) {
  const hasImage = !!project.imagePaths && project.imagePaths.length > 0;

  if (hasImage) {
    return (
      <Image
        src={project.imagePaths![0]}
        alt=""
        fill
        className="object-contain p-1"
        sizes="(max-width: 640px) 50vw, 320px"
        priority={priority}
        quality={isMobile ? 50 : 75}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cyber-darker cyber-grid" aria-hidden="true">
      <div className="absolute inset-0 bg-cyber-brand/5" />
      <GlyphIcon tech={project.tech[0] || ''} size={isMobile ? 26 : 34} />
      <div className="relative flex flex-wrap justify-center gap-1 px-2">
        {project.tech.slice(0, 2).map((t) => (
          <span key={t} className="text-[8px] sm:text-[10px] font-mono text-cyber-brand/90">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
