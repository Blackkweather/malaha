import { config, groqEnabled } from '../config';
import { query, queryOne } from '../db/pool';
import { logger } from '../logger';
import { extractJson } from '../ai/json';
import { getBusinessDetail, type BusinessDetail } from '../repo/businesses';
import {
  composeMessage,
  evidenceLines,
  pickAngle,
  type ComposedMessage,
  type OutreachChannel,
  type OutreachEvidence,
  type OutreachLanguage,
} from './compose';

export const OUTREACH_PROMPT_VERSION = 1;

/** Collapses the full business record into only what outreach may cite. */
export function buildOutreachEvidence(detail: BusinessDetail): OutreachEvidence {
  const best = detail.reviews.reduce<BusinessDetail['reviews'][number] | null>(
    (acc, r) => (acc === null || (r.review_count ?? 0) > (acc.review_count ?? 0) ? r : acc),
    null,
  );

  const hasWebsite = detail.business.website_url !== null;
  const issueCodes = detail.issues.map((i) => i.code);

  /*
   * A business with no website has no audit, and therefore no rows in
   * website_issues — so the findings list comes back empty and looks exactly
   * like a site that was audited and passed. That is a fact we hold, not one
   * we have to infer, so state it explicitly rather than letting an absence of
   * evidence read as evidence of absence.
   */
  if (!hasWebsite && issueCodes.length === 0) {
    issueCodes.push(detail.socials.length > 0 ? 'social_only_presence' : 'no_website');
  }

  return {
    name: detail.business.name,
    category: detail.business.category,
    city: detail.business.city ?? config.geo.city,
    hasWebsite,
    websiteUrl: detail.business.website_url,
    domain: detail.business.domain,
    issueCodes,
    // No website is a complete picture; a website nobody has crawled is not.
    audited: !hasWebsite || detail.audit !== null,
    rating: best?.rating ?? null,
    reviewCount: best?.review_count ?? null,
    opportunity: detail.score?.opportunity ?? null,
    digitalOpportunity: detail.score?.digital_opportunity ?? null,
  };
}

const SYSTEM_PROMPT = `You write short B2B outreach for a web design studio in Malaga, Spain.

Absolute rules:
- You may ONLY reference facts present in the EVIDENCE block. Never invent a
  detail about the business, its website, its clients or its results.
- If the evidence lists no website problems, do not claim there are any.
- No invented statistics, no "we helped X grow Y%", no fake urgency, no
  flattery that could not be verified from the evidence.
- Write in the requested language, natural for a Spanish local business owner.
- Short. The reader is busy. Lead with the specific observation, not with you.
- Include a plain opt-out sentence.

Return ONLY JSON: {"subject": string, "body": string}`;

function buildUserPrompt(
  evidence: OutreachEvidence,
  angle: string,
  supportingCodes: string[],
  options: { language: OutreachLanguage; channel: OutreachChannel; senderName: string },
): string {
  const findings = evidenceLines(supportingCodes, options.language);

  return [
    'EVIDENCE',
    JSON.stringify(
      {
        business: evidence.name,
        category: evidence.category,
        city: evidence.city,
        website: evidence.websiteUrl,
        hasWebsite: evidence.hasWebsite,
        publicRating: evidence.rating,
        publicReviewCount: evidence.reviewCount,
        websiteHasBeenAudited: evidence.audited,
        auditFindings: findings,
        allObservedIssueCodes: evidence.issueCodes,
      },
      null,
      2,
    ),
    '',
    ...(evidence.audited
      ? []
      : [
          'The website has NOT been audited. You know nothing about its quality.',
          'Do not praise it, do not criticise it, do not describe it at all.',
          'Offer to review it instead.',
          '',
        ]),
    `LEAD ANGLE: ${angle}`,
    `CHANNEL: ${options.channel}`,
    `LANGUAGE: ${options.language === 'es' ? 'Spanish (Spain)' : 'English'}`,
    `SENDER NAME: ${options.senderName}`,
    '',
    options.channel === 'call_script'
      ? 'Write a phone call script with clear labelled sections.'
      : options.channel === 'whatsapp'
        ? 'Write a WhatsApp message under 80 words.'
        : options.channel === 'linkedin'
          ? 'Write a LinkedIn connection note under 60 words.'
          : 'Write an email under 160 words.',
  ].join('\n');
}

async function writeWithGroq(
  evidence: OutreachEvidence,
  angle: string,
  supportingCodes: string[],
  options: { language: OutreachLanguage; channel: OutreachChannel; senderName: string },
): Promise<ComposedMessage | null> {
  if (!groqEnabled()) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.groq.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.groq.model,
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(evidence, angle, supportingCodes, options) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq returned ${response.status}`);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = extractJson(payload.choices?.[0]?.message?.content ?? '');
    if (typeof raw !== 'object' || raw === null) return null;

    const o = raw as Record<string, unknown>;
    const subject = typeof o.subject === 'string' ? o.subject.trim() : '';
    const body = typeof o.body === 'string' ? o.body.trim() : '';

    // A model that returns an empty or stub message must not silently replace
    // the deterministic copy, which is always usable.
    if (subject.length < 5 || body.length < 60) return null;

    return { subject, body };
  } catch (err) {
    logger.warn('outreach generation via Groq failed; using deterministic copy', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface OutreachRecord {
  id: string;
  businessId: string;
  channel: OutreachChannel;
  language: OutreachLanguage;
  subject: string;
  body: string;
  angle: string;
  evidence: string[];
  generator: 'groq' | 'deterministic';
  model: string | null;
  createdAt: string;
}

export interface GenerateOutreachOptions {
  language?: OutreachLanguage;
  channel?: OutreachChannel;
  senderName?: string;
  /** Skip the model even when configured — used by tests and "template only" mode. */
  deterministicOnly?: boolean;
}

/**
 * Generates one outreach message for a business and stores it.
 *
 * The model is an enhancement, never a dependency: if Groq is unconfigured,
 * failing, or returns something unusable, the deterministic composer produces
 * the message instead and the caller cannot tell the difference apart from the
 * recorded `generator`.
 */
export async function generateOutreach(
  businessId: string,
  options: GenerateOutreachOptions = {},
): Promise<OutreachRecord | null> {
  const detail = await getBusinessDetail(businessId);
  if (!detail) return null;

  const language = options.language ?? 'es';
  const channel = options.channel ?? 'email';
  const senderName = options.senderName?.trim() || (language === 'es' ? '[tu nombre]' : '[your name]');

  const evidence = buildOutreachEvidence(detail);
  const selection = pickAngle(evidence);

  const fromModel = options.deterministicOnly
    ? null
    : await writeWithGroq(evidence, selection.angle, selection.supportingCodes, {
        language,
        channel,
        senderName,
      });

  const message = fromModel ?? composeMessage(evidence, selection, { language, channel, senderName });
  const generator = fromModel ? 'groq' : 'deterministic';

  const row = await queryOne<{ id: string; created_at: Date }>(
    `INSERT INTO outreach_messages
       (business_id, channel, language, subject, body, angle, evidence, generator, model, prompt_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING id, created_at`,
    [
      businessId,
      channel,
      language,
      message.subject,
      message.body,
      selection.angle,
      JSON.stringify(selection.supportingCodes),
      generator,
      fromModel ? config.ai.groq.model : null,
      OUTREACH_PROMPT_VERSION,
    ],
  );
  if (!row) throw new Error('Failed to store the generated outreach message');

  await query(
    `INSERT INTO crm_activity (business_id, kind, message) VALUES ($1, 'outreach_generated', $2)`,
    [businessId, `${channel} / ${language} — angle: ${selection.angle}`],
  );

  return {
    id: row.id,
    businessId,
    channel,
    language,
    subject: message.subject,
    body: message.body,
    angle: selection.angle,
    evidence: selection.supportingCodes,
    generator,
    model: fromModel ? config.ai.groq.model : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Messages already generated for a business, newest first. */
export async function listOutreachForBusiness(businessId: string): Promise<OutreachRecord[]> {
  const rows = await query<{
    id: string;
    business_id: string;
    channel: OutreachChannel;
    language: OutreachLanguage;
    subject: string;
    body: string;
    angle: string | null;
    evidence: unknown;
    generator: 'groq' | 'deterministic';
    model: string | null;
    created_at: Date;
  }>(
    `SELECT id, business_id, channel, language, subject, body, angle, evidence, generator, model, created_at
       FROM outreach_messages WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [businessId],
  );

  return rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    channel: r.channel,
    language: r.language,
    subject: r.subject,
    body: r.body,
    angle: r.angle ?? 'polish',
    evidence: Array.isArray(r.evidence) ? (r.evidence as string[]) : [],
    generator: r.generator,
    model: r.model,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
