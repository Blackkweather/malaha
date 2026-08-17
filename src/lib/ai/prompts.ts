/**
 * Evidence packaging and prompt construction.
 *
 * Both providers receive a compact, factual evidence package built only from
 * public information already stored in the database. Prompts demand strict JSON
 * so the output can be validated before it is trusted.
 */

export interface EvidencePackage {
  business: {
    name: string;
    category: string;
    categoryLabel: string;
    city: string | null;
    postalCode: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
  };
  reputation: {
    rating: number | null;
    reviewCount: number | null;
    sources: string[];
  };
  scores: {
    businessQuality: number;
    commercialValue: number;
    digitalOpportunity: number;
    opportunity: number;
  };
  website: {
    reachable: boolean;
    verdict: string | null;
    metrics: Record<string, unknown> | null;
    issues: { code: string; title: string; severity: string }[];
    pages: { url: string; type: string; title: string | null; excerpt: string }[];
  } | null;
  socialProfiles: { platform: string; url: string }[];
}

export const GROQ_SYSTEM_PROMPT = `You are a business analyst for a web design agency in Malaga, Spain.
You classify businesses and extract structured facts from public evidence.
You never invent facts. If the evidence does not support a field, use null or an empty array.
You reply with a single JSON object and nothing else. No markdown, no code fences, no commentary.`;

export function buildGroqPrompt(evidence: EvidencePackage): string {
  return `Analyse this Malaga business as a potential website/redesign client.

EVIDENCE (all of it is public information):
${JSON.stringify(evidence, null, 1)}

Return exactly this JSON shape:
{
  "categoryNormalized": string,
  "categoryConfidence": number,
  "services": string[],
  "targetCustomer": string,
  "websiteSummary": string,
  "issueClassification": [
    { "code": string, "area": "mobile"|"conversion"|"seo"|"performance"|"trust"|"modernity"|"accessibility", "impact": "low"|"medium"|"high", "explanation": string }
  ],
  "opportunitySignals": string[],
  "estimatedProjectValue": "low"|"medium"|"high"|"very_high",
  "recommendForDeepAnalysis": boolean,
  "confidence": number
}

Rules:
- "services" must come from the website text or the category, never guessed.
- "websiteSummary" is at most 2 sentences describing the CURRENT site. If there is no website, say so plainly.
- "opportunitySignals" are concrete, evidence-backed reasons this business is worth approaching.
- "confidence" and "categoryConfidence" are between 0 and 1.
- "recommendForDeepAnalysis" is true only when the business looks genuinely strong AND has visible website upside.`;
}

export const CLAUDE_SYSTEM_PROMPT = `You are a senior web design consultant preparing a prospect brief for an agency in Malaga, Spain.
You write for a designer who will decide whether to approach this business and what to say.
You are specific, commercially minded and honest — if a prospect is weak, you say so.
You never invent facts about the business. You reply with a single JSON object and nothing else.`;

export function buildClaudePrompt(evidence: EvidencePackage, groqAnalysis: unknown): string {
  return `Produce a prospect brief for this Malaga business.

PUBLIC EVIDENCE:
${JSON.stringify(evidence, null, 1)}

FAST-PASS ANALYSIS (from a smaller model; verify rather than trust):
${JSON.stringify(groqAnalysis, null, 1)}

Return exactly this JSON shape:
{
  "currentWebsiteExperience": string,
  "businessPositioning": string,
  "strongestOpportunities": [ { "title": string, "why": string, "impact": "low"|"medium"|"high" } ],
  "customerJourneyFriction": string[],
  "redesignPriorities": [ { "priority": number, "item": string, "rationale": string } ],
  "recommendedSiteStructure": [ { "page": string, "purpose": string } ],
  "recommendedPrimaryCta": string,
  "salesAngle": string,
  "whyWorthApproaching": string,
  "risks": string[],
  "verdict": "strong"|"moderate"|"weak",
  "confidence": number
}

Rules:
- "currentWebsiteExperience" must describe what the audit actually found. If there is no website, describe the consequence of that absence.
- "salesAngle" is the single most persuasive opening for a cold approach, in 1-2 sentences.
- "whyWorthApproaching" must reference concrete evidence (review volume, rating, category value, specific website failures).
- "risks" lists reasons this prospect might NOT be worth the effort. Never leave it empty without cause.
- "verdict" is your honest overall judgement.
- "confidence" is between 0 and 1.`;
}

/** Trims an evidence package so prompts stay small and cheap. */
export function compactEvidence(evidence: EvidencePackage): EvidencePackage {
  if (!evidence.website) return evidence;
  return {
    ...evidence,
    website: {
      ...evidence.website,
      issues: evidence.website.issues.slice(0, 15),
      pages: evidence.website.pages.slice(0, 5).map((p) => ({
        ...p,
        excerpt: p.excerpt.slice(0, 700),
      })),
    },
  };
}
