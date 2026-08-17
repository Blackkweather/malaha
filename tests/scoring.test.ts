import { describe, expect, it } from 'vitest';
import {
  ratingScore,
  reviewVolumeScore,
  scoreBusinessQuality,
} from '../src/lib/scoring/businessQuality';
import { scoreCommercialValue } from '../src/lib/scoring/commercialValue';
import { scoreDigitalOpportunity, websiteVerdict } from '../src/lib/scoring/digitalOpportunity';
import { computeOpportunity } from '../src/lib/scoring/opportunity';

const ESTABLISHED = {
  rating: 4.9,
  reviewCount: 847,
  evidenceScore: 0.9,
  locationConfidence: 0.95,
  sourceCount: 2,
  hasPhone: true,
  hasAddress: true,
  hasWebsite: true,
  socialProfileCount: 2,
};

const THIN = {
  rating: null,
  reviewCount: null,
  evidenceScore: 0.3,
  locationConfidence: 0.75,
  sourceCount: 1,
  hasPhone: false,
  hasAddress: true,
  hasWebsite: false,
  socialProfileCount: 0,
};

describe('business quality score', () => {
  it('rewards review volume on a logarithmic curve', () => {
    expect(reviewVolumeScore(0)).toBe(0);
    expect(reviewVolumeScore(10)).toBeGreaterThan(30);
    expect(reviewVolumeScore(1000)).toBeGreaterThan(95);
    // The step from 10 to 100 must matter more than 900 to 1000.
    expect(reviewVolumeScore(100) - reviewVolumeScore(10)).toBeGreaterThan(
      reviewVolumeScore(1000) - reviewVolumeScore(900),
    );
  });

  it('maps ratings onto a 3.0-to-5.0 band', () => {
    expect(ratingScore(3.0)).toBe(0);
    expect(ratingScore(5.0)).toBe(100);
    expect(ratingScore(2.0)).toBe(0);
  });

  it('scores an established, well-reviewed business highly', () => {
    const result = scoreBusinessQuality(ESTABLISHED);
    expect(result.score).toBeGreaterThan(80);
    expect(result.reasons.some((r) => r.code === 'very_high_review_volume')).toBe(true);
    expect(result.reasons.some((r) => r.code === 'excellent_rating')).toBe(true);
  });

  it('penalises a business with no public review evidence', () => {
    const result = scoreBusinessQuality(THIN);
    expect(result.score).toBeLessThan(45);
    expect(result.reasons.some((r) => r.code === 'no_review_evidence')).toBe(true);
  });

  it('flags a poor rating as a reputation problem', () => {
    const result = scoreBusinessQuality({ ...ESTABLISHED, rating: 3.2, reviewCount: 300 });
    expect(result.reasons.some((r) => r.code === 'weak_rating')).toBe(true);
  });

  it('always explains itself', () => {
    expect(scoreBusinessQuality(ESTABLISHED).reasons.length).toBeGreaterThan(0);
    expect(scoreBusinessQuality(THIN).reasons.length).toBeGreaterThan(0);
  });
});

describe('commercial value score', () => {
  it('ranks high-ticket categories above low-ticket ones', () => {
    const dental = scoreCommercialValue({
      categoryKey: 'dental_clinic',
      categoryConfidence: 0.95,
      reviewCount: 200,
    });
    const bar = scoreCommercialValue({
      categoryKey: 'cafe_bar',
      categoryConfidence: 0.95,
      reviewCount: 200,
    });
    expect(dental.score).toBeGreaterThan(bar.score + 30);
  });

  it('pulls an uncertain classification toward the neutral baseline', () => {
    const confident = scoreCommercialValue({
      categoryKey: 'dental_clinic',
      categoryConfidence: 0.95,
      reviewCount: null,
    });
    const unsure = scoreCommercialValue({
      categoryKey: 'dental_clinic',
      categoryConfidence: 0.2,
      reviewCount: null,
    });
    expect(unsure.score).toBeLessThan(confident.score);
    expect(unsure.reasons.some((r) => r.code === 'uncertain_category')).toBe(true);
  });

  it('recognises scale and high-value services', () => {
    const large = scoreCommercialValue({
      categoryKey: 'dental_clinic',
      categoryConfidence: 0.9,
      reviewCount: 800,
      detectedServices: ['implantes dentales', 'ortodoncia invisible'],
    });
    expect(large.reasons.some((r) => r.code === 'large_operation')).toBe(true);
    expect(large.reasons.some((r) => r.code === 'high_value_services')).toBe(true);
  });
});

describe('digital opportunity score', () => {
  it('scores a broken site above a site that merely lacks features', () => {
    const broken = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: false,
      issueCodes: [],
      socialProfileCount: 0,
    });
    const mediocre = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: true,
      issueCodes: ['missing_meta_description', 'missing_canonical'],
      socialProfileCount: 1,
    });
    expect(broken.score).toBeGreaterThan(mediocre.score);
  });

  it('gives a strong site a low opportunity score', () => {
    const strong = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: true,
      issueCodes: [],
      socialProfileCount: 3,
    });
    expect(strong.score).toBeLessThan(20);
    expect(strong.reasons.some((r) => r.code === 'site_already_strong')).toBe(true);
  });

  it('does not let "no website" score the maximum', () => {
    const none = scoreDigitalOpportunity({
      hasWebsite: false,
      reachable: false,
      issueCodes: [],
      socialProfileCount: 0,
    });
    const terrible = scoreDigitalOpportunity({
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
        'stale_copyright',
      ],
      socialProfileCount: 0,
    });
    expect(none.score).toBeLessThan(terrible.score);
  });

  it('describes the website in plain language', () => {
    expect(
      websiteVerdict({
        hasWebsite: true,
        reachable: true,
        issueCodes: ['no_mobile_viewport'],
        socialProfileCount: 0,
      }),
    ).toBe('weak mobile experience');
    expect(
      websiteVerdict({ hasWebsite: false, reachable: false, issueCodes: [], socialProfileCount: 0 }),
    ).toBe('no website');
    expect(
      websiteVerdict({ hasWebsite: false, reachable: false, issueCodes: [], socialProfileCount: 2 }),
    ).toBe('social profiles only');
  });
});

describe('un-audited websites', () => {
  it('scores a published-but-unaudited site below both a broken and a missing one', () => {
    const pending = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: true,
      issueCodes: [],
      socialProfileCount: 0,
      auditMissing: true,
    });
    const missing = scoreDigitalOpportunity({
      hasWebsite: false,
      reachable: false,
      issueCodes: [],
      socialProfileCount: 0,
    });
    const broken = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: false,
      issueCodes: [],
      socialProfileCount: 0,
    });

    expect(pending.score).toBeLessThan(missing.score);
    expect(pending.score).toBeLessThan(broken.score);
    expect(pending.reasons.some((r) => r.code === 'audit_pending')).toBe(true);
  });

  it('says so plainly rather than claiming there is no website', () => {
    expect(
      websiteVerdict({
        hasWebsite: true,
        reachable: true,
        issueCodes: [],
        socialProfileCount: 0,
        auditMissing: true,
      }),
    ).toBe('not audited yet');
  });
});

describe('verdict and score agree on precedence', () => {
  it('calls a site that failed to load unreachable, not un-audited', () => {
    const input = {
      hasWebsite: true,
      reachable: false,
      httpStatus: 503,
      issueCodes: [],
      socialProfileCount: 0,
      auditMissing: true,
    };
    expect(websiteVerdict(input)).toBe('unreachable');
    // The score takes the same branch, so the two can never disagree.
    expect(scoreDigitalOpportunity(input).reasons[0].code).toBe('website_unreachable');
  });
});

describe('timeouts are not treated as confirmed failures', () => {
  it('scores a confirmed HTTP error above a site that merely timed out', () => {
    const confirmed = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: false,
      httpStatus: 500,
      issueCodes: [],
      socialProfileCount: 0,
    });
    const timedOut = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: false,
      httpStatus: null,
      issueCodes: [],
      socialProfileCount: 0,
    });

    expect(confirmed.score).toBeGreaterThan(timedOut.score);
    expect(timedOut.reasons[0].code).toBe('website_did_not_respond');
    expect(websiteVerdict({ hasWebsite: true, reachable: false, httpStatus: null, issueCodes: [], socialProfileCount: 0 })).toBe(
      'did not respond',
    );
    expect(websiteVerdict({ hasWebsite: true, reachable: false, httpStatus: 500, issueCodes: [], socialProfileCount: 0 })).toBe(
      'unreachable',
    );
  });

  it('does not let a single timeout outrank a genuinely broken site', () => {
    const timedOut = scoreDigitalOpportunity({
      hasWebsite: true,
      reachable: false,
      httpStatus: null,
      issueCodes: [],
      socialProfileCount: 0,
    });
    const missing = scoreDigitalOpportunity({
      hasWebsite: false,
      reachable: false,
      issueCodes: [],
      socialProfileCount: 0,
    });
    expect(timedOut.score).toBeLessThan(missing.score);
  });
});
