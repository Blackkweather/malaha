import { ISSUE_CATALOGUE, type IssueDefinition } from '../website/issues';
import { clamp, round, type ComponentScore, type ScoreReason } from './types';

export interface DigitalOpportunityInput {
  /** True when an official website was verified. */
  hasWebsite: boolean;
  /** True when the site responded successfully. */
  reachable: boolean;
  /**
   * The HTTP status of the failed attempt, when there was one.
   *
   * A server that answers 500 is confirmed broken. A timeout or DNS failure
   * returns null and is only provisional evidence: one bad fetch is not proof
   * that a site is permanently down.
   */
  httpStatus?: number | null;
  /** Issue codes produced by the website audit. */
  issueCodes: string[];
  /** Whether the business has a social presence that substitutes for a site. */
  socialProfileCount: number;
  /** Set when the audit could not run at all. */
  auditMissing?: boolean;
}

/** Short human verdict shown on result cards. */
export function websiteVerdict(input: DigitalOpportunityInput): string {
  if (!input.hasWebsite) {
    return input.socialProfileCount > 0 ? 'social profiles only' : 'no website';
  }
  // A failed fetch outranks "audit pending" here exactly as it does in the
  // score below, but a timeout is reported as provisional rather than fatal.
  if (!input.reachable) {
    return input.httpStatus === null || input.httpStatus === undefined
      ? 'did not respond'
      : 'unreachable';
  }
  if (input.auditMissing) return 'not audited yet';

  const codes = new Set(input.issueCodes);
  if (codes.has('no_mobile_viewport') || codes.has('fixed_width_layout')) {
    return 'weak mobile experience';
  }
  if (codes.has('legacy_markup') || codes.has('stale_copyright') || codes.has('free_site_builder')) {
    return 'outdated';
  }
  if (codes.has('no_contact_path') || codes.has('no_booking_path') || codes.has('no_phone_link')) {
    return 'weak conversion path';
  }
  if (codes.has('very_slow_response') || codes.has('slow_response')) return 'slow';
  if (input.issueCodes.length === 0) return 'solid';
  return 'minor issues';
}

/**
 * How much visible website/digital improvement opportunity exists.
 *
 * The score is the weighted sum of catalogued findings, plus a small baseline
 * because every site has some upside. Absence of a website is a strong signal
 * but deliberately not a maximum one: the specification requires that a weak
 * business without a website must not outrank an established business with a
 * mediocre one, and that separation is preserved by keeping the no-website
 * score below what a genuinely broken, established site scores.
 */
export function scoreDigitalOpportunity(input: DigitalOpportunityInput): ComponentScore {
  const reasons: ScoreReason[] = [];
  const baseline = 8;

  if (!input.hasWebsite) {
    const definition = ISSUE_CATALOGUE.no_website;
    let score = 62;
    reasons.push({
      code: definition.code,
      label: 'No official website found, so the entire web presence has to be built',
      impact: 'positive',
      points: definition.weight,
    });

    if (input.socialProfileCount > 0) {
      score += 8;
      reasons.push({
        code: 'social_only_presence',
        label: 'The business relies on social profiles instead of a website it controls',
        impact: 'positive',
        points: ISSUE_CATALOGUE.social_only_presence.weight,
      });
    }

    return {
      score: round(clamp(score)),
      reasons,
      breakdown: { baseline, issueWeight: definition.weight, issueCount: 1 },
    };
  }

  if (!input.reachable) {
    const confirmed = input.httpStatus !== null && input.httpStatus !== undefined;

    if (confirmed) {
      reasons.push({
        code: 'website_unreachable',
        label: `The published website returns HTTP ${input.httpStatus}, so customers are being lost outright`,
        impact: 'positive',
        points: ISSUE_CATALOGUE.website_unreachable.weight,
      });
      return {
        score: round(clamp(84)),
        reasons,
        breakdown: {
          baseline,
          issueWeight: ISSUE_CATALOGUE.website_unreachable.weight,
          issueCount: 1,
        },
      };
    }

    // A timeout or DNS failure is scored well below a confirmed error, so a
    // single slow fetch cannot float a thin record to the top of the shortlist.
    reasons.push({
      code: 'website_did_not_respond',
      label: 'The published website did not respond when checked; this needs re-verifying',
      impact: 'neutral',
      points: 0,
    });
    return { score: 52, reasons, breakdown: { baseline, issueWeight: 0, issueCount: 0 } };
  }

  // A published-but-unaudited site is deliberately scored below both a broken
  // site and a missing one: we do not yet know whether an opportunity exists,
  // and guessing high would let un-audited records crowd out verified ones.
  if (input.auditMissing) {
    reasons.push({
      code: 'audit_pending',
      label: 'The website has not been audited yet, so the opportunity is provisional',
      impact: 'neutral',
      points: 0,
    });
    return { score: 40, reasons, breakdown: { baseline, issueWeight: 0, issueCount: 0 } };
  }

  const definitions = input.issueCodes
    .map((code) => ISSUE_CATALOGUE[code])
    .filter((d): d is IssueDefinition => d !== undefined);

  const issueWeight = definitions.reduce((sum, d) => sum + d.weight, 0);
  const score = clamp(baseline + issueWeight);

  // Report the findings that actually move the number, highest impact first.
  for (const definition of [...definitions].sort((a, b) => b.weight - a.weight).slice(0, 6)) {
    reasons.push({
      code: definition.code,
      label: definition.title,
      impact: 'positive',
      points: definition.weight,
    });
  }

  if (definitions.length === 0) {
    reasons.push({
      code: 'site_already_strong',
      label: 'The current site performs well, so redesign upside is limited',
      impact: 'negative',
      points: -20,
    });
  } else if (issueWeight < 15) {
    reasons.push({
      code: 'minor_issues_only',
      label: 'Only minor issues found, so the commercial case for a rebuild is weak',
      impact: 'negative',
      points: -10,
    });
  }

  return {
    score: round(score),
    reasons,
    breakdown: {
      baseline,
      issueWeight: round(issueWeight),
      issueCount: definitions.length,
      highSeverityCount: definitions.filter((d) => d.severity === 'high').length,
    },
  };
}
