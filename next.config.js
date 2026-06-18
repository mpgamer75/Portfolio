/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.credly.com https://*.credly.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.credly.com https://*.credly.com",
      "font-src 'self' data:",
      "connect-src 'self' https://vitals.vercel-insights.com https://*.credly.com",
      "frame-src https://www.credly.com https://embed.credly.com https://*.credly.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  turbopack: { root: __dirname },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Allowed next/image quality values (Next 16 requires declaring these):
    // 50 = mobile project cards, 75 = desktop cards/default, 90 = About photo.
    qualities: [50, 75, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.credly.com' },
      { protocol: 'https', hostname: 'www.credly.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
