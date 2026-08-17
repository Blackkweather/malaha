import crypto from 'node:crypto';

/**
 * Text normalisation shared by deduplication, search indexing and matching.
 *
 * Spanish business names carry accents, legal-form suffixes and punctuation
 * that vary between sources. Normalising all of it lets "Clinica Dental Malaga
 * S.L." and "Clínica Dental Málaga SL" match.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Removes diacritics so the whole pipeline can work in plain ASCII. */
export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '');
}

const LEGAL_SUFFIXES = [
  's.l.u.',
  's.l.u',
  's.l.',
  's.l',
  'slu',
  'sl',
  's.a.u.',
  's.a.',
  's.a',
  'sau',
  'sa',
  's.c.',
  'sc',
  's.coop.',
  'scoop',
  'c.b.',
  'cb',
  'sociedad limitada',
  'sociedad anonima',
];

const NOISE_WORDS = new Set(['the', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'e', 'en', 'al']);

/** Lowercase, accent-free, punctuation-free, single-spaced. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return stripDiacritics(String(input))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalised business name with Spanish legal-form suffixes removed. */
export function normalizeBusinessName(input: string | null | undefined): string {
  if (!input) return '';
  const value = stripDiacritics(String(input)).toLowerCase().trim();

  // Strip a trailing legal form ("... s.l.", "... sociedad limitada") when it is
  // separated from the name, so it never becomes part of the matching key.
  let stripped = value;
  for (const suffix of LEGAL_SUFFIXES) {
    for (const separator of [' ', ',', '.', '-']) {
      const tail = separator + suffix;
      if (stripped.length > tail.length && stripped.endsWith(tail)) {
        stripped = stripped.slice(0, stripped.length - tail.length);
        break;
      }
    }
  }

  return stripped
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Significant tokens of a business name, noise words removed. */
export function nameTokens(input: string | null | undefined): string[] {
  return normalizeBusinessName(input)
    .split(' ')
    .filter((t) => t.length > 1 && !NOISE_WORDS.has(t));
}

/** Jaccard similarity over significant name tokens (0..1). */
export function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(nameTokens(a));
  const setB = new Set(nameTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  return intersection / (setA.size + setB.size - intersection);
}

/** Normalised Levenshtein similarity (0..1). */
export function stringSimilarity(a: string, b: string): number {
  const s1 = normalizeBusinessName(a);
  const s2 = normalizeBusinessName(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const cols = s2.length + 1;
  let previous = new Array<number>(cols);
  let current = new Array<number>(cols);
  for (let j = 0; j < cols; j += 1) previous[j] = j;

  for (let i = 1; i <= s1.length; i += 1) {
    current[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  const distance = previous[cols - 1];
  return 1 - distance / Math.max(s1.length, s2.length);
}

/**
 * Combined name similarity. Token overlap is the primary signal; edit distance
 * catches spelling variants that tokenisation misses.
 */
export function nameSimilarity(a: string, b: string): number {
  return Math.max(tokenSimilarity(a, b), stringSimilarity(a, b) * 0.95);
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
