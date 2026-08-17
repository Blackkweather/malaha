import { config } from '../config';
import { logger } from '../logger';

export interface RenderedPage {
  html: string;
  finalUrl: string;
  status: number | null;
  responseTimeMs: number;
}

/**
 * Minimal structural types for the Playwright surface actually used here.
 *
 * Declaring them locally keeps `playwright` a genuinely optional dependency:
 * the project type-checks and builds whether or not it is installed.
 */
interface MinimalResponse {
  status(): number;
}

interface MinimalPage {
  goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<MinimalResponse | null>;
  waitForTimeout(ms: number): Promise<void>;
  content(): Promise<string>;
  url(): string;
}

interface MinimalContext {
  newPage(): Promise<MinimalPage>;
  close(): Promise<void>;
}

interface MinimalBrowser {
  newContext(options: {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
  }): Promise<MinimalContext>;
  close(): Promise<void>;
}

interface MinimalPlaywright {
  chromium: { launch(options: { headless: boolean }): Promise<MinimalBrowser> };
}

/**
 * Renders a page with Playwright.
 *
 * Used ONLY when the fast HTTP fetch returns a shell that clearly needs
 * JavaScript to produce content. Playwright is an optional dependency: when it
 * is not installed, or AUDIT_ENABLE_PLAYWRIGHT is false, this returns null and
 * the auditor falls back to the HTTP result rather than failing.
 *
 * To enable:  npm install playwright && npx playwright install chromium
 */
export async function renderWithPlaywright(url: string): Promise<RenderedPage | null> {
  if (!config.audit.enablePlaywright) return null;

  let playwright: MinimalPlaywright;
  try {
    // An indirect specifier so bundlers do not try to resolve an optional package.
    const moduleName = 'playwright';
    playwright = (await import(/* webpackIgnore: true */ moduleName)) as unknown as MinimalPlaywright;
  } catch {
    logger.warn('Playwright is enabled but not installed; falling back to the HTTP result', { url });
    return null;
  }

  const started = Date.now();
  let browser: MinimalBrowser | null = null;

  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: config.audit.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'es-ES',
    });
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: config.audit.timeoutMs,
    });
    await page.waitForTimeout(1200);

    const html = await page.content();
    const finalUrl = page.url();
    const status = response ? response.status() : null;

    await context.close();
    return { html, finalUrl, status, responseTimeMs: Date.now() - started };
  } catch (err) {
    logger.warn('Playwright render failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
