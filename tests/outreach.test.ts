import { describe, expect, it } from 'vitest';
import {
  composeMessage,
  evidenceLines,
  pickAngle,
  type OutreachEvidence,
} from '../src/lib/outreach/compose';

function evidence(overrides: Partial<OutreachEvidence> = {}): OutreachEvidence {
  return {
    name: 'Clínica Dental Ejemplo',
    category: 'dental_clinic',
    city: 'Malaga',
    hasWebsite: true,
    websiteUrl: 'https://ejemplo.es',
    domain: 'ejemplo.es',
    issueCodes: [],
    rating: null,
    reviewCount: null,
    opportunity: 70,
    digitalOpportunity: 60,
    ...overrides,
  };
}

describe('outreach angle selection', () => {
  it('leads with the missing website above every other finding', () => {
    const selection = pickAngle(
      evidence({ issueCodes: ['no_mobile_viewport', 'no_website', 'slow_response'] }),
    );
    expect(selection.angle).toBe('no_website');
  });

  it('treats an unreachable site as a different conversation from no site', () => {
    expect(pickAngle(evidence({ issueCodes: ['website_unreachable'] })).angle).toBe('unreachable');
    expect(pickAngle(evidence({ issueCodes: ['no_website'] })).angle).toBe('no_website');
  });

  it('prefers what an owner feels over what is technically severe', () => {
    // Both present: mobile costs the business money today, SEO tags do not.
    const selection = pickAngle(
      evidence({ issueCodes: ['missing_title', 'missing_h1', 'no_mobile_viewport'] }),
    );
    expect(selection.angle).toBe('mobile');
  });

  it('reports only the findings that justify the chosen angle', () => {
    const selection = pickAngle(
      evidence({ issueCodes: ['no_mobile_viewport', 'fixed_width_layout', 'missing_canonical'] }),
    );
    expect(selection.supportingCodes).toEqual(['no_mobile_viewport', 'fixed_width_layout']);
    expect(selection.supportingCodes).not.toContain('missing_canonical');
  });

  it('falls back to a conversion angle when the site has no catalogued failings', () => {
    const selection = pickAngle(evidence({ issueCodes: [] }));
    expect(selection.angle).toBe('polish');
    expect(selection.supportingCodes).toEqual([]);
  });
});

describe('outreach copy is grounded in the evidence', () => {
  it('never claims a problem when the audit found none', () => {
    const e = evidence({ issueCodes: [] });
    const message = composeMessage(e, pickAngle(e), { language: 'en', channel: 'email' });

    // The failure mode this guards against: inventing a fault to create urgency.
    expect(message.body).toContain('good technical shape');
    for (const forbidden of ['not adapted for mobile', 'not served over HTTPS', 'does not respond']) {
      expect(message.body).not.toContain(forbidden);
    }
  });

  it('cites the observed findings and nothing else', () => {
    const e = evidence({ issueCodes: ['no_https', 'broken_links'] });
    const selection = pickAngle(e);
    const message = composeMessage(e, selection, { language: 'en', channel: 'email' });

    for (const line of evidenceLines(selection.supportingCodes, 'en')) {
      expect(message.body).toContain(line);
    }
    expect(message.body).not.toContain('Missing meta description');
  });

  it('mentions public reputation only when there is enough of it', () => {
    const withReviews = evidence({
      rating: 4.7,
      reviewCount: 132,
      issueCodes: ['no_mobile_viewport'],
    });
    const thin = evidence({ rating: 5, reviewCount: 2, issueCodes: ['no_mobile_viewport'] });

    const a = composeMessage(withReviews, pickAngle(withReviews), {
      language: 'en',
      channel: 'email',
    });
    const b = composeMessage(thin, pickAngle(thin), { language: 'en', channel: 'email' });

    expect(a.body).toContain('132 reviews');
    expect(a.body).toContain('4.7');
    expect(b.body).not.toContain('reviews averaging');
  });

  it('writes Spanish copy with Spanish finding titles', () => {
    const e = evidence({ issueCodes: ['no_mobile_viewport'] });
    const message = composeMessage(e, pickAngle(e), { language: 'es', channel: 'email' });

    expect(message.body).toContain('Sin adaptación a móvil');
    expect(message.subject).toContain('Clínica Dental Ejemplo');
    expect(message.body).not.toContain('Weak mobile experience');
  });

  it('always offers a way to opt out of being contacted again', () => {
    const e = evidence({ issueCodes: ['no_https'] });
    expect(composeMessage(e, pickAngle(e), { language: 'es', channel: 'email' }).body).toContain(
      'no vuelva a escribir',
    );
    expect(composeMessage(e, pickAngle(e), { language: 'en', channel: 'email' }).body).toContain(
      "rather I didn't write again",
    );
  });

  it('names the business and uses the sender name it was given', () => {
    const e = evidence({
      issueCodes: ['no_website'],
      hasWebsite: false,
      domain: null,
      websiteUrl: null,
    });
    const message = composeMessage(e, pickAngle(e), {
      language: 'en',
      channel: 'email',
      senderName: 'Oussama',
    });

    expect(message.subject).toContain('Clínica Dental Ejemplo');
    expect(message.body).toContain('Oussama');
    expect(message.body).toContain('Malaga');
  });

  it('produces a usable shape for every channel', () => {
    const e = evidence({ issueCodes: ['no_booking_path'] });
    const selection = pickAngle(e);

    const email = composeMessage(e, selection, { language: 'es', channel: 'email' });
    const whatsapp = composeMessage(e, selection, { language: 'es', channel: 'whatsapp' });
    const script = composeMessage(e, selection, { language: 'es', channel: 'call_script' });
    const linkedin = composeMessage(e, selection, { language: 'es', channel: 'linkedin' });

    expect(email.subject.length).toBeGreaterThan(5);
    expect(script.body).toContain('GUION DE LLAMADA');
    // The short channels must actually be shorter, or the choice is cosmetic.
    expect(whatsapp.body.length).toBeLessThan(email.body.length);
    expect(linkedin.body.length).toBeLessThan(email.body.length);
  });
});
