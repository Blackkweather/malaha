/**
 * Environment loading for the CLI scripts.
 *
 * Next.js loads `.env.local` and `.env` itself, but `tsx scripts/*.ts` does not.
 * `.env.local` is what `vercel env pull` writes, so it holds the real hosted
 * credentials and must win over the checked-in `.env` defaults — which is the
 * same precedence Next.js applies.
 *
 * Import this as the FIRST line of any script:  import '../src/lib/env';
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const FILES = ['.env.local', '.env'] as const;

for (const file of FILES) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  // `override: false` means the first file to define a key keeps it, so the
  // .env.local values loaded first are never clobbered by .env.
  dotenv.config({ path: full, override: false });
}
