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
  /**
   * Layout-px sizing for hosts that are CSS-scaled up (the Folder's papers render
   * at 2-3×), so the fallback glyph + tags read at a sane size on screen.
   */
  dense?: boolean;
}

/**
 * The preview surface for a project: the first screenshot (blur-up) when available,
 * otherwise an on-brand generated card (solid emerald tint + lead tech). Must sit in
 * a `relative`, sized parent.
 */
export default function ProjectPreview({ project, isMobile, priority, dense }: ProjectPreviewProps) {
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
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-cyber-darker cyber-grid ${
        dense ? 'gap-0.5' : 'gap-2'
      }`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-cyber-brand/5" />
      <GlyphIcon tech={project.tech[0] || ''} size={dense ? 12 : isMobile ? 26 : 34} />
      <div className={`relative flex flex-wrap justify-center ${dense ? 'gap-0.5 px-1' : 'gap-1 px-2'}`}>
        {project.tech.slice(0, dense ? 1 : 2).map((t) => (
          <span key={t} className={`font-mono leading-none text-cyber-brand/90 ${dense ? 'text-[6px]' : 'text-xs'}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
