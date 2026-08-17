/**
 * Catalogue of website findings.
 *
 * `weight` is the number of points the finding contributes to the Digital
 * Opportunity score. Weights encode how much a redesign would actually improve
 * the business outcome, not merely how technically wrong the finding is: a
 * missing mobile viewport costs a local business far more than a missing
 * canonical tag.
 */
export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueCategory =
  | 'availability'
  | 'mobile'
  | 'performance'
  | 'conversion'
  | 'seo'
  | 'accessibility'
  | 'trust'
  | 'modernity';

export interface IssueDefinition {
  code: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  weight: number;
  detail: string;
}

export const ISSUE_CATALOGUE: Record<string, IssueDefinition> = {
  no_website: {
    code: 'no_website',
    title: 'No official website found',
    category: 'availability',
    severity: 'high',
    weight: 30,
    detail: 'No official website could be verified from public sources.',
  },
  website_unreachable: {
    code: 'website_unreachable',
    title: 'Website is unreachable',
    category: 'availability',
    severity: 'high',
    weight: 34,
    detail: 'The published website did not respond successfully.',
  },
  http_error_status: {
    code: 'http_error_status',
    title: 'Homepage returns an error status',
    category: 'availability',
    severity: 'high',
    weight: 24,
    detail: 'The homepage responded with a 4xx or 5xx status code.',
  },
  no_https: {
    code: 'no_https',
    title: 'No HTTPS',
    category: 'trust',
    severity: 'high',
    weight: 14,
    detail: 'The site is not served over HTTPS, which browsers flag as insecure.',
  },
  no_mobile_viewport: {
    code: 'no_mobile_viewport',
    title: 'Weak mobile experience',
    category: 'mobile',
    severity: 'high',
    weight: 18,
    detail: 'No responsive viewport meta tag, so the layout will not adapt to phones.',
  },
  fixed_width_layout: {
    code: 'fixed_width_layout',
    title: 'Fixed-width desktop layout',
    category: 'mobile',
    severity: 'medium',
    weight: 10,
    detail: 'The markup uses fixed pixel widths that break on small screens.',
  },
  slow_response: {
    code: 'slow_response',
    title: 'Slow server response',
    category: 'performance',
    severity: 'medium',
    weight: 10,
    detail: 'The homepage took noticeably long to respond.',
  },
  very_slow_response: {
    code: 'very_slow_response',
    title: 'Very slow server response',
    category: 'performance',
    severity: 'high',
    weight: 16,
    detail: 'The homepage response time is high enough to lose mobile visitors.',
  },
  heavy_page: {
    code: 'heavy_page',
    title: 'Heavy homepage payload',
    category: 'performance',
    severity: 'medium',
    weight: 7,
    detail: 'The homepage HTML alone is unusually large.',
  },
  no_phone_link: {
    code: 'no_phone_link',
    title: 'No tap-to-call link',
    category: 'conversion',
    severity: 'high',
    weight: 11,
    detail: 'No tel: link, so mobile visitors cannot call in one tap.',
  },
  no_contact_path: {
    code: 'no_contact_path',
    title: 'Weak contact path',
    category: 'conversion',
    severity: 'high',
    weight: 13,
    detail: 'No contact form, email link or contact page could be found.',
  },
  no_booking_path: {
    code: 'no_booking_path',
    title: 'No booking or appointment path',
    category: 'conversion',
    severity: 'high',
    weight: 12,
    detail: 'The site offers no way to book or request an appointment online.',
  },
  no_whatsapp: {
    code: 'no_whatsapp',
    title: 'No WhatsApp contact',
    category: 'conversion',
    severity: 'low',
    weight: 4,
    detail: 'No WhatsApp link, which is a dominant contact channel in Spain.',
  },
  weak_cta: {
    code: 'weak_cta',
    title: 'No clear call to action',
    category: 'conversion',
    severity: 'medium',
    weight: 9,
    detail: 'No prominent call-to-action was detected on the homepage.',
  },
};

/** Second half of the catalogue, merged below to keep each block readable. */
const MORE_ISSUES: Record<string, IssueDefinition> = {
  missing_title: {
    code: 'missing_title',
    title: 'Missing or unusable page title',
    category: 'seo',
    severity: 'medium',
    weight: 7,
    detail: 'The homepage has no usable title element.',
  },
  missing_meta_description: {
    code: 'missing_meta_description',
    title: 'Missing meta description',
    category: 'seo',
    severity: 'low',
    weight: 4,
    detail: 'No meta description, so search snippets are generated arbitrarily.',
  },
  missing_h1: {
    code: 'missing_h1',
    title: 'No H1 heading',
    category: 'seo',
    severity: 'medium',
    weight: 5,
    detail: 'The page has no H1, weakening both SEO and screen-reader structure.',
  },
  broken_heading_structure: {
    code: 'broken_heading_structure',
    title: 'Broken heading hierarchy',
    category: 'seo',
    severity: 'low',
    weight: 3,
    detail: 'Heading levels skip in a way that breaks the document outline.',
  },
  missing_canonical: {
    code: 'missing_canonical',
    title: 'No canonical URL',
    category: 'seo',
    severity: 'low',
    weight: 3,
    detail: 'No canonical link element, risking duplicate-content dilution.',
  },
  low_image_alt_coverage: {
    code: 'low_image_alt_coverage',
    title: 'Images missing alt text',
    category: 'accessibility',
    severity: 'medium',
    weight: 6,
    detail: 'A large share of images have no alt attribute.',
  },
  no_lang_attribute: {
    code: 'no_lang_attribute',
    title: 'No language declared',
    category: 'accessibility',
    severity: 'low',
    weight: 3,
    detail: 'The html element declares no lang attribute.',
  },
  broken_links: {
    code: 'broken_links',
    title: 'Broken internal links',
    category: 'trust',
    severity: 'medium',
    weight: 8,
    detail: 'One or more internal links return an error.',
  },
  no_social_links: {
    code: 'no_social_links',
    title: 'No social profiles linked',
    category: 'trust',
    severity: 'low',
    weight: 3,
    detail: 'The site links to no social profiles, weakening credibility signals.',
  },
  stale_copyright: {
    code: 'stale_copyright',
    title: 'Outdated copyright year',
    category: 'modernity',
    severity: 'medium',
    weight: 7,
    detail: 'The footer copyright year suggests the site is not maintained.',
  },
  legacy_markup: {
    code: 'legacy_markup',
    title: 'Legacy markup and techniques',
    category: 'modernity',
    severity: 'medium',
    weight: 9,
    detail: 'The page uses table layouts, framesets or other dated techniques.',
  },
  free_site_builder: {
    code: 'free_site_builder',
    title: 'Free site-builder subdomain',
    category: 'modernity',
    severity: 'medium',
    weight: 11,
    detail: 'The site runs on a free builder subdomain rather than its own domain.',
  },
  social_only_presence: {
    code: 'social_only_presence',
    title: 'Social media used instead of a website',
    category: 'modernity',
    severity: 'high',
    weight: 15,
    detail: 'The only web presence is a social profile or directory listing.',
  },
  no_analytics: {
    code: 'no_analytics',
    title: 'No analytics detected',
    category: 'modernity',
    severity: 'low',
    weight: 3,
    detail: 'No analytics tag was detected, so results cannot be measured.',
  },
};

Object.assign(ISSUE_CATALOGUE, MORE_ISSUES);

export function issueDefinition(code: string): IssueDefinition | null {
  return ISSUE_CATALOGUE[code] ?? null;
}

/** Total weight if every catalogued issue were present. Used for normalisation. */
export function maxIssueWeight(): number {
  return Object.values(ISSUE_CATALOGUE).reduce((sum, i) => sum + i.weight, 0);
}
