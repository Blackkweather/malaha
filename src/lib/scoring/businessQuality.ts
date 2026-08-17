import { clamp, round, type ComponentScore, type ScoreReason } from './types';

export interface BusinessQualityInput {
  /** Best available public rating, 0..5. */
  rating: number | null;
  /** Best available public review count. */
  reviewCount: number | null;
  /** 0..1 independent-evidence score from the ingestion pipeline. */
  evidenceScore: number;
  /** 0..1 confidence that the business really is in Malaga. */
  locationConfidence: number;
  /** Number of distinct public sources that mention this business. */
  sourceCount: number;
  hasPhone: boolean;
  hasAddress: boolean;
  hasWebsite: boolean;
  socialProfileCount: number;
}

/**
 * Review volume on a logarithmic curve.
 *
 * Review counts are heavily skewed: the difference between 5 and 50 reviews
 * matters far more than between 500 and 550, so a log scale reflects real
 * standing better than a linear one. 1000 reviews reaches the ceiling.
 */
export function reviewVolumeScore(reviewCount: number): number {
  if (reviewCount <= 0) return 0;
  return clamp(33.3 * Math.log10(reviewCount + 1));
}

/**
 * Rating quality. Below 3.0 a business has a reputation problem rather than a
 * website problem, so it scores zero here; 5.0 is the ceiling.
 */
export function ratingScore(rating: number): number {
  return clamp(((rating - 3) / 2) * 100);
}

/**
 * How strong and established a business looks from legitimate public evidence.
 *
 * Reputation (rating + review volume) is the dominant term because it is the
 * hardest signal to fake. Evidence breadth and completeness of the public
 * record make up the rest.
 */
export function scoreBusinessQuality(input: BusinessQualityInput): ComponentScore {
  const reasons: ScoreReason[] = [];

  const reviewCount = input.reviewCount ?? 0;
  const hasReviewEvidence = input.reviewCount !== null && input.reviewCount > 0;

  const volume = reviewVolumeScore(reviewCount);
  const quality = input.rating !== null ? ratingScore(input.rating) : 0;

  // --- Reputation ---------------------------------------------------------
  let reputation: number;
  if (hasReviewEvidence && input.rating !== null) {
    reputation = 0.55 * volume + 0.45 * quality;

    if (reviewCount >= 400) {
      reasons.push({
        code: 'very_high_review_volume',
        label: `Exceptional public review volume (${reviewCount} reviews)`,
        impact: 'positive',
        points: round(0.55 * volume),
      });
    } else if (reviewCount >= 100) {
      reasons.push({
        code: 'high_review_volume',
        label: `High public review volume (${reviewCount} reviews)`,
        impact: 'positive',
        points: round(0.55 * volume),
      });
    } else if (reviewCount >= 25) {
      reasons.push({
        code: 'meaningful_review_volume',
        label: `Meaningful public review volume (${reviewCount} reviews)`,
        impact: 'positive',
        points: round(0.55 * volume),
      });
    } else {
      reasons.push({
        code: 'low_review_volume',
        label: `Only ${reviewCount} public reviews, so market standing is unproven`,
        impact: 'negative',
        points: round(0.55 * volume - 25),
      });
    }

    if (input.rating >= 4.7) {
      reasons.push({
        code: 'excellent_rating',
        label: `Excellent public rating (${input.rating.toFixed(1)}/5)`,
        impact: 'positive',
        points: round(0.45 * quality),
      });
    } else if (input.rating >= 4.3) {
      reasons.push({
        code: 'strong_rating',
        label: `Strong public rating (${input.rating.toFixed(1)}/5)`,
        impact: 'positive',
        points: round(0.45 * quality),
      });
    } else if (input.rating < 3.8) {
      reasons.push({
        code: 'weak_rating',
        label: `Public rating of ${input.rating.toFixed(1)}/5 suggests a reputation problem, not just a website problem`,
        impact: 'negative',
        points: round(0.45 * quality - 30),
      });
    }
  } else {
    // No review evidence is a real gap: standing cannot be confirmed.
    reputation = 22;
    reasons.push({
      code: 'no_review_evidence',
      label: 'No public review signals available, so market standing is unverified',
      impact: 'negative',
      points: -20,
    });
  }

  // --- Evidence breadth ---------------------------------------------------
  const evidence = clamp(input.evidenceScore * 100);
  if (input.sourceCount >= 2) {
    reasons.push({
      code: 'corroborated_by_multiple_sources',
      label: `Corroborated by ${input.sourceCount} independent public sources`,
      impact: 'positive',
      points: round(0.3 * evidence * 0.4),
    });
  } else if (input.evidenceScore < 0.4) {
    reasons.push({
      code: 'thin_public_evidence',
      label: 'Thin public business evidence',
      impact: 'negative',
      points: -12,
    });
  }

  // --- Establishment signals ----------------------------------------------
  let establishment = 0;
  if (input.hasPhone) establishment += 30;
  if (input.hasAddress) establishment += 30;
  if (input.hasWebsite) establishment += 25;
  establishment += clamp(input.socialProfileCount * 7.5, 0, 15);
  establishment = clamp(establishment);

  if (input.hasPhone && input.hasAddress) {
    reasons.push({
      code: 'established_presence',
      label: 'Established presence with a public address and phone number',
      impact: 'positive',
      points: round(0.15 * establishment),
    });
  }

  const score = clamp(0.55 * reputation + 0.3 * evidence + 0.15 * establishment);

  return {
    score: round(score),
    reasons,
    breakdown: {
      reputation: round(reputation),
      reviewVolume: round(volume),
      ratingQuality: round(quality),
      evidence: round(evidence),
      establishment: round(establishment),
    },
  };
}
