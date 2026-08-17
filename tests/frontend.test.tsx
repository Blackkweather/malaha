import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/link is a client navigation wrapper; a plain anchor is enough here.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ScoreBadge, ScoreBar, Stars, scoreTone } = await import('../src/components/Score');
const { ResultCard } = await import('../src/components/ResultCard');
const { AiPanels } = await import('../src/components/AiPanels');

const STRONG = {
  businessId: '11111111-1111-1111-1111-111111111111',
  name: 'Clinica Dental Larios',
  categoryLabel: 'Dental clinic',
  city: 'Malaga',
  rating: 4.9,
  reviewCount: 847,
  hasWebsite: true,
  websiteDomain: 'dentallarios.example',
  websiteVerdict: 'weak mobile experience',
  opportunity: 93,
  reasons: [
    'Exceptional public review volume (847 reviews)',
    'Dental clinic is a high-value category',
    'Weak mobile experience',
  ],
};

describe('score presentation', () => {
  it('uses a consistent colour ramp', () => {
    expect(scoreTone(90).text).toBe('text-positive');
    expect(scoreTone(75).text).toBe('text-accent');
    expect(scoreTone(55).text).toBe('text-warn');
    expect(scoreTone(20).text).toBe('text-ink-muted');
  });

  it('renders a rounded score badge', () => {
    const html = renderToStaticMarkup(<ScoreBadge score={93.4} label="score" />);
    expect(html).toContain('93');
    expect(html).toContain('score');
  });

  it('renders a bar with its weight and clamps the width', () => {
    const html = renderToStaticMarkup(<ScoreBar label="Business quality" score={120} weight={0.35} />);
    expect(html).toContain('Business quality');
    expect(html).toContain('35%');
    expect(html).toContain('width:100%');
  });

  it('shows a rating or says there is none', () => {
    expect(renderToStaticMarkup(<Stars rating={4.9} />)).toContain('4.9');
    expect(renderToStaticMarkup(<Stars rating={null} />)).toContain('no rating');
  });
});

describe('result card', () => {
  it('shows the compact summary a shortlist needs', () => {
    const html = renderToStaticMarkup(<ResultCard rank={1} data={STRONG} />);

    expect(html).toContain('Clinica Dental Larios');
    expect(html).toContain('Dental clinic');
    expect(html).toContain('4.9');
    expect(html).toContain('847 reviews');
    expect(html).toContain('weak mobile experience');
    expect(html).toContain('93');
    expect(html).toContain(`/prospects/${STRONG.businessId}`);
  });

  it('shows at most three reasons so the card stays compact', () => {
    const html = renderToStaticMarkup(
      <ResultCard rank={1} data={{ ...STRONG, reasons: ['a1', 'b2', 'c3', 'd4', 'e5'] }} />,
    );
    expect(html).toContain('a1');
    expect(html).toContain('c3');
    expect(html).not.toContain('d4');
  });

  it('states plainly when no website was found', () => {
    const html = renderToStaticMarkup(
      <ResultCard rank={2} data={{ ...STRONG, hasWebsite: false, websiteVerdict: null }} />,
    );
    expect(html).toContain('none found');
  });

  it('states plainly when there is no review data', () => {
    const html = renderToStaticMarkup(
      <ResultCard rank={3} data={{ ...STRONG, rating: null, reviewCount: null }} />,
    );
    expect(html).toContain('no review data');
    expect(html).toContain('no rating');
  });
});

describe('AI panels', () => {
  it('explains what to do when an analysis has not been run', () => {
    const html = renderToStaticMarkup(<AiPanels groq={null} claude={null} />);
    expect(html).toContain('Groq analysis');
    expect(html).toContain('Claude analysis');
    expect(html).toContain('Deep analyze');
    expect(html).toContain('GROQ_API_KEY');
    expect(html).toContain('ANTHROPIC_API_KEY');
  });

  it('renders a Claude brief when one exists', () => {
    const claude = {
      currentWebsiteExperience: 'Dated and slow on mobile.',
      businessPositioning: 'Established clinic in the centre.',
      strongestOpportunities: [{ title: 'Mobile rebuild', why: 'Most visits are mobile', impact: 'high' as const }],
      customerJourneyFriction: ['No online booking'],
      redesignPriorities: [{ priority: 1, item: 'Responsive layout', rationale: 'Baseline' }],
      recommendedSiteStructure: [{ page: 'Home', purpose: 'Convert enquiries' }],
      recommendedPrimaryCta: 'Pedir cita',
      salesAngle: 'Excellent reviews, but the site loses phone visitors.',
      whyWorthApproaching: '847 reviews at 4.9 with a broken mobile experience.',
      risks: ['May have an in-house designer'],
      verdict: 'strong' as const,
      confidence: 0.9,
    };

    const html = renderToStaticMarkup(<AiPanels groq={null} claude={claude} />);
    expect(html).toContain('Pedir cita');
    expect(html).toContain('Excellent reviews');
    expect(html).toContain('Responsive layout');
    expect(html).toContain('strong');
    expect(html).toContain('May have an in-house designer');
  });
});
