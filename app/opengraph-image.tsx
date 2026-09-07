import { ImageResponse } from 'next/og';

/**
 * Social share card (og:image), generated at build time. Replaces the previous
 * 3.9 MB raw 4:3 photo that was declared as a 1200×630 image: link previews
 * cropped it unpredictably and every unfurl downloaded the full JPEG.
 */

export const alt = 'Charles Lantigua Jorge — Cybersecurity Engineer & Developer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Same two-line break as the hero h1.
const NAME_LINES = ['Charles', 'Lantigua Jorge'];
const ROLE = 'Cybersecurity Engineer & Developer';
const TAGLINE = 'Offensive-security tooling · SOC automation · Threat detection';
// Same base-URL resolution as layout.tsx / sitemap.ts, shown as a bare host.
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
).replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * Pull JetBrains Mono (the site's display face) at build time so the card
 * matches the hero. Satori reads TTF/OTF/WOFF but not woff2, so we ask Google
 * Fonts with a legacy UA, which serves a plain .woff. Any failure (no network
 * in the build sandbox) falls back to the renderer's built-in font instead of
 * failing the build.
 */
async function loadDisplayFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:10.0) Gecko/20100101 Firefox/10.0' } },
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+\.(?:woff|ttf|otf))\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const mono = await loadDisplayFont();
  const display = mono ? 'JetBrains Mono' : 'sans-serif';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background:
            'linear-gradient(180deg, #050814 0%, #050814 55%, #08251f 100%)',
          color: '#FFFFFF',
          fontFamily: display,
          position: 'relative',
        }}
      >
        {/* Faint grid, echoing the hero's .cyber-grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Emerald glow band */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 90,
            height: 140,
            background:
              'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(52,211,153,0.45), rgba(52,211,153,0) 70%)',
          }}
        />

        {/* Top row: logo mark + site */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 28,
            color: '#B8C0D2',
          }}
        >
          <div style={{ display: 'flex', fontWeight: 700, color: '#FFFFFF' }}>{'<CL />'}</div>
          <div style={{ display: 'flex' }}>{SITE}</div>
        </div>

        {/* Name + role */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#B8C0D2', marginBottom: 12 }}>
            {"Hi, I'm"}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              marginBottom: 28,
            }}
          >
            {NAME_LINES.map((line) => (
              <div key={line} style={{ display: 'flex' }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 38, color: '#E5E7EB' }}>
            <span style={{ color: '#34D399', marginRight: 18, fontWeight: 700 }}>{'>'}</span>
            {ROLE}
          </div>
        </div>

        {/* Bottom row: tagline + accent bar */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              width: 96,
              height: 6,
              background: '#34D399',
              borderRadius: 3,
              marginBottom: 22,
              boxShadow: '0 0 18px rgba(52,211,153,0.6)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 24, color: '#B8C0D2' }}>{TAGLINE}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: mono
        ? [{ name: 'JetBrains Mono', data: mono, weight: 700, style: 'normal' }]
        : undefined,
    },
  );
}
