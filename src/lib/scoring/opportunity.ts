import { config, type ScoreWeights } from '../config';
import { scoreBusinessQuality, type BusinessQualityInput } from './businessQuality';
import { scoreCommercialValue, type CommercialValueInput } from './commercialValue';
import {
  scoreDigitalOpportunity,
  websiteVerdict,
  type DigitalOpportunityInput,
} from './digitalOpportunity';
import { clamp, round, type ComponentScore, type ScoreReason } from './types';

export interface OpportunityInput {
  businessQuality: BusinessQualityInput;
  commercialValue: CommercialValueInput;
  digitalOpportunity: DigitalOpportunityInput;
  /** Geographic verification result, required for the quality gate. */
  inScope: boolean;
  locationConfidence: number;
  categoryExcluded: boolean;
  isDuplicate: boolean;
  evidenceScore: number;
  cityLabel: string;
  /**
   * False when the business name yields no significant tokens (for example a
   * bare "A R" from a sparse map entry). Such a record cannot be verified or
   * approached, so it counts as insufficient evidence rather than a prospect.
   */
  nameIsMeaningful: boolean;
}

export interface OpportunityResult {
  opportunity: number;
  businessQuality: ComponentScore;
  commercialValue: ComponentScore;
  digitalOpportunity: ComponentScore;
  weights: ScoreWeights;
  reasons: ScoreReason[];
  websiteVerdict: string;
  qualified: boolean;
  disqualificationReasons: string[];
}

/** Thresholds a candidate must clear before it can appear in results at all. */
export const QUALITY_GATE = {
  minBusinessQuality: 28,
  minCommercialValue: 35,
  get minEvidenceScore() {
    return config.search.minEvidenceScore;
  },
  get minOpportunity() {
    return config.search.minOpportunityScore;
  },
  get minLocationConfidence() {
    return config.geo.minLocationConfidence;
  },
};

/**
 * Combines the three components into the final Opportunity Score and decides
 * whether the candidate is strong enough to be shown at all.
 *
 * The weighting means a high Digital Opportunity alone cannot carry a weak
 * business: with the default weights, a business scoring 100 on digital
 * opportunity but 10 on quality and 40 on value reaches only 54, below an
 * established business at 75/90/55 which reaches 70.
 */
export function computeOpportunity(
  input: OpportunityInput,
  weights: ScoreWeights = config.weights,
): OpportunityResult {
  const businessQuality = scoreBusinessQuality(input.businessQuality);
  const commercialValue = scoreCommercialValue(input.commercialValue);
  const digitalOpportunity = scoreDigitalOpportunity(input.digitalOpportunity);

  const opportunity = clamp(
    businessQuality.score * weights.businessQuality +
      commercialValue.score * weights.commercialValue +
      digitalOpportunity.score * weights.digitalOpportunity,
  );

  const reasons: ScoreReason[] = [];

  if (input.inScope) {
    reasons.push({
      code: 'location_verified',
      label: `${input.cityLabel} location verified (confidence ${(input.locationConfidence * 100).toFixed(0)}%)`,
      impact: 'positive',
      points: 0,
    });
  }

  // Merge component reasons, strongest contributions first within each block.
  const byImpact = (a: ScoreReason, b: ScoreReason) => Math.abs(b.points) - Math.abs(a.points);
  reasons.push(...[...businessQuality.reasons].sort(byImpact));
  reasons.push(...[...commercialValue.reasons].sort(byImpact));
  reasons.push(...[...digitalOpportunity.reasons].sort(byImpact));

  // --- Quality gate -------------------------------------------------------
  const disqualificationReasons: string[] = [];

  if (input.isDuplicate) {
    disqualificationReasons.push('Record is a duplicate of another business');
  }
  if (!input.inScope) {
    disqualificationReasons.push(`Not verified as being in ${input.cityLabel}`);
  }
  if (input.locationConfidence < QUALITY_GATE.minLocationConfidence) {
    disqualificationReasons.push(
      `Location confidence ${input.locationConfidence.toFixed(2)} is below the required ${QUALITY_GATE.minLocationConfidence}`,
    );
  }
  if (input.categoryExcluded) {
    disqualificationReasons.push('Category is not a viable website/design client');
  }
  if (input.evidenceScore < QUALITY_GATE.minEvidenceScore) {
    disqualificationReasons.push(
      `Insufficient public business evidence (${input.evidenceScore.toFixed(2)})`,
    );
  }
  if (!input.nameIsMeaningful) {
    disqualificationReasons.push('The business name carries no identifying information');
  }
  if (businessQuality.score < QUALITY_GATE.minBusinessQuality) {
    disqualificationReasons.push(
      `Business is too weak to be worth approaching (quality ${businessQuality.score})`,
    );
  }
  if (commercialValue.score < QUALITY_GATE.minCommercialValue) {
    disqualificationReasons.push(
      `Commercial value ${commercialValue.score} is below the viable threshold`,
    );
  }
  if (digitalOpportunity.score < 20) {
    disqualificationReasons.push('No meaningful website opportunity exists');
  }
  if (opportunity < QUALITY_GATE.minOpportunity) {
    disqualificationReasons.push(
      `Opportunity score ${round(opportunity)} is below the shortlist threshold of ${QUALITY_GATE.minOpportunity}`,
    );
  }

  return {
    opportunity: round(opportunity),
    businessQuality,
    commercialValue,
    digitalOpportunity,
    weights,
    reasons,
    websiteVerdict: websiteVerdict(input.digitalOpportunity),
    qualified: disqualificationReasons.length === 0,
    disqualificationReasons,
  };
}

/** The short reason list shown on a result card. */
export function topReasons(result: OpportunityResult, limit = 6): string[] {
  return result.reasons
    .filter((r) => r.impact !== 'neutral')
    .slice(0, limit)
    .map((r) => r.label);
}
