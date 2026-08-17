/**
 * Email normalisation for publicly advertised business addresses.
 *
 * Role addresses (info@, contact@) are the norm for businesses and are treated
 * as business contact points. Anything that looks like a personal mailbox at a
 * consumer provider is flagged so it can be excluded from outreach exports.
 */

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const CONSUMER_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'live.com',
  'msn.com',
]);

const ROLE_LOCAL_PARTS = new Set([
  'info',
  'contacto',
  'contact',
  'hola',
  'cita',
  'citas',
  'reservas',
  'reservations',
  'admin',
  'administracion',
  'clinica',
  'recepcion',
  'ventas',
  'comercial',
  'atencion',
]);

export interface NormalizedEmail {
  value: string | null;
  isValid: boolean;
  domain: string | null;
  isRoleAddress: boolean;
  isConsumerProvider: boolean;
}

export function normalizeEmail(input: string | null | undefined): NormalizedEmail {
  const empty: NormalizedEmail = {
    value: null,
    isValid: false,
    domain: null,
    isRoleAddress: false,
    isConsumerProvider: false,
  };
  if (!input) return empty;

  const value = String(input).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
  if (!EMAIL_RE.test(value)) return empty;

  const [local, domain] = value.split('@');
  return {
    value,
    isValid: true,
    domain,
    isRoleAddress: ROLE_LOCAL_PARTS.has(local),
    isConsumerProvider: CONSUMER_DOMAINS.has(domain),
  };
}
