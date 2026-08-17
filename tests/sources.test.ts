import { describe, expect, it } from 'vitest';
import { parseCsv, CsvSourceAdapter } from '../src/lib/sources/csv';
import { JsonSourceAdapter } from '../src/lib/sources/json';
import { GooglePlacesSourceAdapter } from '../src/lib/sources/googlePlaces';
import { getAdapter, listAdapters, listAutomaticAdapters } from '../src/lib/sources/registry';
import { mapGenericRecord } from '../src/lib/sources/generic';

describe('CSV parsing', () => {
  it('handles quoting, escaped quotes and embedded separators', () => {
    const csv = [
      'name,address,notes',
      '"Clinica, S.L.","Calle Larios 1","He said ""hello"""',
      'Simple,Calle Dos,plain',
    ].join('\n');

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Clinica, S.L.');
    expect(rows[0].notes).toBe('He said "hello"');
    expect(rows[1].name).toBe('Simple');
  });

  it('accepts semicolon separators and CRLF endings', () => {
    const rows = parseCsv('name;city\r\nUno;Malaga\r\n');
    expect(rows[0]).toEqual({ name: 'Uno', city: 'Malaga' });
  });

  it('returns nothing for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('generic field mapping', () => {
  it('accepts English and Spanish column names', () => {
    const mapped = mapGenericRecord(
      {
        sourceId: 'x1',
        sourceUrl: null,
        retrievedAt: new Date().toISOString(),
        payload: {
          nombre: 'Clinica Uno',
          categoria: 'clinica dental',
          direccion: 'Calle Larios 1',
          codigo_postal: '29005',
          ciudad: 'Malaga',
          telefono: '+34 951 000 001',
          correo: 'info@uno.example',
          web: 'https://uno.example',
          valoracion: '4,8',
          resenas: '320',
        },
      },
      'csv',
      0.6,
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.name).toBe('Clinica Uno');
    expect(mapped?.postalCode).toBe('29005');
    expect(mapped?.reviews?.[0].rating).toBeCloseTo(4.8, 2);
    expect(mapped?.reviews?.[0].reviewCount).toBe(320);
  });

  it('returns null when there is no usable name', () => {
    const mapped = mapGenericRecord(
      {
        sourceId: 'x',
        sourceUrl: null,
        retrievedAt: new Date().toISOString(),
        payload: { city: 'Malaga' },
      },
      'csv',
      0.6,
    );
    expect(mapped).toBeNull();
  });
});

describe('adapter contract', () => {
  it('every adapter implements the five stages', () => {
    for (const adapter of listAdapters()) {
      expect(typeof adapter.discover).toBe('function');
      expect(typeof adapter.parse).toBe('function');
      expect(typeof adapter.normalize).toBe('function');
      expect(typeof adapter.validate).toBe('function');
      expect(typeof adapter.persist).toBe('function');
      expect(adapter.key).toBeTruthy();
    }
  });

  it('resolves adapters by key', () => {
    expect(getAdapter('csv')).not.toBeNull();
    expect(getAdapter('openstreetmap')).not.toBeNull();
    expect(getAdapter('nope')).toBeNull();
  });

  it('reports Google Places as unconfigured without a key', () => {
    expect(new GooglePlacesSourceAdapter().isConfigured()).toBe(false);
    expect(listAutomaticAdapters().some((a) => a.key === 'google_places')).toBe(false);
  });

  it('stamps provenance onto every parsed record', async () => {
    const adapter = new JsonSourceAdapter('json', 'JSON', 0.6);
    const raw = await adapter.discover({ records: [{ name: 'Uno', city: 'Malaga' }] });
    const parsed = adapter.parse(raw[0]);
    expect(parsed?.source).toBe('json');
    expect(parsed?.sourceId).toBeTruthy();
    expect(Date.parse(parsed?.retrievedAt ?? '')).not.toBeNaN();
    expect(parsed?.confidence).toBeGreaterThan(0);
  });

  it('rejects a record without provenance', () => {
    const adapter = new CsvSourceAdapter();
    const result = adapter.validate({
      name: 'Sin Fuente',
      source: '',
      sourceId: '',
      sourceUrl: null,
      retrievedAt: 'not-a-date',
      confidence: 0.5,
      raw: {},
      city: 'Malaga',
      postalCode: '29005',
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toContain('provenance');
  });
});
