import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/lib/db/pool';
import {
  claimNextJob,
  completeJob,
  enqueueJob,
  enqueueWebsiteJobsForAll,
  failJob,
  listRecentEvents,
} from '../src/lib/pipeline/jobs';
import { loadFixtures, MALAGA_FIXTURES, resetDatabase } from './helpers/fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('job queue', () => {
  it('claims jobs in priority order', async () => {
    await enqueueJob({ jobType: 'refresh_index', priority: 200 });
    await enqueueJob({ jobType: 'rescore_all', priority: 10 });

    const first = await claimNextJob();
    expect(first?.job_type).toBe('rescore_all');

    const second = await claimNextJob();
    expect(second?.job_type).toBe('refresh_index');

    expect(await claimNextJob()).toBeNull();
  });

  it('marks a claimed job as running and counts the attempt', async () => {
    await enqueueJob({ jobType: 'rescore_all' });
    const job = await claimNextJob();
    expect(job?.attempts).toBe(1);

    const rows = await query<{ status: string }>('SELECT status FROM crawl_jobs WHERE id = $1', [
      job?.id,
    ]);
    expect(rows[0].status).toBe('running');
  });

  it('completes a job and records the outcome', async () => {
    await enqueueJob({ jobType: 'refresh_index' });
    const job = await claimNextJob();
    await completeJob(job!.id, 'indexed 3');

    const rows = await query<{ status: string; error: string | null }>(
      'SELECT status, error FROM crawl_jobs WHERE id = $1',
      [job!.id],
    );
    expect(rows[0].status).toBe('done');
    expect(rows[0].error).toBeNull();

    const events = await listRecentEvents(10);
    expect(events.some((e) => e.message.includes('indexed 3'))).toBe(true);
  });

  it('requeues a failed job with a backoff until attempts run out', async () => {
    await enqueueJob({ jobType: 'rescore_all', maxAttempts: 2 });

    const first = await claimNextJob();
    await failJob(first!, 'temporary network error');
    let rows = await query<{ status: string }>('SELECT status FROM crawl_jobs WHERE id = $1', [
      first!.id,
    ]);
    expect(rows[0].status).toBe('queued');

    // The backoff means it is not immediately claimable.
    expect(await claimNextJob()).toBeNull();

    await query("UPDATE crawl_jobs SET scheduled_at = now() WHERE id = $1", [first!.id]);
    const second = await claimNextJob();
    expect(second?.attempts).toBe(2);

    await failJob(second!, 'still failing');
    rows = await query<{ status: string }>('SELECT status FROM crawl_jobs WHERE id = $1', [first!.id]);
    expect(rows[0].status).toBe('failed');
  });

  it('queues one website job per in-scope business and does not duplicate them', async () => {
    await loadFixtures(MALAGA_FIXTURES);

    const queued = await enqueueWebsiteJobsForAll();
    expect(queued).toBe(MALAGA_FIXTURES.length);

    const again = await enqueueWebsiteJobsForAll();
    expect(again).toBe(0);
  });
});
