/**
 * Spanish phone normalisation.
 *
 * Spain uses 9-digit national numbers with no trunk prefix. Landlines in the
 * Malaga province start with 95 (Malaga city is 951/952); mobiles start with
 * 6 or 7. Normalising to E.164 makes phone a reliable deduplication key.
 */

export interface NormalizedPhone {
  e164: string | null;
  national: string | null;
  isValid: boolean;
  isMobile: boolean;
  /** True when the landline prefix belongs to the Malaga province (95x). */
  isMalagaLandline: boolean;
}

const EMPTY: NormalizedPhone = {
  e164: null,
  national: null,
  isValid: false,
  isMobile: false,
  isMalagaLandline: false,
};

export function normalizePhone(input: string | null | undefined): NormalizedPhone {
  if (!input) return EMPTY;

  let digits = String(input).replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  digits = digits.replace(/(?!^)\+/g, '');

  let national: string;
  if (digits.startsWith('+34')) national = digits.slice(3);
  else if (digits.startsWith('34') && digits.length === 11) national = digits.slice(2);
  else if (digits.startsWith('+')) return EMPTY; // a non-Spanish country code
  else national = digits;

  national = national.replace(/\D/g, '');
  if (national.length !== 9) return EMPTY;

  const first = national[0];
  if (!'6789'.includes(first)) return EMPTY;

  return {
    e164: '+34' + national,
    national,
    isValid: true,
    isMobile: first === '6' || first === '7',
    isMalagaLandline: national.startsWith('95'),
  };
}

/** Deduplication key: the E.164 form, or null when the number is unusable. */
export function phoneKey(input: string | null | undefined): string | null {
  return normalizePhone(input).e164;
}

/** Human-friendly Spanish presentation, e.g. "+34 952 12 34 56". */
export function formatPhone(input: string | null | undefined): string | null {
  const { e164, national } = normalizePhone(input);
  if (!e164 || !national) return null;
  return `+34 ${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
}
