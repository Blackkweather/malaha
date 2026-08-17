/**
 * Minimal robots.txt parser.
 *
 * The auditor is a well-behaved crawler: if a site disallows a path we record
 * that fact and skip the page. A disallow is never worked around.
 */
export interface RobotsRules {
  /** Disallowed path prefixes that apply to us. */
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  /** True when robots.txt could not be read; we then assume allowed. */
  unavailable: boolean;
}

export const PERMISSIVE: RobotsRules = {
  disallow: [],
  allow: [],
  crawlDelayMs: 0,
  unavailable: true,
};

/** Parses robots.txt, honouring the `*` group and any group naming our agent. */
export function parseRobots(text: string, userAgentToken: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[]; delay: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [], delay: 0 };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;
    if (field === 'disallow') current.disallow.push(value);
    else if (field === 'allow') current.allow.push(value);
    else if (field === 'crawl-delay') {
      const delay = Number(value);
      if (Number.isFinite(delay)) current.delay = delay;
    }
  }

  const token = userAgentToken.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific ?? wildcard;

  if (!chosen) return { disallow: [], allow: [], crawlDelayMs: 0, unavailable: false };

  return {
    disallow: chosen.disallow.filter((d) => d !== ''),
    allow: chosen.allow.filter((a) => a !== ''),
    crawlDelayMs: Math.min(chosen.delay * 1000, 10_000),
    unavailable: false,
  };
}

/** Longest-match wins, with Allow beating Disallow, per the robots convention. */
export function isPathAllowed(rules: RobotsRules, pathname: string): boolean {
  if (rules.unavailable) return true;

  const longest = (patterns: string[]): number =>
    patterns
      .filter((p) => pathname.startsWith(p.replace(/\*$/, '')))
      .reduce((max, p) => Math.max(max, p.length), -1);

  const disallowMatch = longest(rules.disallow);
  const allowMatch = longest(rules.allow);

  if (disallowMatch === -1) return true;
  return allowMatch >= disallowMatch;
}
