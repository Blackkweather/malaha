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
  /** Imagery, preferring photographs the business already publishes. */
  media: DemoMedia;
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
  /** Structured data, and the comparison that does the selling. */
  seo: DemoSeo;
  comparison: ComparisonRow[];
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
/**
 * Imagery for the concept.
 *
 * Sourced from the business's own website wherever possible: their real
 * premises photographed by them beats any stock image, and it is already
 * public. When the audit found nothing usable the renderer falls back to
 * generated artwork rather than an unrelated stock photo, because a dental
 * clinic illustrated with somebody else's waiting room is a worse lie than
 * no photograph at all.
 */
/**
 * Search and answer-engine metadata.
 *
 * The demo page itself is noindex, so this is not about ranking the demo.
 * It is that the concept demonstrates the structured data the prospect is
 * missing today, and the same generator produces the real site once the
 * deal closes: a typed LocalBusiness entity, FAQ markup Google renders as
 * rich results, and clean question/answer blocks an AI assistant can quote.
 */
export interface DemoSeo {
  /** schema.org type, narrowed by sector. */
  schemaType: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  sameAs: string[];
}

/** One "today vs this concept" row, taken from the audit. */
export interface ComparisonRow {
  today: string;
  proposed: string;
}

export interface DemoMedia {
  hero: string | null;
  /** True when the pictures are generic stock, not the business's own. */
  isStock: boolean;
  logo: string | null;
  gallery: string[];
}

/** Hero layout archetype, so sectors do not all share one composition. */
export type HeroStyle = 'split' | 'showcase' | 'editorial';

export interface DemoTheme {
  mode: 'light' | 'dark';
  accent: string;
  /** Tint used behind hero and section washes. */
  accentSoft: string;
  headingFont: 'sans' | 'serif';
  heroStyle: HeroStyle;
}

const THEMES: Record<string, DemoTheme> = {
  dental_clinic: {
    mode: 'light',
    accent: '#0284c7',
    accentSoft: '#e0f2fe',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  private_clinic: {
    mode: 'light',
    accent: '#0d9488',
    accentSoft: '#ccfbf1',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  physiotherapy: {
    mode: 'light',
    accent: '#059669',
    accentSoft: '#d1fae5',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  veterinary: {
    mode: 'light',
    accent: '#0891b2',
    accentSoft: '#cffafe',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  pharmacy: {
    mode: 'light',
    accent: '#16a34a',
    accentSoft: '#dcfce7',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  cosmetic_surgery: {
    mode: 'light',
    accent: '#be185d',
    accentSoft: '#fce7f3',
    headingFont: 'serif',
    heroStyle: 'editorial',
  },
  beauty: {
    mode: 'light',
    accent: '#c026d3',
    accentSoft: '#fae8ff',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  spa_wellness: {
    mode: 'light',
    accent: '#9333ea',
    accentSoft: '#f3e8ff',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  law_firm: {
    mode: 'light',
    accent: '#1e40af',
    accentSoft: '#e0e7ff',
    headingFont: 'serif',
    heroStyle: 'editorial',
  },
  professional_services: {
    mode: 'light',
    accent: '#3730a3',
    accentSoft: '#e0e7ff',
    headingFont: 'serif',
    heroStyle: 'editorial',
  },
  architecture: {
    mode: 'light',
    accent: '#334155',
    accentSoft: '#e2e8f0',
    headingFont: 'serif',
    heroStyle: 'editorial',
  },
  real_estate: {
    mode: 'light',
    accent: '#b45309',
    accentSoft: '#fef3c7',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  hotel: {
    mode: 'dark',
    accent: '#f59e0b',
    accentSoft: '#78350f',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  restaurant: {
    mode: 'dark',
    accent: '#f97316',
    accentSoft: '#7c2d12',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  cafe_bar: {
    mode: 'dark',
    accent: '#f59e0b',
    accentSoft: '#78350f',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  yacht_charter: {
    mode: 'dark',
    accent: '#22d3ee',
    accentSoft: '#164e63',
    headingFont: 'sans',
    heroStyle: 'showcase',
  },
  wedding_events: {
    mode: 'light',
    accent: '#db2777',
    accentSoft: '#fce7f3',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  fitness: {
    mode: 'dark',
    accent: '#84cc16',
    accentSoft: '#365314',
    headingFont: 'sans',
    heroStyle: 'showcase',
  },
  private_education: {
    mode: 'light',
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  construction: {
    mode: 'dark',
    accent: '#eab308',
    accentSoft: '#713f12',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  home_services: {
    mode: 'light',
    accent: '#ea580c',
    accentSoft: '#ffedd5',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  car_dealer: {
    mode: 'dark',
    accent: '#38bdf8',
    accentSoft: '#0c4a6e',
    headingFont: 'sans',
    heroStyle: 'showcase',
  },
  jewellery: {
    mode: 'dark',
    accent: '#d4af37',
    accentSoft: '#5c4813',
    headingFont: 'serif',
    heroStyle: 'showcase',
  },
  optician: {
    mode: 'light',
    accent: '#0369a1',
    accentSoft: '#e0f2fe',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  travel_agency: {
    mode: 'light',
    accent: '#0d9488',
    accentSoft: '#ccfbf1',
    headingFont: 'sans',
    heroStyle: 'showcase',
  },
  pet_services: {
    mode: 'light',
    accent: '#ca8a04',
    accentSoft: '#fef9c3',
    headingFont: 'sans',
    heroStyle: 'split',
  },
  retail: {
    mode: 'light',
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    headingFont: 'sans',
    heroStyle: 'showcase',
  },
};

const DEFAULT_THEME: DemoTheme = {
  mode: 'light',
  accent: '#0284c7',
  accentSoft: '#e0f2fe',
  headingFont: 'sans',
  heroStyle: 'split',
};

/**
 * Search terms used to illustrate a sector when the business publishes no
 * photographs of its own — which is the case for every prospect that has no
 * website, and those are precisely the ones worth pitching.
 */
const STOCK_TERMS: Record<string, string> = {
  dental_clinic: 'dentist,dental,clinic',
  private_clinic: 'clinic,doctor,medical',
  physiotherapy: 'physiotherapy,massage,rehabilitation',
  veterinary: 'veterinary,vet,pet',
  pharmacy: 'pharmacy,chemist',
  cosmetic_surgery: 'aesthetic,clinic,skincare',
  beauty: 'salon,hairdresser,beauty',
  spa_wellness: 'spa,wellness,massage',
  law_firm: 'law,office,lawyer',
  professional_services: 'office,business,meeting',
  architecture: 'architecture,interior,design',
  real_estate: 'apartment,interior,property',
  hotel: 'hotel,room,lobby',
  restaurant: 'restaurant,food,dining',
  cafe_bar: 'cafe,coffee,bar',
  yacht_charter: 'yacht,boat,sea',
  wedding_events: 'wedding,event,celebration',
  fitness: 'gym,fitness,training',
  private_education: 'classroom,students,school',
  construction: 'construction,building,site',
  home_services: 'renovation,tools,home',
  car_dealer: 'car,showroom,automotive',
  jewellery: 'jewelry,gold,ring',
  optician: 'glasses,optician,eyewear',
  travel_agency: 'travel,beach,holiday',
  pet_services: 'pet,dog,grooming',
  retail: 'shop,boutique,retail',
};

/**
 * Deterministic stock imagery for a sector.
 *
 * `lock` pins the photograph to a seed, so regenerating a concept for the
 * same business returns the same pictures instead of reshuffling the page
 * every time it is opened. These are clearly generic images standing in for
 * photography the business has not published — the page never presents them
 * as pictures of the business itself.
 */
function stockImages(categoryKey: string, seed: string, count: number): string[] {
  const terms = STOCK_TERMS[categoryKey] ?? 'business,office';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;

  return Array.from({ length: count }, (_, i) =>
    `https://loremflickr.com/1200/900/${encodeURIComponent(terms)}?lock=${hash + i}`,
  );
}

/**
 * schema.org types per sector.
 *
 * A bare LocalBusiness is a wasted opportunity: Google and the answer
 * engines treat a typed Dentist or LegalService as a far stronger entity
 * signal, and most small-business sites declare no type at all.
 */
const SCHEMA_TYPES: Record<string, string> = {
  dental_clinic: "Dentist",
  private_clinic: "MedicalClinic",
  cosmetic_surgery: "MedicalClinic",
  physiotherapy: "Physiotherapy",
  veterinary: "VeterinaryCare",
  pharmacy: "Pharmacy",
  law_firm: "LegalService",
  professional_services: "ProfessionalService",
  architecture: "ProfessionalService",
  real_estate: "RealEstateAgent",
  hotel: "Hotel",
  restaurant: "Restaurant",
  cafe_bar: "CafeOrCoffeeShop",
  beauty: "BeautySalon",
  spa_wellness: "DaySpa",
  fitness: "ExerciseGym",
  private_education: "EducationalOrganization",
  travel_agency: "TravelAgency",
  car_dealer: "AutomotiveBusiness",
  jewellery: "JewelryStore",
  optician: "Optician",
  pet_services: "PetStore",
  home_services: "HomeAndConstructionBusiness",
  construction: "GeneralContractor",
  wedding_events: "EventVenue",
  retail: "Store",
};

/**
 * What the audit found, paired with what the concept does instead.
 *
 * This is the section that sells. Not "your site looks dated" — a specific,
 * checkable list of what is wrong today beside what replaces it. Every row
 * comes from a real finding, so the owner can verify each one, and a problem
 * their site does not have is never listed.
 */
const COMPARISONS: Record<string, ComparisonRow> = {
  no_website: { today: "Sin web: esas búsquedas acaban en la competencia", proposed: "Web propia indexable, con ficha de negocio estructurada" },
  social_only_presence: { today: "Solo redes sociales, sin dominio propio", proposed: "Dominio propio y control total de la presencia online" },
  website_unreachable: { today: "La web no responde", proposed: "Alojamiento estable, con certificado y copias" },
  http_error_status: { today: "La página principal devuelve un error", proposed: "Sitio funcionando y monitorizado" },
  no_https: { today: "Sin HTTPS: el navegador la marca como no segura", proposed: "HTTPS en todo el sitio" },
  no_mobile_viewport: { today: "No adaptada a móvil", proposed: "Diseño móvil primero, donde está la mayoría del tráfico" },
  fixed_width_layout: { today: "Ancho fijo: se rompe en pantallas pequeñas", proposed: "Rejilla fluida que se adapta a cualquier pantalla" },
  very_slow_response: { today: "Carga muy lenta", proposed: "Carga por debajo del segundo, sin recursos que bloqueen" },
  slow_response: { today: "Respuesta lenta del servidor", proposed: "Entrega optimizada desde CDN" },
  no_phone_link: { today: "El teléfono no se puede pulsar desde el móvil", proposed: "Llamada a un toque y WhatsApp siempre visibles" },
  no_contact_path: { today: "Sin vía de contacto clara", proposed: "Formulario corto, WhatsApp y teléfono en cada pantalla" },
  no_booking_path: { today: "Sin cita online", proposed: "Reserva online, sin llamar ni esperar" },
  no_whatsapp: { today: "Sin WhatsApp", proposed: "WhatsApp como canal principal, como espera el cliente aquí" },
  weak_cta: { today: "Sin llamada a la acción clara", proposed: "Una acción principal evidente en cada sección" },
  missing_title: { today: "Sin título de página utilizable", proposed: "Títulos escritos para búsqueda local" },
  missing_meta_description: { today: "Sin meta descripción", proposed: "Descripciones que ganan el clic en Google" },
  missing_h1: { today: "Sin encabezado H1", proposed: "Jerarquía semántica correcta de principio a fin" },
  missing_canonical: { today: "Sin URL canónica", proposed: "Canónicas y sitemap generados automáticamente" },
  low_image_alt_coverage: { today: "Imágenes sin texto alternativo", proposed: "Alt en todas las imágenes: accesibilidad y SEO" },
  no_lang_attribute: { today: "Sin idioma declarado", proposed: "Idioma y región declarados para búsqueda local" },
  broken_links: { today: "Enlaces internos rotos", proposed: "Enlazado interno revisado y monitorizado" },
  no_social_links: { today: "Sin perfiles sociales enlazados", proposed: "Perfiles enlazados y declarados como la misma entidad" },
  stale_copyright: { today: "Año de copyright desactualizado", proposed: "Sitio mantenido, con señales de actividad recientes" },
  legacy_markup: { today: "Código y técnicas ya obsoletas", proposed: "HTML moderno, accesible y rápido" },
  free_site_builder: { today: "Alojada en un subdominio gratuito", proposed: "Dominio propio, sin publicidad de terceros" },
  no_analytics: { today: "Sin analítica: no se puede medir nada", proposed: "Medición de llamadas, formularios y reservas" },
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

  /*
   * Imagery comes from the business's own site, captured during the audit.
   * og:image first because it is the shot they chose to represent
   * themselves; the rest of the gallery follows in page order.
   */
  const ogImage = typeof metrics.ogImage === 'string' ? metrics.ogImage : null;
  const logoUrl = typeof metrics.logoUrl === 'string' ? metrics.logoUrl : null;
  const crawledImages = Array.isArray(metrics.imageUrls) ? (metrics.imageUrls as string[]) : [];
  const gallery = [...new Set([ogImage, ...crawledImages].filter((u): u is string => typeof u === 'string'))];

  /*
   * A prospect with no website is the strongest kind of lead and also the one
   * with no photographs at all. Showing it a blank concept undersells the
   * pitch, so the sector is illustrated with clearly generic stock, labelled
   * as such on the page.
   */
  /*
   * The comparison is ordered by the weight the auditor already assigned to
   * each finding, so the top row is the one costing them most rather than
   * whichever happened to be detected first.
   */
  const comparison = detail.issues
    .map((issue) => COMPARISONS[issue.code])
    .filter((row): row is ComparisonRow => row !== undefined)
    .slice(0, 6);

  const usingStock = gallery.length === 0;
  const media = usingStock ? stockImages(category.key, detail.business.id, 5) : gallery;

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
    media: {
      hero: media[0] ?? null,
      isStock: usingStock,
      logo: logoUrl,
      gallery: media.slice(0, 6),
    },
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
    seo: {
      schemaType: SCHEMA_TYPES[category.key] ?? "LocalBusiness",
      description: `${category.label} en ${city}. ${detail.business.description ?? ""}`.trim().slice(0, 300),
      latitude: detail.business.latitude,
      longitude: detail.business.longitude,
      sameAs: detail.socials.map((profile) => profile.url).slice(0, 6),
    },
    comparison,
    sourceNote:
      'Concepto generado a partir de información pública del negocio, con fines de demostración.',
    generatedFrom: claude ? 'facts_and_claude' : 'facts',
  };
}
