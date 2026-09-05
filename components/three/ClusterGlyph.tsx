import type { ClusterGlyph as GlyphShape } from './skillsGraph';

interface ClusterGlyphProps {
  shape: GlyphShape;
  color: string;
  /** Rendered size in px (width = height). */
  size?: number;
  className?: string;
  /** Filled (solid) or outlined. Outlined mirrors the 3D hub emblem. */
  filled?: boolean;
}

const PATHS: Record<GlyphShape, string> = {
  circle: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17z',
  diamond: 'M12 2.5L21.5 12L12 21.5L2.5 12z',
  hexagon: 'M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z',
  triangle: 'M12 3l9.5 17h-19z',
};

/**
 * The domain emblem used everywhere a cluster is named outside the canvas —
 * legend chips, hub labels, the detail card — so shape + tint identify a domain
 * consistently, not colour alone.
 */
export default function ClusterGlyph({
  shape,
  color,
  size = 10,
  className,
  filled = false,
}: ClusterGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, filter: `drop-shadow(0 0 4px ${color})` }}
    >
      <path
        d={PATHS[shape]}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
