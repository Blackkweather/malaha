import { describe, expect, it } from 'vitest';
import { isPathAllowed, parseRobots } from '../src/lib/website/robots';
import { scoreOfficialness } from '../src/lib/website/discover';
import { ISSUE_CATALOGUE, issueDefinition } from '../src/lib/website/issues';

const CORROBORATING_SITE = `<!doctype html><html lang="es">
<head><title>Clinica Dental Larios - Malaga</title></head>
<body>
  <h1>Clinica Dental Larios</h1>
  <p>Calle Larios 12, 29005 Malaga</p>
  <p>Telefono 952 12 34 56</p>
</body></html>`;

describe('robots.txt compliance', () => {
  it('applies the wildcard group', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /privado\nCrawl-delay: 2', 'MyBot/1.0');
    expect(isPathAllowed(rules, '/privado/x')).toBe(false);
    expect(isPathAllowed(rules, '/publico')).toBe(true);
    expect(rules.crawlDelayMs).toBe(2000);
  });

  it('prefers a group naming our agent', () => {
    const robots =
      'User-agent: *\nDisallow: /\n\nUser-agent: malagaprospectfinder\nDisallow: /solo-esto';
    const rules = parseRobots(robots, 'MalagaProspectFinder/1.0');
    expect(isPathAllowed(rules, '/cualquiera')).toBe(true);
    expect(isPathAllowed(rules, '/solo-esto')).toBe(false);
  });

  it('lets a longer Allow override a Disallow', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/publico', 'Bot');
    expect(isPathAllowed(rules, '/a/privado')).toBe(false);
    expect(isPathAllowed(rules, '/a/publico')).toBe(true);
  });

  it('assumes allowed when robots.txt cannot be read', () => {
    const unavailable = { disallow: ['/'], allow: [], crawlDelayMs: 0, unavailable: true };
    expect(isPathAllowed(unavailable, '/x')).toBe(true);
  });
});

describe('website discovery confidence', () => {
  const input = {
    businessName: 'Clinica Dental Larios',
    phone: '+34 952 12 34 56',
    postalCode: '29005',
    city: 'Malaga',
  };

  it('is confident when the page corroborates the business', () => {
    const result = scoreOfficialness(input, {
      finalUrl: 'https://clinicadentallarios.example/',
      html: CORROBORATING_SITE,
    });
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.length).toBeGreaterThan(1);
  });

  it('does not accept an unrelated site with a similar-sounding domain', () => {
    const result = scoreOfficialness(input, {
      finalUrl: 'https://clinicadentallarios.example/',
      html: '<html><body><h1>Venta de neumaticos en Sevilla</h1></body></html>',
    });
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('counts a matching phone number as corroboration', () => {
    const result = scoreOfficialness(input, {
      finalUrl: 'https://otra-marca.example/',
      html: '<html><body><p>Llamenos: 952 12 34 56</p></body></html>',
    });
    expect(result.evidence.join(' ')).toContain('phone number');
  });

  it('gives no confidence to a page with nothing in common', () => {
    const result = scoreOfficialness(input, {
      finalUrl: 'https://sin-relacion.example/',
      html: '<html><body><p>Contenido no relacionado</p></body></html>',
    });
    expect(result.confidence).toBe(0);
  });
});

describe('issue catalogue', () => {
  it('weights outcome-critical findings above cosmetic ones', () => {
    expect(ISSUE_CATALOGUE.no_mobile_viewport.weight).toBeGreaterThan(
      ISSUE_CATALOGUE.missing_canonical.weight,
    );
    expect(ISSUE_CATALOGUE.website_unreachable.weight).toBeGreaterThan(
      ISSUE_CATALOGUE.no_whatsapp.weight,
    );
    expect(ISSUE_CATALOGUE.no_contact_path.weight).toBeGreaterThan(
      ISSUE_CATALOGUE.missing_meta_description.weight,
    );
  });

  it('gives every finding a title, severity and weight', () => {
    for (const [code, definition] of Object.entries(ISSUE_CATALOGUE)) {
      expect(definition.code).toBe(code);
      expect(definition.title.length).toBeGreaterThan(3);
      expect(definition.detail.length).toBeGreaterThan(10);
      expect(['low', 'medium', 'high']).toContain(definition.severity);
      expect(definition.weight).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown code', () => {
    expect(issueDefinition('does_not_exist')).toBeNull();
  });
});
