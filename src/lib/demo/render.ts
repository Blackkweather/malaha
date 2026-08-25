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
        bg: '#0a0908',
        surface: '#12110e',
        surface2: '#2a2721',
        text: '#f2ede4',
        muted: '#a8a091',
        border: 'rgba(242,237,228,.15)',
        onAccent: '#f2ede4',
        shadow: 'none',
      }
    : {
        /*
         * Bone paper and ink, not white and slate. Shadows are absent by
         * design: depth comes from hairlines, full-bleed bands and whitespace,
         * which is what separates an editorial site from a dashboard.
         */
        bg: '#f2ede4',
        surface: '#eae4d9',
        surface2: '#d6cebf',
        text: '#12110e',
        muted: '#6b6559',
        border: 'rgba(18,17,14,.14)',
        onAccent: '#f2ede4',
        shadow: 'none',
      };
}

export function renderStyles(accent: string, theme?: DemoTheme): string {
  const t: DemoTheme =
    theme ?? { mode: 'light', accent, accentSoft: '#e0f2fe', headingFont: 'sans', heroStyle: 'split' };
  const c = palette(t);
  /*
   * One display face across every sector. The old sans/serif split made half
   * the sectors read as a generic SaaS landing page; scale and weight carry
   * the distinction instead, and `headingFont` now only nudges optical size.
   */
  const heading = `"Cormorant Garamond", Didot, Georgia, "Times New Roman", serif`;
  const displayScale = t.headingFont === 'serif' ? '1.06' : '1';

  return `
    /* Must precede every rule below: a stylesheet drops an @import that comes
       after any other statement, which would silently fall back to Futura. */
    @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Jost:wght@300;400;500&display=swap");

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
      --body: Jost, Futura, "Century Gothic", ui-sans-serif, system-ui, sans-serif;
      /* Labels are set in the body face at wide tracking, not in a monospace:
         a code font on a clinic's website reads as a developer's placeholder. */
      --mono: Jost, Futura, ui-sans-serif, system-ui, sans-serif;
      --display-scale: ${displayScale};
      --rule: 1px solid var(--border);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
    body {
      background: var(--bg); color: var(--text); font-family: var(--body);
      line-height: 1.7; font-weight: 300; font-size: 17px;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }
    /* Light weight, near-solid leading, negative tracking: the display face is
       set as a masthead rather than as a UI heading. */
    h1, h2, h3, .brand-name {
      font-family: var(--heading); font-weight: 300;
      letter-spacing: -.028em; line-height: .96;
    }
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
      width: 30px; height: 30px; flex: none; border-radius: 0; display: grid; place-items: center;
      background: transparent; color: var(--text); border: 1px solid var(--text);
      font-family: var(--heading); font-weight: 400; font-size: .82rem; letter-spacing: 0;
    }
    .brand-name { font-weight: 400; font-size: 1.06rem; line-height: 1.2; }
    .brand-sub { display: block; font-family: var(--body); font-size: .6rem; color: var(--muted); letter-spacing: .28em; text-transform: uppercase; }
    .nav-links { display: none; gap: 26px; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: .92rem; }
    .nav-links a:hover { color: var(--text); }

    /* ---- buttons --------------------------------------------------------- */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 16px 32px; border-radius: 1px; font-weight: 400; text-decoration: none;
      font-size: .74rem; letter-spacing: .2em; text-transform: uppercase;
      border: 1px solid transparent; cursor: pointer; font-family: var(--body);
      transition: background .3s ease, color .3s ease, border-color .3s ease;
    }
    .btn-primary { background: var(--text); color: var(--bg); border-color: var(--text); }
    .btn-primary:hover { background: transparent; color: var(--text); }
    .btn-ghost { border-color: var(--text); color: var(--text); background: transparent; }
    .btn-ghost:hover { background: var(--text); color: var(--bg); }
    /*
     * WhatsApp green beside a saturated sector accent was the loudest thing on
     * the page and read as a bolted-on plugin badge. The channel is named in
     * the label, so it does not also need to arrive in the brand's colour.
     */
    .btn-wa { border-color: var(--text); color: var(--text); background: transparent; }
    .btn-wa:hover { background: var(--text); color: var(--bg); }

    /* ---- hero ------------------------------------------------------------ */
    /* No gradient wash. The old radial glow behind the headline was the single
       clearest tell that the page came out of a template. */
    .hero { position: relative; overflow: hidden; padding: clamp(64px, 9vw, 132px) 0 clamp(56px, 7vw, 96px); }
    .hero-grid { display: grid; gap: 44px; grid-template-columns: 1fr; align-items: center; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 14px; font-family: var(--mono);
      font-size: .68rem; letter-spacing: .28em; text-transform: uppercase;
      color: var(--muted); font-weight: 400;
    }
    .eyebrow::before { content: ""; width: 34px; height: 1px; background: currentColor; }
    h1 {
      font-size: calc(clamp(3rem, 9.5vw, 7.2rem) * var(--display-scale));
      line-height: .88; margin: 34px 0 30px; font-weight: 300; letter-spacing: -.032em;
    }
    .lede { color: var(--muted); font-size: clamp(1rem, 1.5vw, 1.08rem); max-width: 46ch; line-height: 1.75; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 30px; color: var(--muted); font-size: .88rem; }
    .hero-meta strong { color: var(--text); font-weight: 650; }

    /* The hero card stands in for photography the business has not supplied. */
    .hero-card {
      background: var(--surface); border: none; border-top: 2px solid var(--text); border-radius: 0;
      padding: 26px 0 0; position: relative;
    }
    .hero-card h3 { font-size: 1.25rem; margin-bottom: 18px; }
    .checks { list-style: none; display: grid; gap: 0; }
    .checks li {
      display: flex; gap: 14px; align-items: flex-start; font-size: .9rem;
      color: var(--muted); padding: 13px 0; border-bottom: var(--rule);
    }
    /* A hairline rule, not a filled pill: the list should read as a set index,
       not as a row of status badges. */
    .tick {
      flex: none; width: 16px; height: 16px; border-radius: 0; margin-top: 6px;
      background: transparent; color: transparent; border-top: 1px solid var(--accent);
      display: block; font-size: 0;
    }

    /* ---- sections -------------------------------------------------------- */
    /* Whitespace does most of the work: sections breathe, and the border is
       a hairline rather than a box. */
    section { padding: clamp(48px, 6vw, 84px) 0; border-top: 1px solid var(--border); }
    .section-head { max-width: 62ch; margin-bottom: clamp(24px, 3vw, 34px); }
    h2 { font-size: clamp(2.1rem, 5.2vw, 3.6rem); margin-bottom: 20px; font-weight: 300; line-height: .98; letter-spacing: -.03em; }
    .section-sub { color: var(--muted); font-size: clamp(1rem, 1.6vw, 1.1rem); }
    .section-index {
      display: block; font-family: var(--mono); font-size: .72rem; font-weight: 500;
      letter-spacing: .28em; color: var(--muted); margin-bottom: 20px;
      padding-bottom: 14px; border-bottom: 1px solid var(--border);
    }

    /* Scroll reveal. Everything is visible by default so the page still
       reads with JavaScript disabled; the script opts in to animating. */
    .js-reveal .reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1); }
    @media print {
      .js-reveal .reveal { opacity: 1 !important; transform: none !important; }
    }
    .js-reveal .reveal.in { opacity: 1; transform: none; }

    /* Closing call to action, set on the accent so the page ends on it. */
    /*
     * Ink, not the sector accent. A full-bleed dark band is the one moment of
     * contrast on the page, and it lands harder when it is not competing with
     * a saturated colour.
     */
    .cta-band { background: #12110e; color: #f2ede4; border-radius: 0; padding: clamp(56px, 9vw, 112px) clamp(28px, 5vw, 72px); }
    .cta-band h2 { color: #f2ede4; }
    .cta-band p { color: rgba(242,237,228,.72); max-width: 46ch; }
    .cta-band .btn-primary { background: #f2ede4; color: #12110e; border-color: #f2ede4; }
    .cta-band .btn-primary:hover { background: transparent; color: #f2ede4; }
    .cta-band .btn-ghost, .cta-band .btn-wa { border-color: rgba(242,237,228,.5); color: #f2ede4; background: transparent; }
    .cta-band .btn-ghost:hover, .cta-band .btn-wa:hover { background: #f2ede4; color: #12110e; }

    /* Old on the left, proposed on the right; the old column is deliberately
       drained of colour so the contrast does the arguing. */
    /*
     * Hairline rules rather than a tinted parent showing through 1px gaps.
     * The old approach painted a solid 600px slab whenever the rows had not
     * revealed yet — on first paint, in print, and in any capture that does
     * not scroll — which looked like a rendering failure.
     */
    .vs { display: grid; gap: 0; background: transparent; border: none; border-top: 1px solid var(--border); }
    .vs-row { display: grid; grid-template-columns: 1fr; gap: 0; background: transparent; border-bottom: 1px solid var(--border); }
    .vs-old, .vs-new { background: transparent; padding: 26px 0; }
    .vs-new { padding-top: 0; }
    .vs-old { opacity: .62; }
    .vs-old p { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--muted) 55%, transparent); }
    .vs-tag {
      display: block; font-family: var(--mono); font-size: .62rem; letter-spacing: .28em;
      text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
    }
    .vs-tag-new { color: var(--text); }
    .vs-new p { font-weight: 500; }
    @media (min-width: 760px) {
      .vs-row { grid-template-columns: 1fr 1fr; column-gap: 48px; }
      .vs-new { padding-top: 26px; }
    }

    /* ---- motion ---------------------------------------------------------- */
    /*
     * All of it is opt-in: the js-motion class is added by script, and every
     * rule is disabled under prefers-reduced-motion. A concept that induces
     * motion sickness is not a better concept.
     */

    /* Words rise into place, staggered, the way a title sequence resolves. */
    .js-motion .word { display: inline-block; will-change: transform, opacity; }
    .js-motion .word > span { display: inline-block; transform: translateY(105%); opacity: 0; }
    .js-motion .in .word > span {
      transform: none; opacity: 1;
      transition: transform .9s cubic-bezier(.16,1,.3,1), opacity .6s ease;
      transition-delay: calc(var(--i, 0) * 55ms);
    }

    /* Depth: the hero plate tilts a few degrees toward the cursor. */
    .js-motion .tilt { perspective: 1100px; }
    .js-motion .tilt > * {
      transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(0);
      transition: transform .5s cubic-bezier(.16,1,.3,1);
      transform-style: preserve-3d;
    }

    /* Parallax: gallery tiles drift at different rates while scrolling. */
    .js-motion .parallax { will-change: transform; }

    .stat .value { font-variant-numeric: tabular-nums; }

    @media (prefers-reduced-motion: reduce) {
      .js-motion .word > span { transform: none !important; opacity: 1 !important; }
      .js-motion .tilt > * { transform: none !important; }
      .js-motion .parallax { transform: none !important; }
    }

    .stock-note { margin-top: 14px; font-size: .78rem; color: var(--muted); }
    .grid { display: grid; gap: 18px; grid-template-columns: 1fr; }
    /* Whitespace does the work a border used to do. */
    .card {
      background: transparent; border: 0; border-top: 1px solid var(--border);
      border-radius: 0; padding: 26px 0 0; transition: opacity .2s ease;
    }
    .card:hover { opacity: .72; }
    .card h3 { font-weight: 400; font-family: var(--heading); }
    .card h3 { font-size: 1.35rem; margin-bottom: 12px; }
    .card p { color: var(--muted); font-size: 1rem; line-height: 1.6; }
    /* A quiet numeral, not a coloured chip. */
    .card-icon {
      font-family: var(--mono); font-size: .64rem; letter-spacing: .28em; color: var(--muted);
      margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
    }
    .steps { counter-reset: step; display: grid; gap: 18px; grid-template-columns: 1fr; }
    .step { position: relative; padding-left: 60px; }
    .step::before {
      counter-increment: step; content: "0" counter(step); position: absolute; left: 0; top: -2px;
      width: 42px; height: auto; border-radius: 0; display: block;
      background: transparent; color: var(--muted); font-family: var(--heading);
      font-weight: 300; font-size: 1.6rem; line-height: 1;
    }
    .step h3 { font-size: 1.05rem; margin-bottom: 6px; }
    .step p { color: var(--muted); font-size: .95rem; }

    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
    .stat { background: transparent; border: none; border-top: 2px solid var(--text); border-radius: 0; padding: 20px 0 0; }
    .stat .value { font-size: 2.6rem; font-weight: 300; letter-spacing: -.03em; font-family: var(--heading); }
    .stat .label { color: var(--muted); font-size: .66rem; margin-top: 8px; letter-spacing: .24em; text-transform: uppercase; }
    .rating { color: var(--text); font-weight: 300; font-size: 2.2rem; font-family: var(--heading); }
    .stars { letter-spacing: .22em; color: var(--accent); font-size: .9rem; }

    details.faq { border-bottom: 1px solid var(--border); padding: 24px 0; }
    details.faq summary { cursor: pointer; font-weight: 400; font-size: 1.15rem; font-family: var(--heading); list-style: none; display: flex; justify-content: space-between; gap: 16px; }
    details.faq summary::-webkit-details-marker { display: none; }
    details.faq summary::after { content: "+"; color: var(--muted); font-weight: 300; font-size: 1.3rem; line-height: 1; font-family: var(--body); }
    details.faq[open] summary::after { content: "\\2212"; }
    details.faq p { color: var(--muted); margin-top: 12px; font-size: .95rem; }

    .contact-grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
    .field { display: block; margin-bottom: 15px; }
    .field span { display: block; font-size: .64rem; color: var(--muted); margin-bottom: 9px; font-weight: 400; letter-spacing: .24em; text-transform: uppercase; }
    /* Underlines rather than boxes: a form set in bordered rounded rectangles
       is the most dated element on a small-business site. */
    .field input, .field textarea {
      width: 100%; padding: 11px 0; border-radius: 0; border: none; border-bottom: var(--rule);
      background: transparent; color: var(--text); font: inherit;
    }
    .field input:focus, .field textarea:focus { border-bottom-color: var(--text); outline: none; }
    .field textarea { min-height: 122px; resize: vertical; }
    dl.details div { display: flex; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--border); }
    dl.details dt { color: var(--muted); font-size: .9rem; }
    dl.details dd { text-align: right; font-size: .92rem; font-weight: 500; }
    a.plain { color: var(--text); text-decoration: none; font-weight: 400; border-bottom: 1px solid var(--accent); padding-bottom: 2px; }
    a.plain:hover { border-bottom-color: var(--text); }

    /* ---- imagery --------------------------------------------------------- */
    /*
     * Photographs come from the business own website, so their dimensions are
     * unknown. Fixed aspect ratios with object-fit keep the layout intact
     * whatever shape arrives, and a tinted surface sits behind every frame so
     * a slow or dead image never leaves a hole.
     */
    .shot { position: relative; overflow: hidden; border-radius: 0; background: var(--surface-2); border: none; }
    .shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .shot-hero { aspect-ratio: 4 / 5; }
    .shot-wide { aspect-ratio: 21 / 9; }
    .shot-tile { aspect-ratio: 4 / 5; border-radius: 0; }
    .gallery { display: grid; gap: 14px; grid-template-columns: repeat(2, 1fr); }
    .logo-chip { height: 30px; width: auto; max-width: 132px; object-fit: contain; }

    .hero-editorial { text-align: left; max-width: 68ch; }
    .hero-editorial h1 { font-size: clamp(2.6rem, 7vw, 4.6rem); }

    .hero-showcase { position: relative; border-radius: 0; overflow: hidden; min-height: 620px; display: flex; align-items: flex-end; border: none; }
    .hero-showcase .shot-bg { position: absolute; inset: 0; }
    .hero-showcase .shot-bg img { width: 100%; height: 100%; object-fit: cover; }
    .hero-showcase .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 55%, rgba(0,0,0,.82) 100%); }
    .hero-showcase .showcase-copy { position: relative; padding: 40px 32px; color: #fff; }
    .hero-showcase .showcase-copy h1 { color: #fff; }
    .hero-showcase .showcase-copy .lede { color: rgba(255,255,255,.9); }

    @media (min-width: 760px) {
      .gallery { grid-template-columns: repeat(4, 1fr); }
      .hero-showcase .showcase-copy { padding: 56px 48px; max-width: 42rem; }
    }

    footer { padding: 48px 0; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
    /*
     * The contact form's status line is an empty live region until the form is
     * submitted, and a tinted background made that empty element render as a
     * stray filled bar. It must occupy nothing until it has something to say.
     */
    .form-status:empty { display: none; }
    .notice {
      margin-top: 20px; padding: 16px 0 0; border-radius: 0;
      background: transparent; border: none; border-top: 1px solid var(--border);
      font-size: .74rem; color: var(--muted); letter-spacing: .02em;
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
      .hero-grid { grid-template-columns: 1.05fr .95fr; }
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

  /*
   * With no public rating the section is omitted entirely. Announcing "aun sin
   * resenas" on a page whose job is to win the client is an own goal, and the
   * honesty requirement is met by not claiming a rating - not by volunteering
   * the absence of one.
   */
  if (withData.length === 0) return '';

  const body = withData
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
/*
 * onerror removes the frame rather than leaving an empty tinted box: a
 * hotlink-blocked or 404 image should cost the page a tile, not show a hole.
 */
function shot(url: string, alt: string, className: string): string {
  return `<div class="shot ${className}"><img src="${safeHref(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.shot').remove()"></div>`;
}

/** The hero, composed to the sector's archetype. */
/**
 * Wraps each word so it can be animated independently.
 *
 * The inner span is what moves; the outer word is the mask it moves behind.
 * Escaping happens per word, so the markup this introduces can never come
 * from the business's own name.
 */
function splitWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => `<span class="word" style="--i:${i}"><span>${escapeHtml(word)}</span></span>`)
    .join(' ');
}

function renderHero(concept: DemoConcept, parts: { whatsapp: string; heroMeta: string }): string {
  const { whatsapp, heroMeta } = parts;
  const hero = concept.media.hero;

  const copy = [
    '<span class="eyebrow">' + escapeHtml(concept.categoryLabel) + '</span>',
    '<h1>' + splitWords(concept.tagline) + '</h1>',
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
    ? `<div class="tilt">${shot(hero, concept.businessName, 'shot-hero')}</div>`
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
      <div class="gallery">${tiles.map((url, i) => shot(url, concept.businessName + ' — imagen ' + (i + 1), 'shot-tile parallax')).join('')}</div>
    </div>
  </section>`;
}
/**
 * JSON-LD for the business.
 *
 * This is the part that keeps paying after the site ships. A typed entity
 * with address, coordinates, contact and rating is what earns the map pack,
 * the knowledge panel, and a citation when someone asks an assistant for a
 * dentist in Malaga. Most small-business sites publish none of it, which is
 * exactly why it is worth showing them theirs.
 *
 * Serialised with JSON.stringify and with < escaped, so no business-supplied
 * string can close the script tag.
 */
function renderJsonLd(concept: DemoConcept): string {
  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": concept.seo.schemaType,
    name: concept.businessName,
    description: concept.seo.description,
    areaServed: concept.location.city ?? "Malaga",
  };

  if (concept.location.address) {
    business.address = {
      "@type": "PostalAddress",
      streetAddress: concept.location.address,
      addressLocality: concept.location.city ?? "Malaga",
      postalCode: concept.location.postalCode ?? undefined,
      addressCountry: "ES",
    };
  }
  if (concept.seo.latitude !== null && concept.seo.longitude !== null) {
    business.geo = {
      "@type": "GeoCoordinates",
      latitude: concept.seo.latitude,
      longitude: concept.seo.longitude,
    };
  }
  if (concept.contact.phone) business.telephone = concept.contact.phone;
  if (concept.contact.email) business.email = concept.contact.email;
  if (concept.media.hero && !concept.media.isStock) business.image = concept.media.hero;
  if (concept.seo.sameAs.length > 0) business.sameAs = concept.seo.sameAs;

  // Only claim a rating when there is a real one with a real count behind it.
  const rated = concept.reviews.find((r) => r.rating !== null && r.count !== null);
  if (rated && rated.rating !== null && rated.count !== null) {
    business.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rated.rating,
      reviewCount: rated.count,
    };
  }

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: concept.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const json = JSON.stringify([business, faq]).split("<").join("\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * The section that ages their current site.
 *
 * Every row is a finding the auditor actually recorded against their domain,
 * so the owner can check each one. That is what makes it land: not an opinion
 * about their taste, but a list they can verify and did not know about.
 */
function renderComparison(concept: DemoConcept): string {
  if (concept.comparison.length === 0) return '';

  const rows = concept.comparison
    .map(
      (row) => `
        <div class="vs-row reveal">
          <div class="vs-old"><span class="vs-tag">Ahora</span><p>${escapeHtml(row.today)}</p></div>
          <div class="vs-new"><span class="vs-tag vs-tag-new">Con esta web</span><p>${escapeHtml(row.proposed)}</p></div>
        </div>`,
    )
    .join('');

  return `
  <section id="comparativa">
    <div class="wrap">
      <div class="section-head reveal">
        <span class="section-index">04 — Diagnóstico</span>
        <h2>Qué encontramos hoy en vuestra web</h2>
        <p class="section-sub">Cada punto es una comprobación real sobre vuestro dominio. Podéis verificarlos uno a uno.</p>
      </div>
      <div class="vs">${rows}</div>
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
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(concept.businessName)}">
<meta property="og:description" content="${escapeHtml(concept.seo.description)}">
<meta property="og:locale" content="es_ES">
${concept.media.hero ? `<meta property="og:image" content="${safeHref(concept.media.hero)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
${renderJsonLd(concept)}
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

${renderComparison(concept)}

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

    // Nothing may stay invisible: if the observer has not fired within a
    // couple of seconds (background tab, print, no scroll), reveal it all.
    setTimeout(function () {
      document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 2) el.classList.add("in");
      });
    }, 2000);
    window.addEventListener("beforeprint", function () {
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    });

    document.body.classList.add("js-motion");

    // Headline words resolve as soon as the hero paints.
    var h1 = document.querySelector("h1");
    if (h1) { requestAnimationFrame(function () { h1.classList.add("in"); }); }

    // Pointer tilt, clamped to a few degrees so it reads as depth, not gimmick.
    document.querySelectorAll(".tilt").forEach(function (box) {
      box.addEventListener("pointermove", function (e) {
        var r = box.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        box.style.setProperty("--ry", (px * 7).toFixed(2) + "deg");
        box.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
      });
      box.addEventListener("pointerleave", function () {
        box.style.setProperty("--ry", "0deg");
        box.style.setProperty("--rx", "0deg");
      });
    });

    // One rAF-throttled scroll handler for parallax, so the page never runs
    // layout work on every scroll event.
    var tiles = [].slice.call(document.querySelectorAll(".parallax"));
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var vh = window.innerHeight;
        tiles.forEach(function (t, i) {
          var r = t.getBoundingClientRect();
          var progress = (r.top + r.height / 2 - vh / 2) / vh;
          /*
           * Clamped, and gentle. Unclamped progress reached ~2.8, turning the
           * intended 14px drift into a 39px zigzag that read as a broken grid
           * rather than as motion.
           */
          var p = progress < -1 ? -1 : progress > 1 ? 1 : progress;
          t.style.transform = "translate3d(0," + (p * (i % 2 ? -7 : 7)).toFixed(1) + "px,0)";
        });
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Numeric trust points count up the first time they come into view.
    document.querySelectorAll(".stat .value").forEach(function (el) {
      var raw = el.textContent.trim();
      var target = parseFloat(raw.replace(",", "."));
      if (!isFinite(target) || String(target).length !== raw.length) return;
      var decimals = (raw.split(/[.,]/)[1] || "").length;
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        var start = performance.now();
        (function step(now) {
          var t = Math.min(1, (now - start) / 900);
          el.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
          if (t < 1) requestAnimationFrame(step);
        })(start);
      });
      seen.observe(el);
    });
  })();
</script>
</body>
</html>`;
}
