import { describe, expect, it } from 'vitest';
import {
  nameSimilarity,
  normalizeBusinessName,
  normalizeText,
  stripDiacritics,
} from '../src/lib/normalize/text';
import { formatPhone, normalizePhone, phoneKey } from '../src/lib/normalize/phone';
import {
  extractDomain,
  extractHost,
  isFreeSiteBuilderHost,
  isNonOfficialHost,
  normalizeUrl,
  sameDomain,
} from '../src/lib/normalize/domain';
import { normalizeEmail } from '../src/lib/normalize/email';
import { classifyCategory } from '../src/lib/normalize/category';

describe('text normalisation', () => {
  it('strips Spanish diacritics', () => {
    expect(stripDiacritics('Málaga Clínica Peluquería')).toBe('Malaga Clinica Peluqueria');
  });

  it('normalises punctuation and case', () => {
    expect(normalizeText('  Clínica  Dental,  Málaga! ')).toBe('clinica dental malaga');
  });

  it('removes Spanish legal-form suffixes from business names', () => {
    expect(normalizeBusinessName('Clínica Dental Málaga S.L.')).toBe('clinica dental malaga');
    expect(normalizeBusinessName('Reformas Guadalmedina SL')).toBe('reformas guadalmedina');
    expect(normalizeBusinessName('Hotel Puerto, S.A.')).toBe('hotel puerto');
  });

  it('does not strip a suffix that is part of the name itself', () => {
    expect(normalizeBusinessName('Grupo Sala')).toBe('grupo sala');
  });

  it('treats accented and legal-form variants as the same business', () => {
    expect(nameSimilarity('Clínica Dental Málaga S.L.', 'Clinica Dental Malaga')).toBeGreaterThan(
      0.9,
    );
  });

  it('does not confuse unrelated businesses', () => {
    expect(nameSimilarity('Clinica Dental Larios', 'Restaurante El Pimpi')).toBeLessThan(0.4);
  });
});

describe('phone normalisation', () => {
  it('normalises Spanish numbers to E.164', () => {
    expect(phoneKey('952 12 34 56')).toBe('+34952123456');
    expect(phoneKey('(+34) 952-12-34-56')).toBe('+34952123456');
  });

  it('accepts the common written formats', () => {
    for (const input of ['+34 951 000 001', '0034951000001', '951000001', '951 00 00 01']) {
      expect(normalizePhone(input).e164).toBe('+34951000001');
    }
  });

  it('identifies mobiles and Malaga landlines', () => {
    expect(normalizePhone('600123456').isMobile).toBe(true);
    expect(normalizePhone('952123456').isMalagaLandline).toBe(true);
    expect(normalizePhone('913123456').isMalagaLandline).toBe(false);
  });

  it('rejects unusable numbers', () => {
    expect(normalizePhone('12345').isValid).toBe(false);
    expect(normalizePhone('+441234567890').isValid).toBe(false);
    expect(normalizePhone(null).isValid).toBe(false);
    expect(normalizePhone('112345678').isValid).toBe(false);
  });

  it('formats for display', () => {
    expect(formatPhone('+34951000001')).toBe('+34 951 00 00 01');
  });
});

describe('domain normalisation', () => {
  it('extracts the registrable domain', () => {
    expect(extractDomain('https://www.clinica.example.com/contacto')).toBe('example.com');
    expect(extractDomain('http://sub.dominio.com.es')).toBe('dominio.com.es');
    expect(extractHost('https://WWW.Example.COM')).toBe('example.com');
  });

  it('canonicalises URLs and drops tracking parameters', () => {
    expect(normalizeUrl('http://www.example.com/page/?utm_source=x&id=3#top')).toBe(
      'https://example.com/page?id=3',
    );
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('recognises non-official hosts', () => {
    expect(isNonOfficialHost('https://facebook.com/mybusiness')).toBe(true);
    expect(isNonOfficialHost('https://www.instagram.com/mybusiness')).toBe(true);
    expect(isNonOfficialHost('https://miclinica.es')).toBe(false);
  });

  it('recognises free site builders', () => {
    expect(isFreeSiteBuilderHost('https://myshop.wixsite.com/home')).toBe(true);
    expect(isFreeSiteBuilderHost('https://miclinica.es')).toBe(false);
  });

  it('compares domains', () => {
    expect(sameDomain('https://www.a.com/x', 'http://a.com/y')).toBe(true);
    expect(sameDomain('https://a.com', 'https://b.com')).toBe(false);
  });
});

describe('email normalisation', () => {
  it('accepts business addresses and flags role and consumer mailboxes', () => {
    const role = normalizeEmail('  INFO@Clinica.ES ');
    expect(role.value).toBe('info@clinica.es');
    expect(role.isRoleAddress).toBe(true);
    expect(role.isConsumerProvider).toBe(false);

    expect(normalizeEmail('someone@gmail.com').isConsumerProvider).toBe(true);
    expect(normalizeEmail('not-an-email').isValid).toBe(false);
  });
});

describe('category classification', () => {
  it('prefers the most specific category', () => {
    expect(classifyCategory('clinica dental').key).toBe('dental_clinic');
    expect(classifyCategory('amenity=dentist').key).toBe('dental_clinic');
    expect(classifyCategory('office=lawyer').key).toBe('law_firm');
  });

  it('does not match a single word inside a longer word', () => {
    // "bar" must not classify "barberia" as a bar.
    expect(classifyCategory('barberia').key).toBe('beauty');
  });

  it('falls back to the business name with lower confidence', () => {
    const byName = classifyCategory(null, 'Clinica Dental Larios');
    expect(byName.key).toBe('dental_clinic');
    expect(byName.confidence).toBeLessThan(classifyCategory('clinica dental').confidence);
  });

  it('marks irrelevant categories as excluded', () => {
    expect(classifyCategory('cajero').excluded).toBe(true);
    expect(classifyCategory('ayuntamiento').excluded).toBe(true);
    expect(classifyCategory('clinica dental').excluded).toBe(false);
  });

  it('returns the neutral category when nothing matches', () => {
    const unknown = classifyCategory('zzzz unknown trade', 'Zzzz');
    expect(unknown.key).toBe('other');
  });
});
