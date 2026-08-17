import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pg', 'playwright'],
  /*
   * Migrations are read from disk at runtime (src/lib/db/migrate.ts), so the
   * .sql files have to travel with the deployed functions. Without this the
   * bundler sees no import of them and the lazy schema check finds an empty
   * migrations directory in production.
   */
  outputFileTracingIncludes: {
    '/api/**': ['./src/lib/db/migrations/**'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
