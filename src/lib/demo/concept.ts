import { CATEGORY_BY_KEY, OTHER_CATEGORY } from '../normalize/category';
import { formatPhone } from '../normalize/phone';
import type { BusinessDetail } from '../repo/businesses';
import type { ClaudeAnalysis } from '../ai/claude';

/**
 * The demo concept.
 *
 * Built from publicly available business facts only. It is an original concept,
 * not a copy of the existing site: no markup or styling is taken from the
 * business's current website — the layout, copy and structure are generated here.
 *
 * The copy is Spanish. These are Málaga businesses being shown a concept of
 * their own website, and an English page is not a credible mock-up of one.
 */
export interface DemoConcept {
  businessName: string;
  /** Initials, used for the generated wordmark. */
  monogram: string;
  tagline: string;
  intro: string;
  categoryLabel: string;
  accent: string;
  theme: DemoTheme;
  services: { title: string; description: string }[];
  process: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  trustPoints: { value: string; label: string }[];
  reviews: { rating: number | null; count: number | null; source: string }[];
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  contact: {
    phone: string | null;
    phoneHref: string | null;
    whatsappHref: string | null;
    email: string | null;
    address: string | null;
  };
  location: {
    address: string | null;
    city: string | null;
    postalCode: string | null;
    mapsQuery: string | null;
  };
  booking: { available: boolean; label: string; href: string };
  sourceNote: string;
  generatedFrom: 'facts' | 'facts_and_claude';
}

/**
 * Art direction per sector.
 *
 * A dental clinic and a law firm should not arrive looking like the same
 * template with a different hex code — that is the tell that gives a generated
 * mock-up away. Mode and heading face carry most of that difference: clinics
 * read clean and light, hospitality reads warm and dark, the professions read
 * authoritative with a serif.
 */
export interface DemoTheme {
  mode: 'light' | 'dark';
  accent: string;
  /** Tint used behind hero and section washes. */
  accentSoft: string;
  headingFont: 'sans' | 'serif';
}

const THEMES: Record<string, DemoTheme> = {
  dental_clinic: { mode: 'light', accent: '#0284c7', accentSoft: '#e0f2fe', headingFont: 'sans' },
  private_clinic: { mode: 'light', accent: '#0d9488', accentSoft: '#ccfbf1', headingFont: 'sans' },
  physiotherapy: { mode: 'light', accent: '#059669', accentSoft: '#d1fae5', headingFont: 'sans' },
  veterinary: { mode: 'light', accent: '#0891b2', accentSoft: '#cffafe', headingFont: 'sans' },
  pharmacy: { mode: 'light', accent: '#16a34a', accentSoft: '#dcfce7', headingFont: 'sans' },
  cosmetic_surgery: { mode: 'light', accent: '#be185d', accentSoft: '#fce7f3', headingFont: 'serif' },
  beauty: { mode: 'light', accent: '#c026d3', accentSoft: '#fae8ff', headingFont: 'serif' },
  spa_wellness: { mode: 'light', accent: '#9333ea', accentSoft: '#f3e8ff', headingFont: 'serif' },
  law_firm: { mode: 'light', accent: '#1e40af', accentSoft: '#e0e7ff', headingFont: 'serif' },
  professional_services: { mode: 'light', accent: '#3730a3', accentSoft: '#e0e7ff', headingFont: 'serif' },
  architecture: { mode: 'light', accent: '#334155', accentSoft: '#e2e8f0', headingFont: 'serif' },
  real_estate: { mode: 'light', accent: '#b45309', accentSoft: '#fef3c7', headingFont: 'serif' },
  hotel: { mode: 'dark', accent: '#f59e0b', accentSoft: '#78350f', headingFont: 'serif' },
  restaurant: { mode: 'dark', accent: '#f97316', accentSoft: '#7c2d12', headingFont: 'serif' },
  cafe_bar: { mode: 'dark', accent: '#f59e0b', accentSoft: '#78350f', headingFont: 'serif' },
  yacht_charter: { mode: 'dark', accent: '#22d3ee', accentSoft: '#164e63', headingFont: 'sans' },
  wedding_events: { mode: 'light', accent: '#db2777', accentSoft: '#fce7f3', headingFont: 'serif' },
  fitness: { mode: 'dark', accent: '#84cc16', accentSoft: '#365314', headingFont: 'sans' },
  private_education: { mode: 'light', accent: '#2563eb', accentSoft: '#dbeafe', headingFont: 'sans' },
  construction: { mode: 'dark', accent: '#eab308', accentSoft: '#713f12', headingFont: 'sans' },
  home_services: { mode: 'light', accent: '#ea580c', accentSoft: '#ffedd5', headingFont: 'sans' },
  car_dealer: { mode: 'dark', accent: '#38bdf8', accentSoft: '#0c4a6e', headingFont: 'sans' },
  jewellery: { mode: 'dark', accent: '#d4af37', accentSoft: '#5c4813', headingFont: 'serif' },
  optician: { mode: 'light', accent: '#0369a1', accentSoft: '#e0f2fe', headingFont: 'sans' },
  travel_agency: { mode: 'light', accent: '#0d9488', accentSoft: '#ccfbf1', headingFont: 'sans' },
  pet_services: { mode: 'light', accent: '#ca8a04', accentSoft: '#fef9c3', headingFont: 'sans' },
  retail: { mode: 'light', accent: '#7c3aed', accentSoft: '#ede9fe', headingFont: 'sans' },
};

const DEFAULT_THEME: DemoTheme = {
  mode: 'light',
  accent: '#0284c7',
  accentSoft: '#e0f2fe',
  headingFont: 'sans',
};

/** Spanish service sets per sector, used when the audit detected none. */
const DEFAULT_SERVICES: Record<string, { title: string; description: string }[]> = {
  dental_clinic: [
    { title: 'Odontología general', description: 'Revisiones, higiene y prevención para toda la familia.' },
    { title: 'Implantes dentales', description: 'Soluciones fijas y naturales, planificadas con imagen 3D.' },
    { title: 'Ortodoncia', description: 'Alineadores discretos y ortodoncia moderna para adultos y adolescentes.' },
    { title: 'Estética dental', description: 'Blanqueamiento y carillas con un resultado natural.' },
  ],
  private_clinic: [
    { title: 'Consulta médica', description: 'Cita sin esperas, con el tiempo que cada paciente necesita.' },
    { title: 'Pruebas diagnósticas', description: 'Resultados rápidos y explicados con claridad.' },
    { title: 'Seguimiento', description: 'Un plan de tratamiento con revisiones marcadas desde el primer día.' },
  ],
  law_firm: [
    { title: 'Derecho civil y mercantil', description: 'Contratos, reclamaciones y asuntos societarios de principio a fin.' },
    { title: 'Derecho inmobiliario', description: 'Compraventas, arrendamientos y problemas registrales en Málaga.' },
    { title: 'Familia y sucesiones', description: 'Divorcios, custodias y herencias, con discreción.' },
    { title: 'Laboral', description: 'Despidos, reclamaciones de cantidad y negociación.' },
  ],
  real_estate: [
    { title: 'Comprar', description: 'Vivienda e inversión seleccionada en la ciudad y la costa.' },
    { title: 'Vender', description: 'Valoración, reportaje fotográfico y comprador cualificado.' },
    { title: 'Alquilar', description: 'Larga y corta estancia con gestión integral.' },
  ],
  hotel: [
    { title: 'Habitaciones', description: 'Descanso tranquilo a pocos minutos del centro.' },
    { title: 'Reserva directa', description: 'El mejor precio disponible, sin comisiones de intermediarios.' },
    { title: 'Experiencias', description: 'Recomendaciones locales, traslados y planes en la ciudad.' },
  ],
  restaurant: [
    { title: 'Carta', description: 'Producto de temporada y cocina de mercado.' },
    { title: 'Reservas', description: 'Mesa confirmada en segundos, también desde el móvil.' },
    { title: 'Eventos', description: 'Comidas de empresa, celebraciones y menús cerrados.' },
  ],
  beauty: [
    { title: 'Peluquería', description: 'Corte, color y tratamientos con asesoramiento previo.' },
    { title: 'Estética', description: 'Tratamientos faciales y corporales personalizados.' },
    { title: 'Novias y eventos', description: 'Pruebas previas y servicio el día señalado.' },
  ],
  physiotherapy: [
    { title: 'Fisioterapia', description: 'Tratamiento manual orientado a recuperar movilidad.' },
    { title: 'Rehabilitación', description: 'Planes tras lesión o cirugía, con objetivos medibles.' },
    { title: 'Prevención', description: 'Valoración postural y pautas para evitar recaídas.' },
  ],
  home_services: [
    { title: 'Reformas integrales', description: 'Proyecto, ejecución y plazos por escrito.' },
    { title: 'Reparaciones', description: 'Intervenciones rápidas con presupuesto cerrado.' },
    { title: 'Urgencias', description: 'Atención el mismo día cuando no puede esperar.' },
  ],
};

const GENERIC_SERVICES = [
  { title: 'Qué hacemos', description: 'Nuestro servicio principal, explicado sin tecnicismos.' },
  { title: 'Cómo trabajamos', description: 'Un proceso claro desde el primer contacto hasta la entrega.' },
  { title: 'Presupuesto', description: 'Cuéntanos qué necesitas y recibe una propuesta detallada.' },
];

/** Sector-appropriate three-step process. */
const DEFAULT_PROCESS: Record<string, { title: string; description: string }[]> = {
  dental_clinic: [
    { title: 'Primera visita', description: 'Revisión completa y diagnóstico, sin compromiso.' },
    { title: 'Plan y presupuesto', description: 'Te explicamos las opciones y el coste antes de empezar.' },
    { title: 'Tratamiento', description: 'Citas ajustadas a tu horario y seguimiento posterior.' },
  ],
  law_firm: [
    { title: 'Primera consulta', description: 'Estudiamos tu caso y te decimos con franqueza si tiene recorrido.' },
    { title: 'Estrategia y honorarios', description: 'Plan de actuación y coste cerrado por escrito.' },
    { title: 'Seguimiento', description: 'Informamos de cada avance sin que tengas que perseguirlo.' },
  ],
  real_estate: [
    { title: 'Valoración', description: 'Precio realista basado en operaciones reales de la zona.' },
    { title: 'Promoción', description: 'Fotografía profesional y difusión en los portales adecuados.' },
    { title: 'Cierre', description: 'Acompañamiento hasta la firma ante notario.' },
  ],
};

const GENERIC_PROCESS = [
  { title: 'Contacto', description: 'Nos cuentas qué necesitas por teléfono, WhatsApp o formulario.' },
  { title: 'Propuesta', description: 'Recibes una propuesta clara, con alcance y precio.' },
  { title: 'Ejecución', description: 'Trabajamos con plazos acordados y te mantenemos informado.' },
];

function faqsFor(city: string, hasPhone: boolean): { question: string; answer: string }[] {
  return [
    {
      question: '¿Cómo pido cita?',
      answer: hasPhone
        ? 'Por teléfono, por WhatsApp o rellenando el formulario de esta página. Respondemos el mismo día laborable.'
        : 'Rellenando el formulario de esta página. Respondemos el mismo día laborable.',
    },
    {
      question: '¿Dónde estáis?',
      answer: `En ${city}. Tienes la dirección y el enlace al mapa más abajo.`,
    },
    {
      question: '¿Cuánto cuesta?',
      answer: 'Depende de cada caso. Te damos un presupuesto claro antes de empezar, sin cargos sorpresa.',
    },
  ];
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Initials for the generated wordmark: at most two letters. */
function monogramFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(' ')
    .filter((w) => w.length > 1);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Turns detected service keywords into presentable service cards. */
function servicesFromEvidence(
  detected: string[],
  categoryKey: string,
): { title: string; description: string }[] {
  const unique = [...new Set(detected.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 3))];
  if (unique.length >= 3) {
    return unique.slice(0, 6).map((service) => ({
      title: titleCase(service),
      description: `Disponible en nuestro centro de Málaga. Pregúntanos por ${service} al contactar.`,
    }));
  }
  return DEFAULT_SERVICES[categoryKey] ?? GENERIC_SERVICES;
}

export function buildConcept(detail: BusinessDetail, claude: ClaudeAnalysis | null): DemoConcept {
  const category = CATEGORY_BY_KEY.get(detail.business.category) ?? OTHER_CATEGORY;
  const bestReview = detail.reviews[0] ?? null;
  const metrics = (detail.audit?.metrics ?? {}) as Record<string, unknown>;
  const detected = Array.isArray(metrics.detectedServices) ? (metrics.detectedServices as string[]) : [];

  const phone = detail.business.primary_phone;
  const phoneFormatted = formatPhone(phone);
  const phoneDigits = phone ? phone.replace(/[^\d+]/g, '') : null;
  const city = detail.business.city ?? detail.business.municipality ?? 'Málaga';
  const theme = THEMES[category.key] ?? DEFAULT_THEME;

  const trustPoints: { value: string; label: string }[] = [];
  if (bestReview?.rating) {
    trustPoints.push({ value: bestReview.rating.toFixed(1), label: 'Valoración media' });
  }
  if (bestReview?.review_count) {
    trustPoints.push({ value: String(bestReview.review_count), label: 'Reseñas públicas' });
  }
  trustPoints.push({ value: city, label: 'Dónde estamos' });
  if (detail.business.postal_code) {
    trustPoints.push({ value: detail.business.postal_code, label: 'Código postal' });
  }

  const bookingAvailable = !['retail', 'grocery', 'cafe_bar'].includes(category.key);
  const claudeCta = claude?.recommendedPrimaryCta?.trim();
  const primaryCtaLabel = claudeCta
    ? claudeCta.slice(0, 40)
    : bookingAvailable
      ? 'Pedir cita'
      : 'Pedir presupuesto';

  const positioning = claude?.businessPositioning?.split('.')[0]?.trim();

  // WhatsApp is the dominant contact channel for Spanish local business, so a
  // concept without it is not showing the business its real best case.
  const whatsappDigits = phoneDigits ? phoneDigits.replace(/\D/g, '') : null;

  return {
    businessName: detail.business.name,
    monogram: monogramFor(detail.business.name),
    tagline: positioning ? positioning.slice(0, 110) : `${category.label} en ${city}`,
    intro:
      detail.business.description?.slice(0, 300) ??
      `${detail.business.name} atiende en ${city}. Este concepto muestra cómo podría presentarse el negocio online: servicios claros, pruebas visibles y una vía de contacto que funciona desde el móvil.`,
    categoryLabel: category.label,
    accent: theme.accent,
    theme,
    services: servicesFromEvidence(detected, category.key),
    process: DEFAULT_PROCESS[category.key] ?? GENERIC_PROCESS,
    faqs: faqsFor(city, phoneDigits !== null),
    trustPoints: trustPoints.slice(0, 4),
    reviews: detail.reviews.slice(0, 3).map((r) => ({
      rating: r.rating,
      count: r.review_count,
      source: r.source,
    })),
    primaryCta: { label: primaryCtaLabel, href: phoneDigits ? `tel:${phoneDigits}` : '#contact' },
    secondaryCta: phoneDigits
      ? { label: 'Escribir un mensaje', href: '#contact' }
      : { label: 'Ver servicios', href: '#services' },
    contact: {
      phone: phoneFormatted ?? phone,
      phoneHref: phoneDigits ? `tel:${phoneDigits}` : null,
      whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
      email: detail.business.primary_email,
      address: detail.business.address,
    },
    location: {
      address: detail.business.address,
      city: detail.business.city,
      postalCode: detail.business.postal_code,
      mapsQuery: detail.business.address
        ? encodeURIComponent(`${detail.business.name}, ${detail.business.address}`)
        : null,
    },
    booking: {
      available: bookingAvailable,
      label: bookingAvailable ? 'Reservar online' : 'Que me llamen',
      href: '#contact',
    },
    sourceNote:
      'Concepto generado a partir de información pública del negocio, con fines de demostración.',
    generatedFrom: claude ? 'facts_and_claude' : 'facts',
  };
}
