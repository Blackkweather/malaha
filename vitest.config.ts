import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Pick up TEST_DATABASE_URL from the local env files, the same precedence Next
// applies, so it can be set once alongside the other credentials.
for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override: false });
}

/**
 * Tests run against a dedicated database so a run can never disturb the
 * development data. The setup file creates it on first use.
 *
 * The default is the local Docker instance. Set TEST_DATABASE_URL to point the
 * suite at any other server — a hosted Postgres, a CI service container —
 * because requiring Docker meant the suite simply could not be run on a machine
 * without it. Give it its own database name: the setup file creates and
 * migrates whatever database the URL names.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://prospect:prospect@localhost:5544/prospect_finder_test';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      GROQ_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GOOGLE_PLACES_API_KEY: '',
      API_TOKENS: 'test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      REQUIRE_AUTH_FOR_READS: 'false',
      RATE_LIMIT_MAX_READS: '100000',
      RATE_LIMIT_MAX_WRITES: '100000',
    },
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
});
