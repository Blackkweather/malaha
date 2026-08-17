import { describe, expect, it } from 'vitest';
import { verifyLocation } from '../src/lib/geo/verify';
import { haversineKm, MALAGA_SCOPE, resolveScope } from '../src/lib/geo/scope';

const MALAGA_CENTRE = { latitude: 36.7213, longitude: -4.4214 };

describe('Malaga verification — accepted', () => {
  it('accepts a full Malaga city address', () => {
    const verdict = verifyLocation({
      address: 'Calle Marques de Larios 12, 29005 Malaga',
      postalCode: '29005',
      municipality: 'Malaga',
      city: 'Malaga',
      province: 'Malaga',
      country: 'ES',
      ...MALAGA_CENTRE,
    });
    expect(verdict.inScope).toBe(true);
    expect(verdict.confidence).toBeGreaterThan(0.9);
  });

  it('accepts a verified city postal code plus municipality without coordinates', () => {
    const verdict = verifyLocation({
      postalCode: '29016',
      municipality: 'Málaga',
      country: 'ES',
    });
    expect(verdict.inScope).toBe(true);
  });

  it('accepts the accented spelling', () => {
    expect(verifyLocation({ postalCode: '29001', city: 'Málaga' }).inScope).toBe(true);
  });

  it('records the evidence that supported the decision', () => {
    const verdict = verifyLocation({
      postalCode: '29005',
      city: 'Malaga',
      ...MALAGA_CENTRE,
    });
    const signals = verdict.evidence.filter((e) => e.supports).map((e) => e.signal);
    expect(signals).toContain('postal_code');
    expect(signals).toContain('municipality');
    expect(signals).toContain('coordinates');
  });
});

describe('Malaga verification — rejected', () => {
  it('rejects neighbouring municipalities in the same province', () => {
    for (const municipality of ['Marbella', 'Torremolinos', 'Fuengirola', 'Benalmadena', 'Mijas']) {
      const verdict = verifyLocation({ municipality, province: 'Malaga', country: 'ES' });
      expect(verdict.inScope, `${municipality} must be rejected`).toBe(false);
      expect(verdict.confidence).toBe(0);
    }
  });

  it('rejects Velez-Malaga even though its name contains Malaga', () => {
    const verdict = verifyLocation({
      municipality: 'Velez-Malaga',
      province: 'Malaga',
      country: 'ES',
    });
    expect(verdict.inScope).toBe(false);
    expect(verdict.reason).toContain('outside');
  });

  it('rejects province postal codes that are not city postal codes', () => {
    const verdict = verifyLocation({ postalCode: '29601', province: 'Malaga', country: 'ES' });
    expect(verdict.inScope).toBe(false);
    expect(verdict.reason).toContain('not in Malaga city');
  });

  it('rejects other provinces', () => {
    expect(verifyLocation({ postalCode: '28013', city: 'Madrid' }).inScope).toBe(false);
    expect(verifyLocation({ postalCode: '08001', city: 'Barcelona' }).inScope).toBe(false);
  });

  it('rejects other countries outright', () => {
    const verdict = verifyLocation({ city: 'Malaga', country: 'PT' });
    expect(verdict.inScope).toBe(false);
    expect(verdict.reason).toContain('outside');
  });

  it('rejects coordinates outside the bounding box even when the text says Malaga', () => {
    const verdict = verifyLocation({
      city: 'Malaga',
      postalCode: '29005',
      latitude: 40.42,
      longitude: -3.7,
    });
    expect(verdict.inScope).toBe(false);
    expect(verdict.reason).toContain('bounding box');
  });

  it('rejects records with no geographic evidence at all', () => {
    expect(verifyLocation({}).inScope).toBe(false);
  });

  it('does not accept a bare province mention', () => {
    expect(verifyLocation({ province: 'Malaga', country: 'ES' }).inScope).toBe(false);
  });
});

describe('scope configuration', () => {
  it('resolves the Malaga scope', () => {
    expect(resolveScope('Malaga').key).toBe('malaga');
    expect(resolveScope('malaga').displayName).toBe('Malaga');
  });

  it('throws rather than silently widening for an unknown city', () => {
    expect(() => resolveScope('Sevilla')).toThrow(/Unknown geographic scope/);
  });

  it('measures distance from the city centre', () => {
    const distance = haversineKm(MALAGA_SCOPE.centroid, { lat: 36.5101, lon: -4.8858 });
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(60);
  });
});
