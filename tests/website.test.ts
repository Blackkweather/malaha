import { describe, expect, it } from 'vitest';
import { analyzeHtml, attr, needsJavaScriptRendering, stripTags } from '../src/lib/website/html';
import { selectPriorityPages } from '../src/lib/website/audit';

export const MODERN_SITE = `<!doctype html>
<html lang="es">
<head>
  <title>Clinica Dental Larios - Dentista en Malaga</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Clinica dental en el centro de Malaga.">
  <link rel="canonical" href="https://dentallarios.example/">
  <script src="https://www.googletagmanager.com/gtag/js"></script>
</head>
<body>
  <h1>Clinica Dental Larios</h1>
  <h2>Tratamientos</h2>
  <img src="a.jpg" alt="Consulta">
  <img src="b.jpg" alt="Equipo">
  <a href="tel:+34952123456">Llamar</a>
  <a href="mailto:info@dentallarios.example">Email</a>
  <a href="https://wa.me/34952123456">WhatsApp</a>
  <a href="/contacto">Contacto</a>
  <a href="/servicios">Servicios</a>
  <a href="/pedir-cita">Pedir cita</a>
  <a href="https://facebook.com/dentallarios">Facebook</a>
  <form><input type="email" name="email"><textarea name="mensaje"></textarea></form>
  <footer>&copy; 2026 Clinica Dental Larios</footer>
</body></html>`;

const DATED_SITE = `<html>
<head><title>Inicio</title></head>
<body>
  <table width="980"><tr><td>
  <font size="3">Bienvenidos</font>
  <marquee>Ofertas</marquee>
  <img src="a.gif">
  <img src="b.gif">
  <img src="c.gif">
  <img src="d.gif">
  </td></tr></table>
  <p>Telefono: 952 12 34 56</p>
  <p>&copy; 2011 Mi Empresa</p>
</body></html>`;

describe('HTML analysis', () => {
  it('extracts the structural signals of a modern site', () => {
    const analysis = analyzeHtml(MODERN_SITE, 'https://dentallarios.example/');
    expect(analysis.title).toContain('Clinica Dental Larios');
    expect(analysis.hasViewportMeta).toBe(true);
    expect(analysis.metaDescription).toBeTruthy();
    expect(analysis.canonical).toBe('https://dentallarios.example/');
    expect(analysis.lang).toBe('es');
    expect(analysis.h1Count).toBe(1);
    expect(analysis.imageCount).toBe(2);
    expect(analysis.imagesWithAlt).toBe(2);
    expect(analysis.telLinks).toHaveLength(1);
    expect(analysis.mailtoLinks).toHaveLength(1);
    expect(analysis.whatsappLinks).toHaveLength(1);
    expect(analysis.bookingLinks.length).toBeGreaterThan(0);
    expect(analysis.hasContactForm).toBe(true);
    expect(analysis.hasAnalytics).toBe(true);
    expect(analysis.socialLinks.map((s) => s.platform)).toContain('facebook');
    expect(analysis.copyrightYear).toBe(2026);
  });

  it('detects dated construction', () => {
    const analysis = analyzeHtml(DATED_SITE, 'https://viejo.example/');
    expect(analysis.hasViewportMeta).toBe(false);
    expect(analysis.usesLegacyMarkup).toBe(true);
    expect(analysis.usesFixedWidth).toBe(true);
    expect(analysis.imagesWithAlt).toBe(0);
    expect(analysis.telLinks).toHaveLength(0);
    expect(analysis.hasContactForm).toBe(false);
    expect(analysis.hasAnalytics).toBe(false);
    expect(analysis.copyrightYear).toBe(2011);
  });

  it('reads attributes regardless of quoting style', () => {
    expect(attr('<img src="a.jpg" alt="Hola">', 'alt')).toBe('Hola');
    expect(attr("<img src='b.jpg' alt='Adios'>", 'alt')).toBe('Adios');
    expect(attr('<img src=c.jpg alt=Plain>', 'alt')).toBe('Plain');
    expect(attr('<img src="a.jpg">', 'alt')).toBeNull();
  });

  it('does not confuse an attribute with a longer one containing its name', () => {
    expect(attr('<img data-alt="wrong" alt="right">', 'alt')).toBe('right');
  });

  it('decodes entities and strips markup for text extraction', () => {
    expect(stripTags('<script>ignore()</script><p>Visible</p>')).toBe('Visible');
    expect(stripTags('<p>Uno &amp; Dos</p>')).toBe('Uno & Dos');
  });

  it('recognises a client-rendered shell that needs a browser', () => {
    const shell = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    expect(needsJavaScriptRendering(analyzeHtml(shell, 'https://a.example'), shell)).toBe(true);
    expect(needsJavaScriptRendering(analyzeHtml(MODERN_SITE, 'https://a.example'), MODERN_SITE)).toBe(
      false,
    );
  });
});

describe('priority page selection', () => {
  it('picks only the prioritised pages, within the budget', () => {
    const analysis = analyzeHtml(MODERN_SITE, 'https://dentallarios.example/');
    const pages = selectPriorityPages(analysis, 'https://dentallarios.example/', 8);
    const types = pages.map((p) => p.pageType);

    expect(types).toContain('contact');
    expect(types).toContain('services');
    expect(types).toContain('booking');
    expect(new Set(types).size).toBe(types.length);
    expect(pages.length).toBeLessThanOrEqual(7);
  });

  it('never leaves the origin', () => {
    const html = '<a href="https://otro-sitio.example/contacto">Contacto</a>';
    const analysis = analyzeHtml(html, 'https://mio.example/');
    expect(selectPriorityPages(analysis, 'https://mio.example/', 8)).toHaveLength(0);
  });

  it('respects the page budget', () => {
    const analysis = analyzeHtml(MODERN_SITE, 'https://dentallarios.example/');
    expect(selectPriorityPages(analysis, 'https://dentallarios.example/', 2)).toHaveLength(1);
  });
});
