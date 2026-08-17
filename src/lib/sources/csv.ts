import fs from 'node:fs';
import crypto from 'node:crypto';
import { BaseSourceAdapter } from './base';
import { mapGenericRecord } from './generic';
import type { DiscoverOptions, NormalizedBusiness, RawRecord } from './types';

/**
 * Minimal RFC 4180 CSV parser.
 *
 * Handles quoted fields, escaped double quotes and embedded newlines. Written
 * inline rather than pulled from a dependency because import files are small
 * and the parsing rules are fully specified.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const content = text.replace(/^﻿/, '');

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

export interface CsvDiscoverOptions extends DiscoverOptions {
  /** Path to a CSV file on disk. */
  filePath?: string;
  /** Raw CSV content, used by the /api/import endpoint. */
  content?: string;
}

export class CsvSourceAdapter extends BaseSourceAdapter {
  readonly key = 'csv';
  readonly displayName = 'CSV import';

  async discover(options: CsvDiscoverOptions): Promise<RawRecord[]> {
    const text =
      options.content ?? (options.filePath ? fs.readFileSync(options.filePath, 'utf8') : '');
    if (!text.trim()) return [];

    const retrievedAt = new Date().toISOString();
    const origin = options.filePath ?? 'inline';

    return parseCsv(text).map((row, index) => ({
      sourceId:
        row.source_id ||
        row.id ||
        `${origin}#${index}#${crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex').slice(0, 12)}`,
      sourceUrl: row.source_url || row.url || null,
      retrievedAt,
      payload: row,
    }));
  }

  parse(raw: RawRecord): NormalizedBusiness | null {
    return mapGenericRecord(raw, this.key, 0.6);
  }
}
