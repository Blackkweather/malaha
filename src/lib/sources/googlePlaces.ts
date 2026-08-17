import { config, googlePlacesEnabled } from '../config';
import { logger } from '../logger';
import { resolveScope } from '../geo/scope';
import { BaseSourceAdapter } from './base';
import type { DiscoverOptions, NormalizedBusiness, RawRecord } from './types';

interface PlaceAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface Place {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: PlaceAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  googleMapsUri?: string;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.businessStatus',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

function component(place: Place, type: string): string | null {
  const match = place.addressComponents?.find((c) => c.types?.includes(type));
  return match?.longText ?? match?.shortText ?? null;
}

/**
 * Google Places API (New) adapter.
 *
 * Uses the official, documented Text Search endpoint with an API key supplied
 * by the operator. This is the source of the public rating and review-count
 * signals; nothing is scraped and no undocumented endpoint is touched. Without
 * a key the adapter reports itself unconfigured and the pipeline skips it.
 */
export class GooglePlacesSourceAdapter extends BaseSourceAdapter {
  readonly key = 'google_places';
  readonly displayName = 'Google Places API';

  isConfigured(): boolean {
    return googlePlacesEnabled();
  }

  async discover(options: DiscoverOptions): Promise<RawRecord[]> {
    if (!this.isConfigured()) return [];

    const scope = resolveScope(config.geo.city);
    const query = (options.query ?? '').trim();
    const textQuery = query
      ? `${query} in ${scope.displayName}, Spain`
      : `businesses in ${scope.displayName}, Spain`;
    const limit = options.limit ?? 60;

    const records: RawRecord[] = [];
    let pageToken: string | undefined;
    const retrievedAt = new Date().toISOString();

    // The endpoint returns 20 results per page and at most three pages.
    for (let page = 0; page < 3 && records.length < limit; page += 1) {
      const body: Record<string, unknown> = {
        textQuery,
        languageCode: 'es',
        regionCode: 'ES',
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: scope.centroid.lat, longitude: scope.centroid.lon },
            radius: scope.radiusKm * 1000,
          },
        },
      };
      if (pageToken) body.pageToken = pageToken;

      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': config.sources.googlePlacesApiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          logger.warn('Google Places request refused', {
            status: response.status,
            statusText: response.statusText,
          });
          break;
        }

        const payload = (await response.json()) as { places?: Place[]; nextPageToken?: string };
        for (const place of payload.places ?? []) {
          if (!place.id) continue;
          records.push({
            sourceId: place.id,
            sourceUrl: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            retrievedAt,
            payload: place,
          });
        }

        pageToken = payload.nextPageToken;
        if (!pageToken) break;
      } catch (err) {
        logger.warn('Google Places request failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }
    }

    return records.slice(0, limit);
  }

  parse(raw: RawRecord): NormalizedBusiness | null {
    const place = raw.payload as Place;
    const name = place.displayName?.text;
    if (!name) return null;

    // Permanently closed businesses are not prospects.
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return null;

    const streetNumber = component(place, 'street_number');
    const route = component(place, 'route');
    const street = [route, streetNumber].filter(Boolean).join(' ') || null;

    const categoryRaw = place.primaryType ?? place.types?.[0] ?? null;

    return {
      name,
      categoryRaw,
      categoryHints: [place.primaryTypeDisplayName?.text ?? '', ...(place.types ?? [])].filter(Boolean),
      address: place.formattedAddress ?? place.shortFormattedAddress ?? null,
      street,
      postalCode: component(place, 'postal_code'),
      municipality: component(place, 'locality') ?? component(place, 'postal_town'),
      city: component(place, 'locality'),
      province: component(place, 'administrative_area_level_2'),
      country: component(place, 'country') === 'España' ? 'ES' : component(place, 'country') ?? 'ES',
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
      email: null,
      websiteUrl: place.websiteUri ?? null,
      socials: [],
      reviews:
        place.rating !== undefined || place.userRatingCount !== undefined
          ? [
              {
                source: 'google',
                sourceUrl: raw.sourceUrl,
                rating: place.rating ?? null,
                reviewCount: place.userRatingCount ?? null,
                confidence: 0.9,
              },
            ]
          : [],
      source: this.key,
      sourceId: raw.sourceId,
      sourceUrl: raw.sourceUrl,
      retrievedAt: raw.retrievedAt,
      confidence: 0.9,
      raw: place as unknown as Record<string, unknown>,
    };
  }
}
