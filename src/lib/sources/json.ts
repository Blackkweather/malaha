import fs from 'node:fs';
import crypto from 'node:crypto';
import { BaseSourceAdapter } from './base';
import { mapGenericRecord } from './generic';
import type { DiscoverOptions, NormalizedBusiness, RawRecord } from './types';

export interface JsonDiscoverOptions extends DiscoverOptions {
  filePath?: string;
  /** Already-parsed records, used by the /api/import endpoint. */
  records?: unknown[];
}

/**
 * Imports an array of business objects, or an object with a `businesses`,
 * `records` or `data` array. Field names are mapped by the generic mapper.
 */
export class JsonSourceAdapter extends BaseSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  private readonly confidence: number;

  constructor(sourceKey = 'json', displayName = 'JSON import', confidence = 0.6) {
    super();
    this.key = sourceKey;
    this.displayName = displayName;
    this.confidence = confidence;
  }

  async discover(options: JsonDiscoverOptions): Promise<RawRecord[]> {
    let payload: unknown = options.records;

    if (!payload && options.filePath) {
      payload = JSON.parse(fs.readFileSync(options.filePath, 'utf8'));
    }
    if (!payload) return [];

    let items: unknown[];
    if (Array.isArray(payload)) {
      items = payload;
    } else if (typeof payload === 'object' && payload !== null) {
      const container = payload as Record<string, unknown>;
      const candidate = container.businesses ?? container.records ?? container.data;
      items = Array.isArray(candidate) ? candidate : [];
    } else {
      items = [];
    }

    const retrievedAt = new Date().toISOString();
    const origin = options.filePath ?? 'inline';

    return items.map((item, index) => {
      const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const explicitId = record.source_id ?? record.id ?? record.place_id;
      const hasExplicitId =
        explicitId !== undefined && explicitId !== null && String(explicitId) !== '';
      return {
        sourceId: hasExplicitId
          ? String(explicitId)
          : `${origin}#${index}#${crypto.createHash('sha1').update(JSON.stringify(record)).digest('hex').slice(0, 12)}`,
        sourceUrl: typeof record.source_url === 'string' ? record.source_url : null,
        retrievedAt: typeof record.retrieved_at === 'string' ? record.retrieved_at : retrievedAt,
        payload: record,
      };
    });
  }

  parse(raw: RawRecord): NormalizedBusiness | null {
    return mapGenericRecord(raw, this.key, this.confidence);
  }
}

/** Manual entry is a JSON import of a single hand-checked record. */
export class ManualSourceAdapter extends JsonSourceAdapter {
  constructor() {
    super('manual', 'Manual entry', 0.9);
  }
}
