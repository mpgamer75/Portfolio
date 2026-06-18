'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';

/**
 * Global button click FX. A single pointer-events:none listener that, on a
 * click landing inside any `.cyber-button`, renders a one-shot overlay at the
 * button's rect:
 *  - standard buttons  -> an emerald scanline sweep + corner reticle
 *  - `[data-fx="download"]` (the Download-CV CTAs) -> a "DOWNLOADING…" mask
 *    with a short emerald binary/hex data-stream raining out the bottom.
 *
 * Overlays are GPU-only (transform/opacity), self-remove after their lifetime,
 * and never render when the user prefers reduced motion. The styles + keyframes
 * live in globals.css (`.btnfx-*`).
 */

type Glyph = { id: number; x: number; char: string; delay: number; duration: number };

type FX = {
  id: number;
  type: 'scan' | 'download';
  left: number;
  top: number;
  width: number;
  height: number;
  glyphs: Glyph[];
};

const HEX = '0123456789ABCDEF';
const SCAN_TTL = 420;
const DOWNLOAD_TTL = 920;

export default function ButtonFX() {
  const reduced = useReducedMotion();
  const [effects, setEffects] = useState<FX[]>([]);
  const idRef = useRef(0);
  // Match SSR on the first client render (null), then enable the portal after
  // hydration so the server/client trees agree. Hydration-safe and lint-clean.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (reduced) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest?.('.cyber-button') as HTMLElement | null;
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const isDownload = btn.matches('[data-fx="download"]');
      const id = (idRef.current += 1);

      const glyphs: Glyph[] = [];
      if (isDownload) {
        const count = Math.min(22, Math.max(10, Math.round(rect.width / 13)));
        for (let i = 0; i < count; i++) {
          glyphs.push({
            id: i,
            x: Math.random() * 100,
            char: HEX[Math.floor(Math.random() * HEX.length)],
            delay: Math.random() * 200,
            duration: 460 + Math.random() * 320,
          });
        }
      }

      setEffects((prev) => [
        ...prev,
        {
          id,
          type: isDownload ? 'download' : 'scan',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          glyphs,
        },
      ]);

      window.setTimeout(
        () => setEffects((prev) => prev.filter((fx) => fx.id !== id)),
        isDownload ? DOWNLOAD_TTL : SCAN_TTL,
      );
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [reduced]);

  if (reduced || !hydrated || typeof document === 'undefined') return null;

  return createPortal(
    <div className="btnfx-root" aria-hidden="true">
      {effects.map((fx) => (
        <div
          key={fx.id}
          className="btnfx-layer"
          style={
            {
              left: fx.left,
              top: fx.top,
              width: fx.width,
              height: fx.height,
              '--fxh': `${fx.height}px`,
            } as CSSProperties
          }
        >
          {fx.type === 'scan' ? (
            <>
              <span className="btnfx-scan-clip">
                <span className="btnfx-scan" />
              </span>
              <span className="btnfx-corner btnfx-corner--tl" />
              <span className="btnfx-corner btnfx-corner--tr" />
              <span className="btnfx-corner btnfx-corner--bl" />
              <span className="btnfx-corner btnfx-corner--br" />
            </>
          ) : (
            <>
              <span className="btnfx-dl-label">DOWNLOADING…</span>
              <span className="btnfx-stream">
                {fx.glyphs.map((g) => (
                  <span
                    key={g.id}
                    className="btnfx-glyph"
                    style={{
                      left: `${g.x}%`,
                      animationDelay: `${g.delay}ms`,
                      animationDuration: `${g.duration}ms`,
                    }}
                  >
                    {g.char}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
