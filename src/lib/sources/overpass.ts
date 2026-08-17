import { config } from '../config';
import { logger } from '../logger';
import { MALAGA_SCOPE, resolveScope } from '../geo/scope';
import { classifyCategory } from '../normalize/category';
import { BaseSourceAdapter } from './base';
import { allSelectors, selectorsForCategories } from './overpassTags';
import type { DiscoverOptions, NormalizedBusiness, RawRecord } from './types';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassDiscoverOptions extends DiscoverOptions {
  /** Explicit "key=value" selectors; overrides the query-derived ones. */
  selectors?: string[];
}

/**
 * OpenStreetMap Overpass API adapter.
 *
 * Overpass is a public, key-free endpoint. This adapter issues ONE bounded
 * query per ingestion run inside the configured bounding box and respects the
 * endpoint's timeout parameter. If the endpoint refuses or rate-limits the
 * request, the failure is recorded and ingestion moves on — there is no retry
 * storm and no evasion of any limit.
 */
export class OverpassSourceAdapter extends BaseSourceAdapter {
  readonly key = 'openstreetmap';
  readonly displayName = 'OpenStreetMap (Overpass API)';

  isConfigured(): boolean {
    return config.sources.overpassEndpoint.trim().length > 0;
  }

  /** Builds bounded Overpass QL for the configured scope. */
  buildQuery(selectors: string[]): string {
    const scope = resolveScope(config.geo.city);
    const box = scope.boundingBox;
    const bbox = `${box.minLat},${box.minLon},${box.maxLat},${box.maxLon}`;
    const timeoutSeconds = Math.max(25, Math.round(config.sources.overpassTimeoutMs / 1000));

    const clauses = selectors
      .map((selector) => {
        const [key, value] = selector.split('=');
        if (!key || !value) return null;
        return ['node', 'way']
          .map((kind) => `  ${kind}["${key}"="${value}"]["name"](${bbox});`)
          .join('\n');
      })
      .filter((c): c is string => c !== null)
      .join('\n');

    return `[out:json][timeout:${timeoutSeconds}];\n(\n${clauses}\n);\nout center tags;`;
  }

  async discover(options: OverpassDiscoverOptions): Promise<RawRecord[]> {
    if (!this.isConfigured()) return [];

    let selectors = options.selectors ?? [];
    if (selectors.length === 0 && options.query) {
      const match = classifyCategory(options.query, options.query);
      selectors = selectorsForCategories([match.key]);
    }
    if (selectors.length === 0) selectors = allSelectors();

    const query = this.buildQuery(selectors);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.sources.overpassTimeoutMs);

    try {
      const response = await fetch(config.sources.overpassEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': config.sources.overpassUserAgent,
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        // A refusal (429/504) is recorded and accepted, never worked around.
        logger.warn('Overpass request refused', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const body = (await response.json()) as { elements?: OverpassElement[] };
      const elements = body.elements ?? [];
      const retrievedAt = new Date().toISOString();
      const limit = options.limit ?? elements.length;

      return elements.slice(0, limit).map((element) => ({
        sourceId: `${element.type}/${element.id}`,
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        retrievedAt,
        payload: element,
      }));
    } catch (err) {
      logger.warn('Overpass request failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  parse(raw: RawRecord): NormalizedBusiness | null {
    const element = raw.payload as OverpassElement;
    const tags = element.tags ?? {};
    const name = tags.name ?? tags['name:es'] ?? tags['name:en'];
    if (!name) return null;

    const lat = element.lat ?? element.center?.lat ?? null;
    const lon = element.lon ?? element.center?.lon ?? null;

    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || null;
    const address =
      [street, tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(', ') || null;

    // The OSM primary tag becomes the raw category, e.g. "amenity=dentist".
    const primaryTagKey = ['amenity', 'shop', 'office', 'craft', 'healthcare', 'tourism', 'leisure'].find(
      (key) => tags[key] !== undefined,
    );
    const categoryRaw = primaryTagKey ? `${primaryTagKey}=${tags[primaryTagKey]}` : null;

    const socials = [
      { platform: 'facebook', url: tags['contact:facebook'] ?? '' },
      { platform: 'instagram', url: tags['contact:instagram'] ?? '' },
      { platform: 'twitter', url: tags['contact:twitter'] ?? '' },
    ].filter((s) => s.url !== '');

    return {
      name,
      categoryRaw,
      categoryHints: [
        tags.cuisine ?? '',
        tags.healthcare ?? '',
        tags['healthcare:speciality'] ?? '',
        tags.description ?? '',
      ].filter(Boolean),
      description: tags.description ?? null,
      address,
      street,
      postalCode: tags['addr:postcode'] ?? null,
      municipality: tags['addr:city'] ?? null,
      city: tags['addr:city'] ?? null,
      province: MALAGA_SCOPE.province,
      country: tags['addr:country'] ?? 'ES',
      latitude: lat,
      longitude: lon,
      phone: tags.phone ?? tags['contact:phone'] ?? null,
      email: tags.email ?? tags['contact:email'] ?? null,
      websiteUrl: tags.website ?? tags['contact:website'] ?? null,
      socials,
      // OpenStreetMap carries no review or rating data.
      reviews: [],
      source: this.key,
      sourceId: raw.sourceId,
      sourceUrl: raw.sourceUrl,
      retrievedAt: raw.retrievedAt,
      confidence: 0.75,
      raw: tags as Record<string, unknown>,
    };
  }
}
