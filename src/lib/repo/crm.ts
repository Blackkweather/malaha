import { query, queryOne } from '../db/pool';

export const CRM_STATUSES = [
  'new',
  'shortlisted',
  'contacted',
  'meeting',
  'proposal',
  'won',
  'lost',
  'rejected',
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];

export interface CrmEntry {
  businessId: string;
  businessName: string;
  status: CrmStatus;
  owner: string | null;
  notes: string | null;
  nextActionAt: Date | null;
  opportunity: number | null;
  updatedAt: Date;
}

export function isCrmStatus(value: unknown): value is CrmStatus {
  return typeof value === 'string' && (CRM_STATUSES as readonly string[]).includes(value);
}

export async function setCrmStatus(input: {
  businessId: string;
  status: CrmStatus;
  owner?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
}): Promise<CrmEntry | null> {
  await query(
    `INSERT INTO crm_status (business_id, status, owner, notes, next_action_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (business_id) DO UPDATE SET
       status         = EXCLUDED.status,
       owner          = COALESCE(EXCLUDED.owner, crm_status.owner),
       notes          = COALESCE(EXCLUDED.notes, crm_status.notes),
       next_action_at = COALESCE(EXCLUDED.next_action_at, crm_status.next_action_at),
       updated_at     = now()`,
    [
      input.businessId,
      input.status,
      input.owner ?? null,
      input.notes ?? null,
      input.nextActionAt ?? null,
    ],
  );
  return getCrmEntry(input.businessId);
}

export async function getCrmEntry(businessId: string): Promise<CrmEntry | null> {
  return queryOne<CrmEntry>(
    `SELECT c.business_id AS "businessId", b.name AS "businessName", c.status, c.owner, c.notes,
            c.next_action_at AS "nextActionAt", ls.opportunity, c.updated_at AS "updatedAt"
       FROM crm_status c
       JOIN businesses b ON b.id = c.business_id
       LEFT JOIN lead_scores ls ON ls.business_id = c.business_id
      WHERE c.business_id = $1`,
    [businessId],
  );
}

export async function listCrm(status?: CrmStatus): Promise<CrmEntry[]> {
  const filter = status ? 'WHERE c.status = $1' : '';
  const params = status ? [status] : [];
  return query<CrmEntry>(
    `SELECT c.business_id AS "businessId", b.name AS "businessName", c.status, c.owner, c.notes,
            c.next_action_at AS "nextActionAt", ls.opportunity, c.updated_at AS "updatedAt"
       FROM crm_status c
       JOIN businesses b ON b.id = c.business_id
       LEFT JOIN lead_scores ls ON ls.business_id = c.business_id
       ${filter}
      ORDER BY COALESCE(ls.opportunity, 0) DESC, c.updated_at DESC
      LIMIT 500`,
    params,
  );
}

export async function crmCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; count: string }>(
    'SELECT status, count(*)::text AS count FROM crm_status GROUP BY status',
  );
  const counts: Record<string, number> = {};
  for (const status of CRM_STATUSES) counts[status] = 0;
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}
