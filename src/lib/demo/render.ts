import type { DemoConcept, DemoTheme } from './concept';

/** Escapes text for safe interpolation into the generated HTML document. */
export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes a URL, refusing anything that is not an expected safe scheme. */
export function safeHref(value: string | null | undefined): string {
  if (!value) return '#';
  const trimmed = String(value).trim();
  if (/^(https?:|tel:|mailto:|#|\/)/i.test(trimmed)) return escapeHtml(trimmed);
  return '#';
}

/**
 * Palette for the chosen mode.
 *
 * Most Spanish local businesses run light sites; a uniformly dark concept reads
 * as a template rather than a proposal. Hospitality and nightlife are the
 * exception, so both modes exist and the sector picks one.
 */
function palette(theme: DemoTheme): Record<string, string> {
  return theme.mode === 'dark'
    ? {
        bg: '#0b0a09',
        surface: '#17150f',
        surface2: '#221f18',
        text: '#f7f4ee',
        muted: '#a49b8f',
        border: '#2a251d',
        onAccent: '#0c0a09',
        shadow: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px -8px rgba(0,0,0,.6)',
      }
    : {
        // Off-white rather than #fff, ink rather than slate: paper, not UI.
        bg: '#faf9f7',
        surface: '#f4f2ee',
        surface2: '#eeebe4',
        text: '#14110f',
        muted: '#6b625b',
        border: '#e3ded4',
        onAccent: '#ffffff',
        shadow: '0 1px 2px rgba(15,23,42,.04), 0 12px 32px -12px rgba(15,23,42,.18)',
      };
}

export function renderStyles(accent: string, theme?: DemoTheme): string {
  const t: DemoTheme =
    theme ?? { mode: 'light', accent, accentSoft: '#e0f2fe', headingFont: 'sans', heroStyle: 'split' };
  const c = palette(t);
  const heading =
    t.headingFont === 'serif'
      ? `ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif`
      : `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  return `
    :root {
      --accent: ${escapeHtml(accent)};
      --accent-soft: ${escapeHtml(t.accentSoft)};
      --on-accent: ${c.onAccent};
      --bg: ${c.bg};
      --surface: ${c.surface};
      --surface-2: ${c.surface2};
      --text: ${c.text};
      --muted: ${c.muted};
      --border: ${c.border};
      --shadow: ${c.shadow};
      --heading: ${heading};
      --body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
    body {
      background: var(--bg); color: var(--text); font-family: var(--body);
      line-height: 1.65; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }
    h1, h2, h3, .brand-name { font-family: var(--heading); letter-spacing: -.022em; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
    a { color: inherit; }
    :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

    /* ---- header ---------------------------------------------------------- */
    header {
      position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px);
      background: color-mix(in srgb, var(--bg) 86%, transparent);
      border-bottom: 1px solid var(--border);
    }
    .nav { display: flex; align-items: center; gap: 20px; padding: 14px 0; }
    .brand { display: flex; align-items: center; gap: 11px; text-decoration: none; margin-right: auto; }
    .mark {
      width: 38px; height: 38px; flex: none; border-radius: 11px; display: grid; place-items: center;
      background: var(--accent); color: var(--on-accent);
      font-weight: 700; font-size: .88rem; letter-spacing: .02em;
    }
    .brand-name { font-weight: 650; font-size: 1.02rem; line-height: 1.2; }
    .brand-sub { display: block; font-family: var(--body); font-size: .72rem; color: var(--muted); letter-spacing: .04em; }
    .nav-links { display: none; gap: 26px; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: .92rem; }
    .nav-links a:hover { color: var(--text); }

    /* ---- buttons --------------------------------------------------------- */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 13px 22px; border-radius: 11px; font-weight: 600; text-decoration: none;
      font-size: .95rem; border: 1px solid transparent; cursor: pointer; font-family: var(--body);
      transition: transform .15s ease, filter .15s ease, background .15s ease;
    }
    .btn:active { transform: translateY(1px); }
    .btn-primary { background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow); }
    .btn-primary:hover { filter: brightness(1.07); }
    .btn-ghost { border-color: var(--border); color: var(--text); background: var(--bg); }
    .btn-ghost:hover { background: var(--surface-2); }
    .btn-wa { background: #25d366; color: #05240f; }

    /* ---- hero ------------------------------------------------------------ */
    .hero { position: relative; overflow: hidden; padding: clamp(84px, 12vw, 150px) 0 clamp(72px, 10vw, 120px); }
    .hero::before {
      content: ""; position: absolute; inset: -40% -20% auto -20%; height: 130%; z-index: -1;
      background:
        radial-gradient(58% 46% at 78% 8%, var(--accent-soft) 0%, transparent 62%),
        radial-gradient(42% 38% at 8% 4%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 60%);
    }
    .hero-grid { display: grid; gap: 44px; grid-template-columns: 1fr; align-items: center; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 10px; font-family: var(--mono);
      font-size: .72rem; letter-spacing: .16em; text-transform: uppercase;
      color: var(--muted); font-weight: 500;
    }
    .eyebrow::before { content: ""; width: 26px; height: 1px; background: var(--accent); }
    h1 { font-size: clamp(2.7rem, 8vw, 5.6rem); line-height: .96; margin: 30px 0 26px; font-weight: 600; letter-spacing: -.035em; }
    .lede { color: var(--muted); font-size: clamp(1.02rem, 2.2vw, 1.18rem); max-width: 60ch; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 30px; color: var(--muted); font-size: .88rem; }
    .hero-meta strong { color: var(--text); font-weight: 650; }

    /* The hero card stands in for photography the business has not supplied. */
    .hero-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
      padding: 26px; box-shadow: var(--shadow); position: relative; overflow: hidden;
    }
    .hero-card::after {
      content: ""; position: absolute; right: -30%; top: -40%; width: 80%; height: 80%;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 68%);
    }
    .hero-card h3 { font-size: 1rem; margin-bottom: 14px; }
    .checks { list-style: none; display: grid; gap: 11px; }
    .checks li { display: flex; gap: 11px; align-items: flex-start; font-size: .93rem; color: var(--muted); }
    .tick {
      flex: none; width: 21px; height: 21px; border-radius: 999px; margin-top: 1px;
      background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
      display: grid; place-items: center; font-size: .68rem; font-weight: 800;
    }

    /* ---- sections -------------------------------------------------------- */
    /* Whitespace does most of the work: sections breathe, and the border is
       a hairline rather than a box. */
    section { padding: clamp(72px, 11vw, 132px) 0; border-top: 1px solid var(--border); }
    .section-head { max-width: 62ch; margin-bottom: clamp(34px, 5vw, 56px); }
    h2 { font-size: clamp(1.9rem, 4.6vw, 3.1rem); margin-bottom: 16px; font-weight: 600; line-height: 1.04; letter-spacing: -.03em; }
    .section-sub { color: var(--muted); font-size: clamp(1rem, 1.6vw, 1.1rem); }
    .section-index {
      display: block; font-family: var(--mono); font-size: .72rem; font-weight: 500;
      letter-spacing: .16em; color: var(--muted); margin-bottom: 18px;
      padding-bottom: 14px; border-bottom: 1px solid var(--border);
    }

    /* Scroll reveal. Everything is visible by default so the page still
       reads with JavaScript disabled; the script opts in to animating. */
    .js-reveal .reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1); }
    .js-reveal .reveal.in { opacity: 1; transform: none; }

    /* Closing call to action, set on the accent so the page ends on it. */
    .cta-band { background: var(--accent); color: var(--on-accent); border-radius: 4px; padding: clamp(36px, 6vw, 68px); }
    .cta-band h2 { color: var(--on-accent); }
    .cta-band p { color: color-mix(in srgb, var(--on-accent) 82%, transparent); max-width: 52ch; }
    .cta-band .btn-ghost { border-color: color-mix(in srgb, var(--on-accent) 45%, transparent); color: var(--on-accent); background: transparent; }

    .stock-note { margin-top: 14px; font-size: .78rem; color: var(--muted); }
    .grid { display: grid; gap: 18px; grid-template-columns: 1fr; }
    /* Whitespace does the work a border used to do. */
    .card {
      background: transparent; border: 0; border-top: 1px solid var(--border);
      border-radius: 0; padding: 26px 0 0; transition: opacity .2s ease;
    }
    .card:hover { opacity: .72; }
    .card h3 { font-weight: 600; }
    .card h3 { font-size: 1.08rem; margin-bottom: 9px; }
    .card p { color: var(--muted); font-size: .95rem; }
    /* A quiet numeral, not a coloured chip. */
    .card-icon {
      font-family: var(--mono); font-size: .74rem; letter-spacing: .12em; color: var(--muted);
      margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
    }
    .steps { counter-reset: step; display: grid; gap: 18px; grid-template-columns: 1fr; }
    .step { position: relative; padding-left: 60px; }
    .step::before {
      counter-increment: step; content: counter(step); position: absolute; left: 0; top: 0;
      width: 42px; height: 42px; border-radius: 999px; display: grid; place-items: center;
      background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem;
    }
    .step h3 { font-size: 1.05rem; margin-bottom: 6px; }
    .step p { color: var(--muted); font-size: .95rem; }

    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
    .stat .value { font-size: 1.9rem; font-weight: 700; letter-spacing: -.03em; font-family: var(--heading); }
    .stat .label { color: var(--muted); font-size: .82rem; margin-top: 5px; }
    .rating { color: var(--accent); font-weight: 700; font-size: 1.5rem; font-family: var(--heading); }
    .stars { letter-spacing: .12em; color: var(--accent); font-size: 1rem; }

    details.faq { border-bottom: 1px solid var(--border); padding: 18px 0; }
    details.faq summary { cursor: pointer; font-weight: 600; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
    details.faq summary::-webkit-details-marker { display: none; }
    details.faq summary::after { content: "+"; color: var(--accent); font-weight: 700; font-size: 1.3rem; line-height: 1; }
    details.faq[open] summary::after { content: "\\2212"; }
    details.faq p { color: var(--muted); margin-top: 12px; font-size: .95rem; }

    .contact-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
    .field { display: block; margin-bottom: 15px; }
    .field span { display: block; font-size: .82rem; color: var(--muted); margin-bottom: 7px; font-weight: 500; }
    .field input, .field textarea {
      width: 100%; padding: 13px 15px; border-radius: 11px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font: inherit;
    }
    .field input:focus, .field textarea:focus { border-color: var(--accent); outline: none; }
    .field textarea { min-height: 122px; resize: vertical; }
    dl.details div { display: flex; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--border); }
    dl.details dt { color: var(--muted); font-size: .9rem; }
    dl.details dd { text-align: right; font-size: .92rem; font-weight: 500; }
    a.plain { color: var(--accent); text-decoration: none; font-weight: 500; }
    a.plain:hover { text-decoration: underline; }

    .map {
      margin-top: 18px; border-radius: 3px; border: 1px solid var(--border); overflow: hidden;
      background:
        linear-gradient(color-mix(in srgb, var(--accent) 7%, transparent), color-mix(in srgb, var(--accent) 7%, transparent)),
        repeating-linear-gradient(0deg, var(--surface-2) 0 1px, transparent 1px 34px),
        repeating-linear-gradient(90deg, var(--surface-2) 0 1px, transparent 1px 34px);
      background-color: var(--surface); height: 190px; position: relative;
    }
    .pin {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -100%);
      width: 26px; height: 26px; border-radius: 999px 999px 999px 2px; rotate: -45deg;
      background: var(--accent); box-shadow: var(--shadow);
    }

    /* ---- imagery --------------------------------------------------------- */
    /*
     * Photographs come from the business's own website, so their dimensions
     * are unknown and arbitrary. Fixed aspect ratios with object-fit keep the
     * layout intact whatever shape arrives, and a tinted surface sits behind
     * every frame so a slow or dead image never leaves a white hole.
     */
    .shot { position: relative; overflow: hidden; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--border); }
    .shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .shot-hero { aspect-ratio: 4 / 3; box-shadow: var(--shadow); }
    .shot-wide { aspect-ratio: 21 / 9; }
    .shot-tile { aspect-ratio: 1 / 1; border-radius: 3px; }
    .gallery { display: grid; gap: 14px; grid-template-columns: repeat(2, 1fr); }
    .logo-chip { height: 30px; width: auto; max-width: 132px; object-fit: contain; }

    /* Editorial hero: type carries the page, one wide plate beneath it. */
    .hero-editorial { text-align: left; max-width: 68ch; }
    .hero-editorial h1 { font-size: clamp(2.6rem, 7vw, 4.6rem); }

    /* Showcase hero: the photograph leads and the copy sits over it. */
    .hero-showcase { position: relative; border-radius: 4px; overflow: hidden; min-height: 460px; display: flex; align-items: flex-end; border: 1px solid var(--border); }
    .hero-showcase .shot-bg { position: absolute; inset: 0; }
    .hero-showcase .shot-bg img { width: 100%; height: 100%; object-fit: cover; }
    .hero-showcase .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 55%, rgba(0,0,0,.82) 100%); }
    .hero-showcase .showcase-copy { position: relative; padding: 40px 32px; color: #fff; }
    .hero-showcase .showcase-copy h1 { color: #fff; }
    .hero-showcase .showcase-copy .lede { color: rgba(255,255,255,.9); }
    .hero-showcase .showcase-copy .hero-meta { color: rgba(255,255,255,.82); }
    .hero-showcase .showcase-copy .hero-meta strong { color: #fff; }

    @media (min-width: 760px) {
      .gallery { grid-template-columns: repeat(4, 1fr); }
      .hero-showcase .showcase-copy { padding: 56px 48px; max-width: 42rem; }
    }

    footer { padding: 48px 0; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
    .notice {
      margin-top: 18px; padding: 13px 17px; border-radius: 11px;
      background: var(--surface-2); border: 1px solid var(--border); font-size: .82rem; color: var(--muted);
    }
    .sticky-cta {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex; gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--bg) 94%, transparent);
      border-top: 1px solid var(--border); backdrop-filter: blur(14px);
    }
    .sticky-cta .btn { flex: 1; padding: 14px 12px; }
    body { padding-bottom: 88px; }

    @media (min-width: 760px) {
      .grid { grid-template-columns: repeat(3, 1fr); }
      .steps { grid-template-columns: repeat(3, 1fr); }
      .stats { grid-template-columns: repeat(4, 1fr); }
      .contact-grid { grid-template-columns: 1.15fr .85fr; }
      .hero-grid { grid-template-columns: 1.25fr .75fr; }
      .nav-links { display: flex; }
      .sticky-cta { display: none; }
      body { padding-bottom: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      * { transition: none !important; }
    }
  `;
}

function renderServices(concept: DemoConcept): string {
  return concept.services
    .map(
      (service, index) => `
        <article class="card">
          <div class="card-icon" aria-hidden="true">0${index + 1}</div>
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.description)}</p>
        </article>`,
    )
    .join('');
}

function renderProcess(concept: DemoConcept): string {
  return concept.process
    .map(
      (step) => `
        <article class="step">
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.description)}</p>
        </article>`,
    )
    .join('');
}

function renderTrust(concept: DemoConcept): string {
  return concept.trustPoints
    .map(
      (point) => `
        <div class="stat">
          <div class="value">${escapeHtml(point.value)}</div>
          <div class="label">${escapeHtml(point.label)}</div>
        </div>`,
    )
    .join('');
}

/** Whole and half stars for a rating, so the number reads at a glance. */
function starsFor(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}

function renderReviews(concept: DemoConcept): string {
  const withData = concept.reviews.filter((r) => r.rating !== null || r.count !== null);

  // The section is always present so the page structure is stable; with no
  // public rating it says so rather than inventing praise.
  const body =
    withData.length === 0
      ? `<div class="card"><h3>Aún sin reseñas públicas</h3><p>Cuando las haya, este espacio las mostrará automáticamente. Pedir reseña tras cada visita es la vía más rápida para llenarlo.</p></div>`
      : withData
          .map((review) => {
            const rating =
              review.rating === null
                ? ''
                : `<div class="rating">${review.rating.toFixed(1)} / 5</div>
                   <div class="stars" aria-hidden="true">${starsFor(review.rating)}</div>`;
            const count = review.count === null ? '' : `${review.count} reseñas públicas`;
            return `
        <article class="card">
          ${rating}
          <p style="margin-top:10px">${escapeHtml(count)}${count && review.source ? ' &middot; ' : ''}${escapeHtml(review.source)}</p>
        </article>`;
          })
          .join('');

  return `
  <section id="reviews">
    <div class="wrap">
      <div class="section-head reveal">
        <h2>Lo que dicen quienes ya han venido</h2>
        <p class="section-sub">Valoraciones públicas, mostradas tal y como están publicadas.</p>
      </div>
      <div class="grid">${body}</div>
    </div>
  </section>`;
}

function renderFaqs(concept: DemoConcept): string {
  const items = concept.faqs
    .map(
      (faq) => `
      <details class="faq">
        <summary>${escapeHtml(faq.question)}</summary>
        <p>${escapeHtml(faq.answer)}</p>
      </details>`,
    )
    .join('');

  return `
  <section id="faq">
    <div class="wrap">
      <div class="section-head reveal">
        <h2>Preguntas frecuentes</h2>
        <p class="section-sub">Las dudas que más se repiten antes de la primera visita.</p>
      </div>
      <div style="max-width:70ch">${items}</div>
    </div>
  </section>`;
}

function renderLocation(concept: DemoConcept): string {
  const mapLink = concept.location.mapsQuery
    ? `<p style="margin-top:14px"><a class="plain" href="https://www.google.com/maps/search/?api=1&amp;query=${concept.location.mapsQuery}" target="_blank" rel="noopener noreferrer">Cómo llegar &rarr;</a></p>`
    : '';

  const address = concept.location.address ?? concept.location.city ?? 'Málaga';

  return `
  <section id="location">
    <div class="wrap">
      <div class="section-head reveal">
        <h2>Dónde estamos</h2>
        <p class="section-sub">${escapeHtml(concept.location.city ?? 'Málaga')}</p>
      </div>
      <div class="card">
        <h3>${escapeHtml(concept.businessName)}</h3>
        <p>${escapeHtml(address)}</p>
        ${mapLink}
        <div class="map" role="img" aria-label="Mapa esquemático de la ubicación"><span class="pin"></span></div>
      </div>
    </div>
  </section>`;
}

/**
 * A photograph from the business's own site.
 *
 * loading/decoding hints keep a slow third-party host from blocking paint,
 * and referrerpolicy stops the concept from telling that host who is looking
 * at the proposal.
 */
function shot(url: string, alt: string, className: string): string {
  return `<div class="shot ${className}"><img src="${safeHref(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
}

/** The hero, composed to the sector's archetype. */
function renderHero(concept: DemoConcept, parts: { whatsapp: string; heroMeta: string }): string {
  const { whatsapp, heroMeta } = parts;
  const hero = concept.media.hero;

  const copy = [
    '<span class="eyebrow">' + escapeHtml(concept.categoryLabel) + '</span>',
    '<h1>' + escapeHtml(concept.tagline) + '</h1>',
    '<p class="lede">' + escapeHtml(concept.intro) + '</p>',
    '<div class="hero-actions">',
    '<a class="btn btn-primary" href="' + safeHref(concept.primaryCta.href) + '">' + escapeHtml(concept.primaryCta.label) + '</a>',
    whatsapp,
    '<a class="btn btn-ghost" href="' + safeHref(concept.secondaryCta.href) + '">' + escapeHtml(concept.secondaryCta.label) + '</a>',
    '</div>',
    '<div class="hero-meta">' + heroMeta + '</div>',
  ].join('');

  /*
   * Showcase only works when there is a photograph to show. Without one it
   * would render as a large empty rectangle, so the sector quietly falls back
   * to the split composition.
   */
  if (concept.theme.heroStyle === 'showcase' && hero) {
    return `
  <div class="hero">
    <div class="wrap">
      <div class="hero-showcase">
        <div class="shot-bg"><img src="${safeHref(hero)}" alt="${escapeHtml(concept.businessName)}" decoding="async" referrerpolicy="no-referrer"></div>
        <div class="veil"></div>
        <div class="showcase-copy">${copy}</div>
      </div>
    </div>
  </div>`;
  }

  if (concept.theme.heroStyle === 'editorial') {
    return `
  <div class="hero">
    <div class="wrap">
      <div class="hero-editorial">${copy}</div>
      ${hero ? '<div style="margin-top:44px">' + shot(hero, concept.businessName, 'shot-wide') + '</div>' : ''}
    </div>
  </div>`;
  }

  const aside = hero
    ? shot(hero, concept.businessName, 'shot-hero')
    : `<aside class="hero-card">
        <h3>Pide cita en un minuto</h3>
        <ul class="checks">
          <li><span class="tick" aria-hidden="true">&check;</span><span>Sin esperas al teléfono: escríbenos y te confirmamos.</span></li>
          <li><span class="tick" aria-hidden="true">&check;</span><span>Presupuesto claro antes de empezar.</span></li>
          <li><span class="tick" aria-hidden="true">&check;</span><span>Horario adaptado, también fuera de la jornada.</span></li>
        </ul>
        <div style="margin-top:22px">
          <a class="btn btn-primary" style="width:100%" href="#contact">${escapeHtml(concept.booking.label)}</a>
        </div>
      </aside>`;

  return `
  <div class="hero">
    <div class="wrap hero-grid">
      <div>${copy}</div>
      ${aside}
    </div>
  </div>`;
}

/** The gallery, shown only when the business publishes more than one usable image. */
function renderGallery(concept: DemoConcept): string {
  const tiles = concept.media.gallery.slice(1, 5);
  if (tiles.length < 2) return '';

  return `
  <section id="gallery">
    <div class="wrap">
      <div class="section-head reveal">
        <h2>${concept.media.isStock ? 'Así podría verse' : 'El centro por dentro'}</h2>
        <p class="section-sub">${
          concept.media.isStock
            ? 'Imágenes de referencia que ocuparían el lugar de vuestras fotos reales.'
            : 'Imágenes publicadas por el propio negocio.'
        }</p>
      </div>
      <div class="gallery">${tiles.map((url, i) => shot(url, concept.businessName + ' — imagen ' + (i + 1), 'shot-tile')).join('')}</div>
    </div>
  </section>`;
}
/**
 * Renders the complete demo page.
 *
 * Self-contained by design: no external stylesheet, font, script or image. A
 * concept that depends on a third-party host breaks the moment it is opened
 * somewhere with different network rules — and it would leak who is viewing
 * the proposal to that host.
 */
export function renderDemoHtml(concept: DemoConcept): string {
  const contactRows: string[] = [];
  if (concept.contact.phone) {
    contactRows.push(
      `<div><dt>Teléfono</dt><dd><a class="plain" href="${safeHref(concept.contact.phoneHref)}">${escapeHtml(concept.contact.phone)}</a></dd></div>`,
    );
  }
  if (concept.contact.email) {
    contactRows.push(
      `<div><dt>Email</dt><dd><a class="plain" href="mailto:${escapeHtml(concept.contact.email)}">${escapeHtml(concept.contact.email)}</a></dd></div>`,
    );
  }
  if (concept.contact.address) {
    contactRows.push(`<div><dt>Dirección</dt><dd>${escapeHtml(concept.contact.address)}</dd></div>`);
  }

  const bookingSection = concept.booking.available
    ? `<a class="btn btn-primary" style="width:100%" href="${safeHref(concept.booking.href)}">${escapeHtml(concept.booking.label)}</a>`
    : '';

  const whatsapp = concept.contact.whatsappHref
    ? `<a class="btn btn-wa" href="${safeHref(concept.contact.whatsappHref)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : '';
  const whatsappBlock = concept.contact.whatsappHref
    ? `<a class="btn btn-wa" style="width:100%" href="${safeHref(concept.contact.whatsappHref)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : '';

  /*
   * The header shows the real logo when the site publishes one, and falls
   * back to a generated monogram otherwise. A favicon is often tiny or
   * square-cropped, so it is constrained rather than trusted to fit.
   */
  const logoMark = concept.media.logo
    ? `<img class="logo-chip" src="${safeHref(concept.media.logo)}" alt="${escapeHtml(concept.businessName)}" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="mark" aria-hidden="true">${escapeHtml(concept.monogram)}</span>`;
  const bestRating = concept.reviews.find((r) => r.rating !== null)?.rating ?? null;
  const heroMeta = [
    bestRating === null ? '' : `<span><strong>${bestRating.toFixed(1)}</strong> de valoración media</span>`,
    concept.location.city
      ? `<span>Atendemos en <strong>${escapeHtml(concept.location.city)}</strong></span>`
      : '',
    concept.contact.phone ? '<span>Respuesta el mismo día</span>' : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(concept.businessName)} — website concept</title>
<meta name="description" content="${escapeHtml(concept.tagline)}">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="${concept.theme.mode}">
<style>${renderStyles(concept.accent, concept.theme)}</style>
</head>
<body>
<header>
  <div class="wrap nav">
    <a class="brand" href="#top">
      ${logoMark}
      <span>
        <span class="brand-name">${escapeHtml(concept.businessName)}</span>
        <span class="brand-sub">${escapeHtml(concept.location.city ?? 'Málaga')}</span>
      </span>
    </a>
    <nav class="nav-links">
      <a href="#services">Servicios</a>
      <a href="#process">Cómo trabajamos</a>
      <a href="#reviews">Opiniones</a>
      <a href="#location">Dónde estamos</a>
      <a href="#contact">Contacto</a>
    </nav>
    <a class="btn btn-primary" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
  </div>
</header>

<main id="top">
${renderHero(concept, { whatsapp, heroMeta })}

  <section id="services">
    <div class="wrap">
      <div class="section-head reveal">
        <span class="section-index">01 — Servicios</span>
        <h2>Qué hacemos</h2>
        <p class="section-sub">Servicios claros, para que en segundos sepas si estás en el sitio correcto.</p>
      </div>
      <div class="grid">${renderServices(concept)}</div>
    </div>
  </section>

${renderGallery(concept)}

  <section id="process">
    <div class="wrap">
      <div class="section-head reveal">
        <span class="section-index">02 — Proceso</span>
        <h2>Cómo trabajamos</h2>
        <p class="section-sub">Tres pasos, sin sorpresas por el camino.</p>
      </div>
      <div class="steps">${renderProcess(concept)}</div>
    </div>
  </section>

  <section id="trust">
    <div class="wrap">
      <div class="section-head reveal">
        <span class="section-index">03 — Confianza</span>
        <h2>Por qué nos eligen</h2>
        <p class="section-sub">Datos tomados de información pública sobre este negocio.</p>
      </div>
      <div class="stats">${renderTrust(concept)}</div>
    </div>
  </section>

  ${renderReviews(concept)}

  ${renderFaqs(concept)}

  ${renderLocation(concept)}

  <section id="contact">
    <div class="wrap">
      <div class="section-head reveal">
        <h2>Contacto</h2>
        <p class="section-sub">Un formulario corto y una llamada a un toque. Sin caminos sin salida.</p>
      </div>
      <div class="contact-grid">
        <form class="card" onsubmit="event.preventDefault(); this.querySelector('.form-status').textContent = 'Esto es un concepto de demostración, así que no se ha enviado nada.';">
          <label class="field"><span>Tu nombre</span><input type="text" name="name" autocomplete="name" required></label>
          <label class="field"><span>Teléfono o email</span><input type="text" name="contact" autocomplete="tel" required></label>
          <label class="field"><span>¿En qué podemos ayudarte?</span><textarea name="message"></textarea></label>
          <button class="btn btn-primary" type="submit">Enviar consulta</button>
          <p class="form-status notice" role="status"></p>
        </form>
        <div class="card">
          <h3>Contacto directo</h3>
          <dl class="details">${contactRows.join('')}</dl>
          <div style="margin-top:20px; display:grid; gap:10px">
            ${bookingSection}
            ${whatsappBlock}
          </div>
        </div>
      </div>
      <p class="notice">${escapeHtml(concept.sourceNote)}</p>
    </div>
  </section>
  <section id="cierre">
    <div class="wrap">
      <div class="cta-band reveal">
        <h2>¿Hablamos?</h2>
        <p>Cuéntanos qué necesitas y te respondemos hoy mismo. Sin compromiso y sin letra pequeña.</p>
        <div class="hero-actions">
          <a class="btn btn-ghost" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
          ${whatsapp}
        </div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <p>${escapeHtml(concept.businessName)} — website concept, ${new Date().getFullYear()}.</p>
    <p style="margin-top:7px">Concepto de diseño elaborado para una propuesta comercial. Not the official website of this business.</p>
    ${concept.media.isStock ? '<p class="stock-note">Las fotografías son imágenes de archivo de referencia, no del negocio.</p>' : ''}
  </div>
</footer>

<div class="sticky-cta">
  <a class="btn btn-primary" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
  ${whatsapp || '<a class="btn btn-ghost" href="#contact">Mensaje</a>'}
</div>
<script>
  // Progressive enhancement: the class is added by script, so nothing is
  // hidden for a reader without JavaScript.
  (function () {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    document.body.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  })();
</script>
</body>
</html>`;
}
