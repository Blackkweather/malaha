import { CATEGORY_BY_KEY } from '../normalize/category';
import { issueDefinition } from '../website/issues';

/**
 * Outreach copy, composed from audited facts.
 *
 * The rule this module exists to enforce: **every claim in a message must come
 * from something the auditor actually observed.** No "I noticed your site looks
 * dated" unless a dated-markup finding is present. That is why composition is a
 * pure function of the evidence — there is nowhere for an invented detail to
 * enter, and a test can pin the mapping down.
 *
 * The model-written variant in `generate.ts` is handed the same evidence and
 * the same constraint; this deterministic version is the fallback and the
 * reference for what "grounded" means.
 */

export type OutreachChannel = 'email' | 'whatsapp' | 'call_script' | 'linkedin';
export type OutreachLanguage = 'es' | 'en';

export interface OutreachEvidence {
  name: string;
  /** Taxonomy key, e.g. "dental_clinic". */
  category: string;
  city: string;
  hasWebsite: boolean;
  websiteUrl: string | null;
  domain: string | null;
  /** Audit findings, strongest first. */
  issueCodes: string[];
  rating: number | null;
  reviewCount: number | null;
  opportunity: number | null;
  digitalOpportunity: number | null;
}

/**
 * The lead angle. Ordered by how much a business owner actually feels the
 * problem, not by technical severity — an invisible mobile site loses money
 * today, a missing canonical tag does not.
 */
export type OutreachAngle =
  | 'no_website'
  | 'unreachable'
  | 'mobile'
  | 'conversion'
  | 'trust'
  | 'performance'
  | 'modernity'
  | 'seo'
  | 'polish';

interface AngleRule {
  angle: OutreachAngle;
  codes: string[];
}

/**
 * First matching rule wins. A business with no website and one with a broken
 * website are different conversations, so availability is checked first.
 */
const ANGLE_RULES: AngleRule[] = [
  { angle: 'no_website', codes: ['no_website', 'social_only_presence'] },
  { angle: 'unreachable', codes: ['website_unreachable', 'http_error_status'] },
  { angle: 'mobile', codes: ['no_mobile_viewport', 'fixed_width_layout'] },
  { angle: 'conversion', codes: ['no_contact_path', 'no_booking_path', 'no_phone_link', 'weak_cta'] },
  { angle: 'trust', codes: ['no_https', 'broken_links'] },
  { angle: 'performance', codes: ['very_slow_response', 'slow_response', 'heavy_page'] },
  { angle: 'modernity', codes: ['legacy_markup', 'free_site_builder', 'stale_copyright'] },
  { angle: 'seo', codes: ['missing_title', 'missing_h1', 'missing_meta_description'] },
];

export interface AngleSelection {
  angle: OutreachAngle;
  /** The findings that justify the angle — what the message is allowed to cite. */
  supportingCodes: string[];
}

/** Chooses the single strongest reason to make contact. */
export function pickAngle(evidence: OutreachEvidence): AngleSelection {
  const present = new Set(evidence.issueCodes);

  for (const rule of ANGLE_RULES) {
    const matched = rule.codes.filter((code) => present.has(code));
    if (matched.length > 0) return { angle: rule.angle, supportingCodes: matched };
  }

  // A site with no catalogued failings is a refinement conversation, not a
  // rescue one. Saying otherwise would be the invented-detail failure mode.
  return { angle: 'polish', supportingCodes: [] };
}

interface AngleCopy {
  observation: string;
  consequence: string;
  proposal: string;
  subject: string;
}

const COPY_ES: Record<OutreachAngle, AngleCopy> = {
  no_website: {
    observation: 'no he encontrado una web oficial de {name} en las fuentes públicas',
    consequence:
      'hoy la mayoría de clientes en {city} busca en Google antes de llamar, y sin web esas búsquedas acaban en la competencia',
    proposal: 'una web sencilla y rápida, pensada para que os encuentren y os contacten desde el móvil',
    subject: '{name}: sin web, esas búsquedas acaban en la competencia',
  },
  unreachable: {
    observation: 'he intentado entrar en {website} y no responde correctamente',
    consequence: 'cualquiera que os busque ahora mismo se encuentra un error en lugar de vuestra web',
    proposal: 'dejarlo funcionando de nuevo y, si compensa, reconstruirlo sobre algo más estable',
    subject: '{name}: vuestra web no está respondiendo',
  },
  mobile: {
    observation: 'vuestra web no está adaptada a móvil',
    consequence:
      'en este sector la mayor parte del tráfico llega desde el móvil, y una web que obliga a hacer zoom pierde buena parte de esas visitas',
    proposal: 'una versión móvil rápida, con el teléfono y la reserva siempre a la vista',
    subject: '{name}: vuestra web no funciona bien en móvil',
  },
  conversion: {
    observation: 'en vuestra web no hay una forma clara y directa de contactar o reservar',
    consequence: 'la visita interesada llega, no ve cómo dar el siguiente paso y se va',
    proposal: 'un camino de contacto evidente: llamada a un toque, WhatsApp y formulario corto',
    subject: '{name}: vuestra web recibe visitas pero no genera contactos',
  },
  trust: {
    observation: 'vuestra web no se sirve por HTTPS',
    consequence:
      'el navegador la marca como «no segura», y ese aviso aparece justo antes de que alguien decida escribiros',
    proposal: 'certificado, migración segura y revisión de los enlaces rotos que encontré',
    subject: '{name}: el navegador marca vuestra web como no segura',
  },
  performance: {
    observation: 'vuestra web tarda bastante en cargar',
    consequence: 'cada segundo de espera en móvil son visitas que se van antes de ver nada',
    proposal: 'optimización real de carga, midiendo antes y después',
    subject: '{name}: vuestra web tarda demasiado en cargar',
  },
  modernity: {
    observation: 'vuestra web está construida con técnicas ya desfasadas',
    consequence: 'da sensación de abandono, y en vuestro sector la primera impresión pesa mucho',
    proposal: 'un rediseño manteniendo lo que ya funciona y actualizando lo que resta credibilidad',
    subject: '{name}: vuestra web aparenta menos de lo que sois',
  },
  seo: {
    observation: 'a vuestra web le faltan elementos básicos para posicionar en Google',
    consequence: 'aparecéis peor de lo que deberíais en búsquedas donde ya tenéis reputación',
    proposal: 'corregir la base técnica y estructurar el contenido por servicio',
    subject: '{name}: Google no está mostrando bien vuestra web',
  },
  polish: {
    observation: 'vuestra web está en buen estado técnico',
    consequence: 'justo por eso, la siguiente mejora ya no es arreglar, es convertir mejor',
    proposal: 'trabajar el diseño y los textos para que la visita interesada acabe contactando',
    subject: '{name}: una idea para que vuestra web convierta más',
  },
};

const COPY_EN: Record<OutreachAngle, AngleCopy> = {
  no_website: {
    observation: 'I could not find an official website for {name} in public sources',
    consequence:
      'most customers in {city} search online before they call, and those searches currently end up with your competitors',
    proposal: 'a simple, fast site built so people find you and contact you from a phone',
    subject: '{name}: no website means those searches go elsewhere',
  },
  unreachable: {
    observation: 'I tried to open {website} and it does not respond properly',
    consequence: 'anyone looking you up right now gets an error instead of your site',
    proposal: 'getting it back up, and rebuilding it on something more reliable if that makes sense',
    subject: '{name}: your website is not responding',
  },
  mobile: {
    observation: 'your website is not adapted for mobile',
    consequence:
      'most of your traffic arrives on a phone, and a site that needs pinch-and-zoom loses a good share of those visitors',
    proposal: 'a fast mobile layout with the phone number and booking always in reach',
    subject: '{name}: your website does not work well on mobile',
  },
  conversion: {
    observation: 'there is no clear way to get in touch or book on your website',
    consequence: 'interested visitors arrive, cannot see the next step, and leave',
    proposal: 'an obvious contact path: one-tap calling, WhatsApp, and a short form',
    subject: '{name}: your website gets visitors but not enquiries',
  },
  trust: {
    observation: 'your website is not served over HTTPS',
    consequence:
      'browsers label it "not secure", and that warning shows up right before someone decides to contact you',
    proposal: 'a certificate, a safe migration, and a fix for the broken links I found',
    subject: '{name}: browsers are flagging your website as not secure',
  },
  performance: {
    observation: 'your website takes a long time to load',
    consequence: 'every extra second on mobile is visitors leaving before they see anything',
    proposal: 'genuine loading optimisation, measured before and after',
    subject: '{name}: your website is loading too slowly',
  },
  modernity: {
    observation: 'your website is built with techniques that are now dated',
    consequence: 'it reads as neglected, and first impressions carry a lot of weight in your sector',
    proposal: 'a redesign that keeps what works and updates what costs you credibility',
    subject: '{name}: your website looks smaller than your business is',
  },
  seo: {
    observation: 'your website is missing the basics Google needs to rank it',
    consequence: 'you show up worse than you should for searches where you already have a reputation',
    proposal: 'fixing the technical base and structuring the content by service',
    subject: '{name}: Google is not showing your website properly',
  },
  polish: {
    observation: 'your website is in good technical shape',
    consequence: 'which is exactly why the next gain is not repair, it is conversion',
    proposal: 'working on the design and copy so interested visitors actually get in touch',
    subject: '{name}: an idea to make your website convert better',
  },
};

function fill(template: string, evidence: OutreachEvidence): string {
  return template
    .replaceAll('{name}', evidence.name)
    .replaceAll('{city}', evidence.city)
    .replaceAll('{website}', evidence.domain ?? evidence.websiteUrl ?? 'your website');
}

/** A short, factual line about public reputation — only when there is evidence. */
function reputationLine(evidence: OutreachEvidence, language: OutreachLanguage): string | null {
  if (evidence.rating === null || evidence.reviewCount === null || evidence.reviewCount < 5) {
    return null;
  }
  const rating = evidence.rating.toFixed(1);
  return language === 'es'
    ? `Con ${evidence.reviewCount} reseñas y un ${rating} de media, la reputación ya la tenéis; el problema no es el servicio.`
    : `With ${evidence.reviewCount} reviews averaging ${rating}, the reputation is already there — the service is not the problem.`;
}

/** Spanish titles for the catalogue, so an ES message is fully in Spanish. */
const ISSUE_TITLE_ES: Record<string, string> = {
  no_website: 'Sin web oficial localizable',
  website_unreachable: 'La web no responde',
  http_error_status: 'La página principal devuelve un error',
  no_https: 'Sin HTTPS (el navegador la marca como no segura)',
  no_mobile_viewport: 'Sin adaptación a móvil',
  fixed_width_layout: 'Maquetación de ancho fijo, se rompe en móvil',
  slow_response: 'Respuesta lenta del servidor',
  very_slow_response: 'Respuesta muy lenta del servidor',
  heavy_page: 'Página principal demasiado pesada',
  no_phone_link: 'Sin enlace de llamada directa',
  no_contact_path: 'Sin vía de contacto clara',
  no_booking_path: 'Sin opción de reserva o cita online',
  no_whatsapp: 'Sin contacto por WhatsApp',
  weak_cta: 'Sin llamada a la acción clara',
  missing_title: 'Sin título de página utilizable',
  missing_meta_description: 'Sin meta descripción',
  missing_h1: 'Sin encabezado H1',
  broken_heading_structure: 'Jerarquía de encabezados rota',
  missing_canonical: 'Sin URL canónica',
  low_image_alt_coverage: 'Imágenes sin texto alternativo',
  no_lang_attribute: 'Sin idioma declarado',
  broken_links: 'Enlaces internos rotos',
  no_social_links: 'Sin perfiles sociales enlazados',
  stale_copyright: 'Año de copyright desactualizado',
  legacy_markup: 'Código y técnicas obsoletas',
  free_site_builder: 'Alojada en un subdominio gratuito',
  social_only_presence: 'Solo presencia en redes sociales',
  no_analytics: 'Sin analítica instalada',
};

/** The observed findings, as short lines the reader can verify themselves. */
export function evidenceLines(codes: string[], language: OutreachLanguage): string[] {
  return codes
    .map((code) => issueDefinition(code))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .slice(0, 4)
    .map((d) => (language === 'es' ? (ISSUE_TITLE_ES[d.code] ?? d.title) : d.title));
}

export interface ComposedMessage {
  subject: string;
  body: string;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds the message.
 *
 * Deliberately short. A cold email that opens with three paragraphs about the
 * sender gets deleted; one that opens with a specific, checkable observation
 * about the reader's own site gets read.
 */
export function composeMessage(
  evidence: OutreachEvidence,
  selection: AngleSelection,
  options: { language: OutreachLanguage; channel: OutreachChannel; senderName?: string },
): ComposedMessage {
  const { language, channel } = options;
  const copy = (language === 'es' ? COPY_ES : COPY_EN)[selection.angle];
  const sender = options.senderName ?? (language === 'es' ? '[tu nombre]' : '[your name]');
  const categoryLabel = (CATEGORY_BY_KEY.get(evidence.category)?.label ?? evidence.category).toLowerCase();

  const subject = fill(copy.subject, evidence);
  const observation = fill(copy.observation, evidence);
  const consequence = fill(copy.consequence, evidence);
  const proposal = fill(copy.proposal, evidence);
  const reputation = reputationLine(evidence, language);
  const findings = evidenceLines(selection.supportingCodes, language);

  if (channel === 'whatsapp') {
    const body =
      language === 'es'
        ? [
            `Hola, ¿hablo con ${evidence.name}?`,
            '',
            `Soy ${sender}, diseño webs para ${categoryLabel} en ${evidence.city}. Revisando vuestra presencia online, ${observation}.`,
            '',
            `${capitalise(consequence)}.`,
            '',
            '¿Os interesa que os pase un antes/después concreto, sin compromiso?',
          ].join('\n')
        : [
            `Hi, is this ${evidence.name}?`,
            '',
            `I'm ${sender}, I build websites for ${categoryLabel} in ${evidence.city}. Looking at your online presence, ${observation}.`,
            '',
            `${capitalise(consequence)}.`,
            '',
            'Would a quick before/after mock-up be useful? No obligation.',
          ].join('\n');
    return { subject, body };
  }

  if (channel === 'call_script') {
    const body =
      language === 'es'
        ? [
            `GUION DE LLAMADA — ${evidence.name} (${categoryLabel}, ${evidence.city})`,
            '',
            'APERTURA',
            `«Buenos días, llamo por la web de ${evidence.name}. ¿Es usted quien la lleva?»`,
            '',
            'MOTIVO (hecho concreto, no genérico)',
            `«${capitalise(observation)}.»`,
            '',
            'CONSECUENCIA',
            `«${capitalise(consequence)}.»`,
            ...(reputation ? ['', 'REFUERZO', `«${reputation}»`] : []),
            ...(findings.length > 0 ? ['', 'SI PIDE DETALLE', ...findings.map((f) => `  · ${f}`)] : []),
            '',
            'PROPUESTA',
            `«Puedo prepararos ${proposal}. ¿Le mando una propuesta por email?»`,
            '',
            'SI DICE QUE NO',
            '«Sin problema. ¿Le dejo el análisis por escrito y ya me dice?»',
          ].join('\n')
        : [
            `CALL SCRIPT — ${evidence.name} (${categoryLabel}, ${evidence.city})`,
            '',
            'OPENING',
            `"Morning — I'm calling about the ${evidence.name} website. Are you the one who looks after it?"`,
            '',
            'REASON (a specific fact, not a pitch)',
            `"${capitalise(observation)}."`,
            '',
            'CONSEQUENCE',
            `"${capitalise(consequence)}."`,
            ...(reputation ? ['', 'REINFORCE', `"${reputation}"`] : []),
            ...(findings.length > 0 ? ['', 'IF THEY ASK FOR DETAIL', ...findings.map((f) => `  · ${f}`)] : []),
            '',
            'PROPOSAL',
            `"I can put together ${proposal}. Shall I email you a proposal?"`,
            '',
            'IF THEY SAY NO',
            '"No problem. Shall I send the written analysis and you decide from there?"',
          ].join('\n');
    return { subject, body };
  }

  // email and linkedin share the written structure; linkedin just runs shorter.
  const short = channel === 'linkedin';

  const bodyEs = [
    'Hola,',
    '',
    `Soy ${sender}. Trabajo el diseño web de ${categoryLabel} en ${evidence.city} y, revisando el sector, ${observation}.`,
    '',
    `${capitalise(consequence)}.`,
    ...(reputation && !short ? ['', reputation] : []),
    ...(findings.length > 0 && !short
      ? ['', 'Lo que he visto concretamente:', ...findings.map((f) => `  · ${f}`)]
      : []),
    '',
    `Lo que propongo: ${proposal}.`,
    '',
    short
      ? '¿Te paso el análisis completo?'
      : 'Si os encaja, os preparo una propuesta con el antes y el después, sin compromiso. Y si preferís que no vuelva a escribir, decídmelo y no insisto.',
    '',
    'Un saludo,',
    sender,
  ];

  const bodyEn = [
    'Hello,',
    '',
    `I'm ${sender}. I design websites for ${categoryLabel} in ${evidence.city}, and going through the sector, ${observation}.`,
    '',
    `${capitalise(consequence)}.`,
    ...(reputation && !short ? ['', reputation] : []),
    ...(findings.length > 0 && !short
      ? ['', 'What I specifically found:', ...findings.map((f) => `  · ${f}`)]
      : []),
    '',
    `What I propose: ${proposal}.`,
    '',
    short
      ? 'Want me to send the full analysis?'
      : "If that is useful I'll put together a before/after proposal, no obligation. And if you'd rather I didn't write again, say so and I won't.",
    '',
    'Best regards,',
    sender,
  ];

  return { subject, body: (language === 'es' ? bodyEs : bodyEn).join('\n') };
}
