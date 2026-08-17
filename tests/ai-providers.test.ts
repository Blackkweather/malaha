import { describe, expect, it } from 'vitest';
import { validateGroqAnalysis } from '../src/lib/ai/groq';
import { validateClaudeAnalysis } from '../src/lib/ai/claude';
import type { EvidencePackage } from '../src/lib/ai/prompts';
import { buildClaudePrompt, buildGroqPrompt, compactEvidence } from '../src/lib/ai/prompts';

const EVIDENCE: EvidencePackage = {
  business: {
    name: 'Clinica Dental Fixture',
    category: 'dental_clinic',
    categoryLabel: 'Dental clinic',
    city: 'Malaga',
    postalCode: '29005',
    address: 'Calle Larios 1',
    phone: '+34951000101',
    email: 'info@fixture.example',
    website: 'https://fixture.example',
    description: null,
  },
  reputation: { rating: 4.9, reviewCount: 820, sources: ['google'] },
  scores: { businessQuality: 90, commercialValue: 96, digitalOpportunity: 62, opportunity: 80 },
  website: {
    reachable: true,
    verdict: 'weak mobile experience',
    metrics: { hasViewportMeta: false },
    issues: [{ code: 'no_mobile_viewport', title: 'Weak mobile experience', severity: 'high' }],
    pages: [
      { url: 'https://fixture.example/', type: 'home', title: 'Inicio', excerpt: 'x'.repeat(2000) },
    ],
  },
  socialProfiles: [{ platform: 'facebook', url: 'https://facebook.com/fixture' }],
};

describe('Groq output validation', () => {
  it('accepts a well-formed response', () => {
    const parsed = validateGroqAnalysis({
      categoryNormalized: 'dental_clinic',
      categoryConfidence: 0.9,
      services: ['implantes', 'ortodoncia'],
      targetCustomer: 'Adultos en Malaga',
      websiteSummary: 'Sitio anticuado.',
      issueClassification: [
        { code: 'no_mobile_viewport', area: 'mobile', impact: 'high', explanation: 'No responsive' },
      ],
      opportunitySignals: ['Alta reputacion'],
      estimatedProjectValue: 'high',
      recommendForDeepAnalysis: true,
      confidence: 0.8,
    });
    expect(parsed.services).toHaveLength(2);
    expect(parsed.recommendForDeepAnalysis).toBe(true);
    expect(parsed.issueClassification[0].impact).toBe('high');
  });

  it('repairs a malformed response rather than trusting it', () => {
    const parsed = validateGroqAnalysis({
      categoryConfidence: 99,
      services: 'not an array',
      estimatedProjectValue: 'astronomical',
      recommendForDeepAnalysis: 'yes',
      issueClassification: [{ area: 'mobile' }],
    });
    expect(parsed.categoryConfidence).toBe(1);
    expect(parsed.services).toEqual([]);
    expect(parsed.estimatedProjectValue).toBe('medium');
    expect(parsed.recommendForDeepAnalysis).toBe(false);
    expect(parsed.issueClassification).toEqual([]);
  });

  it('rejects a non-object response', () => {
    expect(() => validateGroqAnalysis('nope')).toThrow();
    expect(() => validateGroqAnalysis(null)).toThrow();
  });
});

describe('Claude output validation', () => {
  const VALID = {
    currentWebsiteExperience: 'Dated and hard to use on a phone.',
    businessPositioning: 'Established central clinic.',
    strongestOpportunities: [
      { title: 'Mobile rebuild', why: 'Most traffic is mobile', impact: 'high' },
    ],
    customerJourneyFriction: ['No online booking'],
    redesignPriorities: [{ priority: 1, item: 'Responsive layout', rationale: 'Baseline' }],
    recommendedSiteStructure: [{ page: 'Home', purpose: 'Convert' }],
    recommendedPrimaryCta: 'Pedir cita',
    salesAngle: 'Your reviews are excellent but the site loses phone visitors.',
    whyWorthApproaching: '820 reviews at 4.9 with a broken mobile experience.',
    risks: ['May already have an agency'],
    verdict: 'strong',
    confidence: 0.9,
  };

  it('accepts a well-formed response', () => {
    const parsed = validateClaudeAnalysis(VALID);
    expect(parsed.verdict).toBe('strong');
    expect(parsed.redesignPriorities[0].priority).toBe(1);
    expect(parsed.recommendedSiteStructure[0].page).toBe('Home');
  });

  it('falls back to a neutral verdict for an unknown value', () => {
    expect(validateClaudeAnalysis({ ...VALID, verdict: 'amazing' }).verdict).toBe('moderate');
  });

  it('rejects a response with no substance', () => {
    expect(() => validateClaudeAnalysis({ verdict: 'strong' })).toThrow(/core fields/);
  });

  it('drops malformed list entries', () => {
    const parsed = validateClaudeAnalysis({
      ...VALID,
      strongestOpportunities: [{ why: 'no title' }],
      redesignPriorities: [{ rationale: 'no item' }],
    });
    expect(parsed.strongestOpportunities).toEqual([]);
    expect(parsed.redesignPriorities).toEqual([]);
  });
});

describe('prompt construction', () => {
  it('trims oversized evidence before sending it', () => {
    const compact = compactEvidence(EVIDENCE);
    expect(compact.website?.pages[0].excerpt.length).toBeLessThanOrEqual(700);
  });

  it('carries the real evidence and demands strict JSON', () => {
    const groqPrompt = buildGroqPrompt(compactEvidence(EVIDENCE));
    expect(groqPrompt).toContain('Clinica Dental Fixture');
    expect(groqPrompt).toContain('recommendForDeepAnalysis');

    const claudePrompt = buildClaudePrompt(compactEvidence(EVIDENCE), { services: [] });
    expect(claudePrompt).toContain('salesAngle');
    expect(claudePrompt).toContain('whyWorthApproaching');
    expect(claudePrompt).toContain('verify rather than trust');
  });
});
