import type { NormalizedBusiness, RawRecord } from './types';

/**
 * Field mapping shared by the CSV, JSON and manual adapters.
 *
 * Import files come from many places, so each logical field accepts several
 * common column spellings in both English and Spanish.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'nombre', 'business', 'business_name', 'razon_social', 'title'],
  legalName: ['legal_name', 'razon_social_legal', 'legal'],
  category: ['category', 'categoria', 'type', 'tipo', 'sector', 'actividad', 'rubro'],
  description: ['description', 'descripcion', 'about', 'notes'],
  address: ['address', 'direccion', 'full_address', 'formatted_address', 'domicilio'],
  street: ['street', 'calle', 'street_address', 'via'],
  postalCode: ['postal_code', 'postalcode', 'codigo_postal', 'cp', 'zip', 'zipcode'],
  municipality: ['municipality', 'municipio'],
  city: ['city', 'ciudad', 'localidad', 'poblacion', 'town'],
  province: ['province', 'provincia', 'state', 'region'],
  country: ['country', 'pais', 'country_code'],
  latitude: ['latitude', 'lat', 'latitud'],
  longitude: ['longitude', 'lon', 'lng', 'long', 'longitud'],
  phone: ['phone', 'telefono', 'telephone', 'tel', 'phone_number', 'movil'],
  email: ['email', 'correo', 'e_mail', 'mail', 'correo_electronico'],
  website: ['website', 'web', 'url', 'sitio_web', 'website_url', 'homepage'],
  rating: ['rating', 'valoracion', 'stars', 'puntuacion', 'score'],
  reviewCount: ['review_count', 'reviews', 'num_reviews', 'total_reviews', 'numero_resenas', 'resenas'],
  sourceUrl: ['source_url', 'url_fuente', 'listing_url', 'profile_url'],
  sourceId: ['source_id', 'id', 'external_id', 'place_id'],
  facebook: ['facebook', 'facebook_url'],
  instagram: ['instagram', 'instagram_url'],
  linkedin: ['linkedin', 'linkedin_url'],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function pick(record: Record<string, unknown>, field: string): unknown {
  const aliases = FIELD_ALIASES[field] ?? [field];
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== null && record[alias] !== '') {
      return record[alias];
    }
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Lower-cases and underscore-normalises every key of an imported row. */
export function canonicaliseKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[normalizeKey(key)] = value;
  return out;
}

/**
 * Maps an arbitrary imported row onto a NormalizedBusiness.
 * Returns null when the row has no usable business name.
 */
export function mapGenericRecord(
  raw: RawRecord,
  sourceKey: string,
  defaultConfidence: number,
): NormalizedBusiness | null {
  if (typeof raw.payload !== 'object' || raw.payload === null) return null;
  const record = canonicaliseKeys(raw.payload as Record<string, unknown>);

  const name = asString(pick(record, 'name'));
  if (!name) return null;

  const rating = asNumber(pick(record, 'rating'));
  const reviewCount = asNumber(pick(record, 'reviewCount'));

  const socials = [
    { platform: 'facebook', url: asString(pick(record, 'facebook')) },
    { platform: 'instagram', url: asString(pick(record, 'instagram')) },
    { platform: 'linkedin', url: asString(pick(record, 'linkedin')) },
  ]
    .filter((s): s is { platform: string; url: string } => s.url !== null)
    .map((s) => ({ platform: s.platform, url: s.url }));

  return {
    name,
    legalName: asString(pick(record, 'legalName')),
    categoryRaw: asString(pick(record, 'category')),
    description: asString(pick(record, 'description')),
    address: asString(pick(record, 'address')),
    street: asString(pick(record, 'street')),
    postalCode: asString(pick(record, 'postalCode')),
    municipality: asString(pick(record, 'municipality')),
    city: asString(pick(record, 'city')),
    province: asString(pick(record, 'province')),
    country: asString(pick(record, 'country')) ?? 'ES',
    latitude: asNumber(pick(record, 'latitude')),
    longitude: asNumber(pick(record, 'longitude')),
    phone: asString(pick(record, 'phone')),
    email: asString(pick(record, 'email')),
    websiteUrl: asString(pick(record, 'website')),
    socials,
    reviews:
      rating !== null || reviewCount !== null
        ? [
            {
              source: sourceKey,
              sourceUrl: asString(pick(record, 'sourceUrl')) ?? raw.sourceUrl,
              rating,
              reviewCount: reviewCount === null ? null : Math.round(reviewCount),
              confidence: defaultConfidence,
            },
          ]
        : [],
    source: sourceKey,
    sourceId: raw.sourceId,
    sourceUrl: asString(pick(record, 'sourceUrl')) ?? raw.sourceUrl,
    retrievedAt: raw.retrievedAt,
    confidence: defaultConfidence,
    raw: record,
  };
}
