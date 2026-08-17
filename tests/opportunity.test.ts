import { describe, expect, it } from 'vitest';
import { computeOpportunity, topReasons, type OpportunityInput } from '../src/lib/scoring/opportunity';

function makeInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    businessQuality: {
      rating: 4.8,
      reviewCount: 500,
      evidenceScore: 0.85,
      locationConfidence: 0.95,
      sourceCount: 2,
      hasPhone: true,
      hasAddress: true,
      hasWebsite: true,
      socialProfileCount: 2,
    },
    commercialValue: {
      categoryKey: 'dental_clinic',
      categoryConfidence: 0.95,
      reviewCount: 500,
    },
    digitalOpportunity: {
      hasWebsite: true,
      reachable: true,
      issueCodes: ['no_mobile_viewport', 'no_booking_path'],
      socialProfileCount: 2,
    },
    inScope: true,
    locationConfidence: 0.95,
    categoryExcluded: false,
    isDuplicate: false,
    evidenceScore: 0.85,
    cityLabel: 'Malaga',
    nameIsMeaningful: true,
    ...overrides,
  };
}

describe('opportunity score', () => {
  it('applies the configured weights', () => {
    const result = computeOpportunity(makeInput(), {
      businessQuality: 0.35,
      commercialValue: 0.25,
      digitalOpportunity: 0.4,
    });
    const expected =
      result.businessQuality.score * 0.35 +
      result.commercialValue.score * 0.25 +
      result.digitalOpportunity.score * 0.4;
    expect(result.opportunity).toBeCloseTo(Number(expected.toFixed(1)), 1);
  });

  it('honours reweighting', () => {
    const digitalHeavy = computeOpportunity(makeInput(), {
      businessQuality: 0.1,
      commercialValue: 0.1,
      digitalOpportunity: 0.8,
    });
    const qualityHeavy = computeOpportunity(makeInput(), {
      businessQuality: 0.8,
      commercialValue: 0.1,
      digitalOpportunity: 0.1,
    });
    expect(digitalHeavy.opportunity).not.toBe(qualityHeavy.opportunity);
  });

  it('is always explainable', () => {
    const result = computeOpportunity(makeInput());
    expect(result.reasons.length).toBeGreaterThan(3);
    expect(topReasons(result).length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.code === 'location_verified')).toBe(true);
    for (const reason of result.reasons) {
      expect(reason.label.length).toBeGreaterThan(3);
    }
  });
});

describe('a weak business must not outrank a strong one', () => {
  it('keeps an established business with a mediocre site above a weak business with no site', () => {
    const established = computeOpportunity(
      makeInput({
        digitalOpportunity: {
          hasWebsite: true,
          reachable: true,
          issueCodes: ['missing_meta_description', 'no_whatsapp'],
          socialProfileCount: 2,
        },
      }),
    );

    const weakWithNoSite = computeOpportunity(
      makeInput({
        businessQuality: {
          rating: 3.6,
          reviewCount: 4,
          evidenceScore: 0.35,
          locationConfidence: 0.8,
          sourceCount: 1,
          hasPhone: true,
          hasAddress: true,
          hasWebsite: false,
          socialProfileCount: 0,
        },
        commercialValue: { categoryKey: 'cafe_bar', categoryConfidence: 0.9, reviewCount: 4 },
        digitalOpportunity: {
          hasWebsite: false,
          reachable: false,
          issueCodes: [],
          socialProfileCount: 0,
        },
        evidenceScore: 0.35,
      }),
    );

    expect(established.opportunity).toBeGreaterThan(weakWithNoSite.opportunity);
  });

  it('does not reward absence of a website on its own', () => {
    const noSite = computeOpportunity(
      makeInput({
        digitalOpportunity: {
          hasWebsite: false,
          reachable: false,
          issueCodes: [],
          socialProfileCount: 0,
        },
      }),
    );
    const badSite = computeOpportunity(
      makeInput({
        digitalOpportunity: {
          hasWebsite: true,
          reachable: true,
          issueCodes: [
            'no_mobile_viewport',
            'no_contact_path',
            'no_booking_path',
            'no_phone_link',
            'legacy_markup',
            'very_slow_response',
            'no_https',
          ],
          socialProfileCount: 0,
        },
      }),
    );
    expect(badSite.opportunity).toBeGreaterThan(noSite.opportunity);
  });
});

describe('quality gate', () => {
  it('qualifies a strong Malaga prospect', () => {
    expect(computeOpportunity(makeInput()).qualified).toBe(true);
  });

  it('disqualifies a business that is not verified in Malaga', () => {
    const result = computeOpportunity(makeInput({ inScope: false, locationConfidence: 0.2 }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReasons.join(' ')).toContain('Malaga');
  });

  it('disqualifies duplicates', () => {
    const result = computeOpportunity(makeInput({ isDuplicate: true }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReasons.join(' ')).toContain('duplicate');
  });

  it('disqualifies irrelevant categories', () => {
    const result = computeOpportunity(makeInput({ categoryExcluded: true }));
    expect(result.qualified).toBe(false);
  });

  it('disqualifies records with insufficient public evidence', () => {
    const result = computeOpportunity(makeInput({ evidenceScore: 0.1 }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReasons.join(' ')).toContain('evidence');
  });

  it('disqualifies a prospect with no meaningful website opportunity', () => {
    const result = computeOpportunity(
      makeInput({
        digitalOpportunity: {
          hasWebsite: true,
          reachable: true,
          issueCodes: [],
          socialProfileCount: 3,
        },
      }),
    );
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReasons.join(' ')).toContain('No meaningful website opportunity');
  });

  it('disqualifies a record whose name carries no information', () => {
    const result = computeOpportunity(makeInput({ nameIsMeaningful: false }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReasons.join(' ')).toContain('no identifying information');
  });

  it('states every reason for exclusion', () => {
    const result = computeOpportunity(
      makeInput({ inScope: false, locationConfidence: 0.1, isDuplicate: true, evidenceScore: 0.05 }),
    );
    expect(result.disqualificationReasons.length).toBeGreaterThanOrEqual(3);
  });
});
