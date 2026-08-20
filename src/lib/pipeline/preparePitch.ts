import { deepAnalyze, type DeepAnalyzeStep } from '../ai/deepAnalyze';
import { query } from '../db/pool';
import { generateDemo } from '../demo/generate';
import { logger } from '../logger';
import { generateOutreach, type OutreachRecord } from '../outreach/generate';
import { getBusiness } from '../repo/businesses';
import type { OutreachChannel, OutreachLanguage } from '../outreach/compose';

/**
 * Everything needed to approach one prospect, in a single action.
 *
 * The four steps were already possible individually — audit, analyse, build a
 * concept, draft a message — but only as separate buttons pressed in the right
 * order, where the wrong order silently produced worse output. Drafting before
 * auditing yields a message that can cite nothing; building a concept before
 * analysing loses the positioning the model inferred.
 *
 * This runs them in the order the data requires, so that order stops being
 * something a person has to remember.
 */
export interface PitchResult {
  businessId: string;
  steps: DeepAnalyzeStep[];
  opportunity: number | null;
  demo: { slug: string; url: string; title: string } | null;
  outreach: OutreachRecord | null;
  completed: boolean;
}

export interface PreparePitchOptions {
  language?: OutreachLanguage;
  channel?: OutreachChannel;
  senderName?: string;
  /** Skip the model and use the deterministic composer — used by tests. */
  deterministicOnly?: boolean;
}

export async function preparePitch(
  businessId: string,
  options: PreparePitchOptions = {},
): Promise<PitchResult | null> {
  const business = await getBusiness(businessId);
  if (!business) return null;

  /*
   * Analysis first, and it is the only slow step: it refreshes the website
   * record, runs the technical audit, rescores and reindexes. The two steps
   * after it read what it produced.
   */
  const analysis = await deepAnalyze(businessId);
  const steps: DeepAnalyzeStep[] = [...analysis.steps];

  const track = async <T>(
    name: string,
    fn: () => Promise<{ status: DeepAnalyzeStep['status']; detail: string; value?: T }>,
  ): Promise<T | undefined> => {
    const started = Date.now();
    try {
      const outcome = await fn();
      steps.push({
        step: name,
        status: outcome.status,
        detail: outcome.detail,
        durationMs: Date.now() - started,
      });
      return outcome.value;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      steps.push({ step: name, status: 'failed', detail, durationMs: Date.now() - started });
      logger.warn('prepare pitch step failed', { businessId, step: name, error: detail });
      return undefined;
    }
  };

  const demo = await track('generate_demo', async () => {
    const generated = await generateDemo(businessId);
    return {
      status: 'ok' as const,
      detail: `Concept ready at ${generated.url}`,
      value: { slug: generated.slug, url: generated.url, title: generated.title },
    };
  });

  if (demo) {
    await query(
      `INSERT INTO crm_activity (business_id, kind, message) VALUES ($1, 'demo_generated', $2)`,
      [businessId, demo.url],
    ).catch(() => undefined);
  }

  /*
   * Outreach runs last so it can cite the audit findings the first step
   * produced. Running it earlier is what made the "not audited yet" angle fire
   * on prospects that were about to be audited seconds later.
   */
  const outreach = await track('draft_outreach', async () => {
    const record = await generateOutreach(businessId, {
      language: options.language ?? 'es',
      channel: options.channel ?? 'email',
      senderName: options.senderName,
      deterministicOnly: options.deterministicOnly,
    });
    if (!record) return { status: 'failed' as const, detail: 'Prospect not found' };
    return {
      status: 'ok' as const,
      detail: `Drafted by ${record.generator}, angle: ${record.angle}`,
      value: record,
    };
  });

  return {
    businessId,
    steps,
    opportunity: analysis.opportunity,
    demo: demo ?? null,
    outreach: outreach ?? null,
    // "Completed" means there is something to act on: a concept to show and a
    // message to send. A skipped AI step does not make the pitch unusable.
    completed: demo !== undefined && outreach !== undefined,
  };
}
