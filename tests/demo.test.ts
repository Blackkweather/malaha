import { beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/lib/db/pool';
import { buildDemoSlug, generateDemo, getDemoBySlug, listDemos } from '../src/lib/demo/generate';
import { escapeHtml, renderDemoHtml, safeHref } from '../src/lib/demo/render';
import { buildConcept } from '../src/lib/demo/concept';
import { getBusinessDetail } from '../src/lib/repo/businesses';
import { loadFixtures, MALAGA_FIXTURES, rescoreAndIndex, resetDatabase } from './helpers/fixtures';

let businessId: string;

beforeAll(async () => {
  await resetDatabase();
  await loadFixtures(MALAGA_FIXTURES);
  await rescoreAndIndex();
  const rows = await query<{ id: string }>(
    "SELECT id FROM businesses WHERE name LIKE '%Dental Fixture Uno%' LIMIT 1",
  );
  businessId = rows[0].id;
});

describe('escaping', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml(null)).toBe('');
  });

  it('refuses unsafe URL schemes', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com');
    expect(safeHref('tel:+34952123456')).toBe('tel:+34952123456');
    expect(safeHref('#contact')).toBe('#contact');
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('data:text/html,<script>')).toBe('#');
  });
});

describe('demo slugs', () => {
  it('produces a URL-safe, unique slug', () => {
    const a = buildDemoSlug('Clínica Dental Málaga S.L.');
    const b = buildDemoSlug('Clínica Dental Málaga S.L.');
    expect(a).toMatch(/^[a-z0-9-]+$/);
    expect(a).toContain('clinica-dental-malaga');
    expect(a).not.toBe(b);
  });
});

describe('demo generation', () => {
  it('builds a concept from the stored public facts', async () => {
    const detail = await getBusinessDetail(businessId);
    expect(detail).not.toBeNull();

    const concept = buildConcept(detail!, null);
    expect(concept.businessName).toContain('Clinica Dental Fixture Uno');
    expect(concept.categoryLabel).toBe('Dental clinic');
    expect(concept.services.length).toBeGreaterThanOrEqual(3);
    expect(concept.trustPoints.length).toBeGreaterThan(0);
    expect(concept.contact.phone).toBeTruthy();
    expect(concept.generatedFrom).toBe('facts');
  });

  it('renders every section the specification requires', async () => {
    const detail = await getBusinessDetail(businessId);
    const html = renderDemoHtml(buildConcept(detail!, null));

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('id="services"');
    expect(html).toContain('id="trust"');
    expect(html).toContain('id="reviews"');
    expect(html).toContain('id="location"');
    expect(html).toContain('id="contact"');
    expect(html).toContain('<form');
    expect(html).toContain('tel:');
    expect(html).toContain('website concept');
  });

  it('marks itself as a concept and not the official site', async () => {
    const detail = await getBusinessDetail(businessId);
    const html = renderDemoHtml(buildConcept(detail!, null));
    expect(html).toContain('Not the official website of this business');
    expect(html).toContain('noindex');
  });

  it('persists a demo and serves it by slug', async () => {
    const demo = await generateDemo(businessId);
    expect(demo.slug).toBeTruthy();
    expect(demo.url).toBe(`/demos/${demo.slug}`);

    const stored = await getDemoBySlug(demo.slug);
    expect(stored).not.toBeNull();
    expect(stored?.html).toContain('Clinica Dental Fixture Uno');

    const all = await listDemos();
    expect(all.some((d) => d.slug === demo.slug)).toBe(true);
  });

  it('gives every generated demo a unique URL', async () => {
    const first = await generateDemo(businessId);
    const second = await generateDemo(businessId);
    expect(first.slug).not.toBe(second.slug);
  });

  it('refuses to generate for an unknown business', async () => {
    await expect(generateDemo('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
  });

  it('does not copy the existing website markup', async () => {
    const detail = await getBusinessDetail(businessId);
    const html = renderDemoHtml(buildConcept(detail!, null));
    // The concept is generated from facts, so it carries our own structure.
    expect(html).toContain('--accent');
    expect(html).toContain('sticky-cta');
  });
});
