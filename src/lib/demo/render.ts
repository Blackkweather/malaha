import type { DemoConcept } from './concept';

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

export function renderStyles(accent: string): string {
  return `
    :root {
      --accent: ${escapeHtml(accent)};
      --bg: #0b0f14;
      --surface: #121820;
      --surface-2: #182029;
      --text: #eef2f6;
      --muted: #9aa7b4;
      --border: #232c37;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg); color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6; -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
    header {
      position: sticky; top: 0; z-index: 20; backdrop-filter: blur(12px);
      background: rgba(11,15,20,.82); border-bottom: 1px solid var(--border);
    }
    .nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
    .brand { font-weight: 700; letter-spacing: -.02em; font-size: 1.05rem; }
    .nav-links { display: none; gap: 24px; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: .92rem; }
    .nav-links a:hover { color: var(--text); }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 20px; border-radius: 10px; font-weight: 600; text-decoration: none;
      font-size: .95rem; border: 1px solid transparent; cursor: pointer;
    }
    .btn-primary { background: var(--accent); color: #08111a; }
    .btn-primary:hover { filter: brightness(1.08); }
    .btn-ghost { border-color: var(--border); color: var(--text); }
    .btn-ghost:hover { background: var(--surface-2); }
    .hero { padding: 72px 0 56px; }
    .eyebrow {
      display: inline-block; font-size: .75rem; letter-spacing: .14em; text-transform: uppercase;
      color: var(--accent); border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px;
    }
    h1 { font-size: clamp(2.1rem, 6vw, 3.6rem); line-height: 1.08; letter-spacing: -.03em; margin: 20px 0 16px; }
    .lede { color: var(--muted); font-size: clamp(1rem, 2.4vw, 1.15rem); max-width: 62ch; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
    section { padding: 56px 0; border-top: 1px solid var(--border); }
    h2 { font-size: clamp(1.4rem, 3.4vw, 2rem); letter-spacing: -.02em; margin-bottom: 8px; }
    .section-sub { color: var(--muted); margin-bottom: 28px; }
    .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
    .card h3 { font-size: 1.05rem; margin-bottom: 8px; }
    .card p { color: var(--muted); font-size: .95rem; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    .stat .value { font-size: 1.7rem; font-weight: 700; letter-spacing: -.02em; }
    .stat .label { color: var(--muted); font-size: .82rem; margin-top: 4px; }
    .rating { color: var(--accent); font-weight: 700; }
    .contact-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    .field { display: block; margin-bottom: 14px; }
    .field span { display: block; font-size: .82rem; color: var(--muted); margin-bottom: 6px; }
    .field input, .field textarea {
      width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface-2); color: var(--text); font: inherit;
    }
    .field textarea { min-height: 120px; resize: vertical; }
    dl.details div { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
    dl.details dt { color: var(--muted); font-size: .9rem; }
    dl.details dd { text-align: right; font-size: .92rem; }
    a.plain { color: var(--accent); text-decoration: none; }
    footer { padding: 40px 0; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
    .notice {
      margin-top: 16px; padding: 12px 16px; border-radius: 10px;
      background: var(--surface-2); border: 1px solid var(--border); font-size: .82rem; color: var(--muted);
    }
    .sticky-cta {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex; gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: rgba(11,15,20,.94); border-top: 1px solid var(--border); backdrop-filter: blur(12px);
    }
    .sticky-cta .btn { flex: 1; }
    body { padding-bottom: 84px; }
    @media (min-width: 720px) {
      .grid { grid-template-columns: repeat(3, 1fr); }
      .stats { grid-template-columns: repeat(4, 1fr); }
      .contact-grid { grid-template-columns: 1.1fr .9fr; }
      .nav-links { display: flex; }
      .sticky-cta { display: none; }
      body { padding-bottom: 0; }
    }
  `;
}

function renderServices(concept: DemoConcept): string {
  return concept.services
    .map(
      (service) => `
        <article class="card">
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.description)}</p>
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

function renderReviews(concept: DemoConcept): string {
  const withData = concept.reviews.filter((r) => r.rating !== null || r.count !== null);
  if (withData.length === 0) return '';

  const items = withData
    .map((review) => {
      const rating = review.rating === null ? '' : `<span class="rating">${review.rating.toFixed(1)} / 5</span>`;
      const count = review.count === null ? '' : `${review.count} public reviews`;
      return `
        <article class="card">
          <h3>${rating}</h3>
          <p>${escapeHtml(count)}${count && review.source ? ' &middot; ' : ''}${escapeHtml(review.source)}</p>
        </article>`;
    })
    .join('');

  return `
  <section id="reviews">
    <div class="wrap">
      <h2>What people say</h2>
      <p class="section-sub">Public rating signals, shown exactly as they are published.</p>
      <div class="grid">${items}</div>
    </div>
  </section>`;
}

function renderLocation(concept: DemoConcept): string {
  if (!concept.location.address && !concept.location.city) return '';
  const mapLink = concept.location.mapsQuery
    ? `<p style="margin-top:12px"><a class="plain" href="https://www.google.com/maps/search/?api=1&amp;query=${concept.location.mapsQuery}" target="_blank" rel="noopener noreferrer">Open in Maps &rarr;</a></p>`
    : '';

  return `
  <section id="location">
    <div class="wrap">
      <h2>Where to find us</h2>
      <p class="section-sub">${escapeHtml(concept.location.city ?? 'Malaga')}</p>
      <div class="card">
        <h3>${escapeHtml(concept.businessName)}</h3>
        <p>${escapeHtml(concept.location.address ?? concept.location.city ?? '')}</p>
        ${mapLink}
      </div>
    </div>
  </section>`;
}

/**
 * Renders the complete demo page.
 *
 * The document is self-contained, responsive, and includes the sections the
 * specification requires: hero, services, trust, public reviews, CTA, contact,
 * location and a booking/contact pathway.
 */
export function renderDemoHtml(concept: DemoConcept): string {
  const contactRows: string[] = [];
  if (concept.contact.phone) {
    contactRows.push(
      `<div><dt>Phone</dt><dd><a class="plain" href="${safeHref(concept.contact.phoneHref)}">${escapeHtml(concept.contact.phone)}</a></dd></div>`,
    );
  }
  if (concept.contact.email) {
    contactRows.push(
      `<div><dt>Email</dt><dd><a class="plain" href="mailto:${escapeHtml(concept.contact.email)}">${escapeHtml(concept.contact.email)}</a></dd></div>`,
    );
  }
  if (concept.contact.address) {
    contactRows.push(`<div><dt>Address</dt><dd>${escapeHtml(concept.contact.address)}</dd></div>`);
  }

  const bookingSection = concept.booking.available
    ? `<a class="btn btn-primary" href="${safeHref(concept.booking.href)}">${escapeHtml(concept.booking.label)}</a>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(concept.businessName)} — website concept</title>
<meta name="description" content="${escapeHtml(concept.tagline)}">
<meta name="robots" content="noindex, nofollow">
<style>${renderStyles(concept.accent)}</style>
</head>
<body>
<header>
  <div class="wrap nav">
    <div class="brand">${escapeHtml(concept.businessName)}</div>
    <nav class="nav-links">
      <a href="#services">Services</a>
      <a href="#trust">Why us</a>
      <a href="#location">Location</a>
      <a href="#contact">Contact</a>
    </nav>
    <a class="btn btn-primary" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
  </div>
</header>

<main>
  <div class="hero wrap">
    <span class="eyebrow">${escapeHtml(concept.categoryLabel)}</span>
    <h1>${escapeHtml(concept.tagline)}</h1>
    <p class="lede">${escapeHtml(concept.intro)}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
      <a class="btn btn-ghost" href="${safeHref(concept.secondaryCta.href)}">${escapeHtml(concept.secondaryCta.label)}</a>
    </div>
  </div>

  <section id="services">
    <div class="wrap">
      <h2>What we do</h2>
      <p class="section-sub">Clear services, so a visitor knows in seconds whether they are in the right place.</p>
      <div class="grid">${renderServices(concept)}</div>
    </div>
  </section>

  <section id="trust">
    <div class="wrap">
      <h2>Why people choose us</h2>
      <p class="section-sub">Proof drawn from public information about this business.</p>
      <div class="stats">${renderTrust(concept)}</div>
    </div>
  </section>

  ${renderReviews(concept)}

  ${renderLocation(concept)}

  <section id="contact">
    <div class="wrap">
      <h2>Get in touch</h2>
      <p class="section-sub">One short form, one tap to call. No dead ends.</p>
      <div class="contact-grid">
        <form class="card" onsubmit="event.preventDefault(); this.querySelector('.form-status').textContent = 'This is a demo concept, so nothing was sent.';">
          <label class="field"><span>Your name</span><input type="text" name="name" autocomplete="name" required></label>
          <label class="field"><span>Phone or email</span><input type="text" name="contact" autocomplete="tel" required></label>
          <label class="field"><span>How can we help?</span><textarea name="message"></textarea></label>
          <button class="btn btn-primary" type="submit">Send enquiry</button>
          <p class="form-status notice" role="status"></p>
        </form>
        <div class="card">
          <h3>Direct contact</h3>
          <dl class="details">${contactRows.join('')}</dl>
          <div style="margin-top:18px">${bookingSection}</div>
        </div>
      </div>
      <p class="notice">${escapeHtml(concept.sourceNote)}</p>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <p>${escapeHtml(concept.businessName)} — website concept, ${new Date().getFullYear()}.</p>
    <p style="margin-top:6px">Design concept produced for a client proposal. Not the official website of this business.</p>
  </div>
</footer>

<div class="sticky-cta">
  <a class="btn btn-primary" href="${safeHref(concept.primaryCta.href)}">${escapeHtml(concept.primaryCta.label)}</a>
  <a class="btn btn-ghost" href="#contact">Message</a>
</div>
</body>
</html>`;
}
