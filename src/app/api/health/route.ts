import { claudeEnabled, config, googlePlacesEnabled, groqEnabled } from '@/lib/config';
import { pingDatabase, queryOne } from '@/lib/db/pool';
import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';

export const dynamic = 'force-dynamic';

/** Liveness and configuration report. Never returns secret values. */
export const GET = withGuard('read', async () => {
  const db = await pingDatabase();

  let indexed = 0;
  let migrations = 0;
  if (db.ok) {
    const counts = await queryOne<{ indexed: string; migrations: string }>(
      `SELECT
         (SELECT count(*) FROM search_index)::text AS indexed,
         (SELECT count(*) FROM schema_migrations)::text AS migrations`,
    ).catch(() => null);
    indexed = Number(counts?.indexed ?? 0);
    migrations = Number(counts?.migrations ?? 0);
  }

  const healthy = db.ok && migrations > 0;

  return ok(
    {
      status: healthy ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      database: { connected: db.ok, latencyMs: db.latencyMs, migrationsApplied: migrations },
      searchIndex: { indexed },
      scope: { city: config.geo.city, minLocationConfidence: config.geo.minLocationConfidence },
      search: {
        defaultLimit: config.search.defaultLimit,
        maxLimit: config.search.maxLimit,
        minOpportunityScore: config.search.minOpportunityScore,
      },
      weights: config.weights,
      providers: {
        groq: groqEnabled() ? 'configured' : 'not_configured',
        claude: claudeEnabled() ? 'configured' : 'not_configured',
        googlePlaces: googlePlacesEnabled() ? 'configured' : 'not_configured',
        openstreetmap: 'configured',
        playwright: config.audit.enablePlaywright ? 'enabled' : 'disabled',
      },
    },
    { status: healthy ? 200 : 503 },
  );
});
