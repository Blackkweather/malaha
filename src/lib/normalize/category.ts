import { normalizeText } from './text';

/**
 * Category taxonomy.
 *
 * `commercialValue` answers one question only: how commercially attractive is
 * this category to a web design agency? It combines average project ticket,
 * margin, dependence on online enquiry/booking, and competitive pressure. It is
 * a property of the CATEGORY, never of the individual business.
 */
export interface CategoryDefinition {
  key: string;
  label: string;
  /** 0..100. Higher means a more valuable category to sell a website to. */
  commercialValue: number;
  /** Matching terms: raw source categories, OSM tag values, Spanish keywords. */
  terms: string[];
  /** Irrelevant categories are dropped by the quality filter before ranking. */
  excluded?: boolean;
  /** Short justification surfaced in score explanations. */
  rationale: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  // --- Very high value: high ticket, booking-driven, competitive -----------
  {
    key: 'dental_clinic',
    label: 'Dental clinic',
    commercialValue: 96,
    terms: ['dentist', 'dental', 'dentista', 'clinica dental', 'odontologia', 'ortodoncia', 'implantes dentales'],
    rationale: 'High treatment value and patients choose a clinic online',
  },
  {
    key: 'cosmetic_surgery',
    label: 'Cosmetic surgery / aesthetic medicine',
    commercialValue: 98,
    terms: ['plastic surgery', 'cirugia estetica', 'cirujano plastico', 'medicina estetica', 'estetica avanzada', 'clinica estetica'],
    rationale: 'Very high treatment value, entirely enquiry driven',
  },
  {
    key: 'private_clinic',
    label: 'Private medical clinic',
    commercialValue: 92,
    terms: ['clinic', 'clinica', 'hospital privado', 'centro medico', 'doctor', 'medico', 'traumatologia', 'ginecologia', 'dermatologia', 'fertilidad', 'oftalmologia'],
    rationale: 'High value private treatment with online patient acquisition',
  },
  {
    key: 'law_firm',
    label: 'Law firm',
    commercialValue: 94,
    terms: ['lawyer', 'abogado', 'abogados', 'bufete', 'despacho de abogados', 'asesoria juridica', 'solicitor'],
    rationale: 'High case value, trust and authority sell the service',
  },
  {
    key: 'real_estate',
    label: 'Real estate agency',
    commercialValue: 95,
    terms: ['real estate', 'inmobiliaria', 'estate agent', 'property', 'promotora', 'agencia inmobiliaria'],
    rationale: 'Very high transaction value and a website is the storefront',
  },
  {
    key: 'hotel',
    label: 'Hotel / accommodation',
    commercialValue: 90,
    terms: ['hotel', 'hostal', 'apartamentos turisticos', 'boutique hotel', 'aparthotel', 'guest house', 'resort'],
    rationale: 'Direct bookings avoid OTA commission, so a site pays for itself',
  },
  {
    key: 'yacht_charter',
    label: 'Yacht / boat charter',
    commercialValue: 93,
    terms: ['yacht', 'charter', 'alquiler de barcos', 'boat rental', 'nautica', 'catamaran'],
    rationale: 'High ticket leisure booking, strongly visual',
  },
  {
    key: 'wedding_events',
    label: 'Wedding & events venue',
    commercialValue: 91,
    terms: ['wedding', 'bodas', 'eventos', 'catering', 'salon de celebraciones', 'finca de bodas', 'banquetes'],
    rationale: 'High ticket, decisions made from photography and enquiry forms',
  },
  {
    key: 'private_education',
    label: 'Private school / academy',
    commercialValue: 86,
    terms: ['private school', 'colegio privado', 'colegio internacional', 'academia', 'escuela de idiomas', 'language school', 'autoescuela', 'driving school', 'formacion'],
    rationale: 'High lifetime value per enrolment, parents research online',
  },

  // --- Upper mid value ----------------------------------------------------
  {
    key: 'physiotherapy',
    label: 'Physiotherapy / rehabilitation',
    commercialValue: 78,
    terms: ['physiotherapy', 'fisioterapia', 'fisioterapeuta', 'rehabilitacion', 'osteopatia', 'quiropractica'],
    rationale: 'Recurring appointments and online booking demand',
  },
  {
    key: 'veterinary',
    label: 'Veterinary clinic',
    commercialValue: 76,
    terms: ['veterinary', 'veterinario', 'clinica veterinaria', 'vet'],
    rationale: 'Recurring spend with strong local search intent',
  },
  {
    key: 'architecture',
    label: 'Architecture / interior design studio',
    commercialValue: 84,
    terms: ['architect', 'arquitecto', 'estudio de arquitectura', 'interiorismo', 'interior design'],
    rationale: 'High project value and portfolio-led selling',
  },
  {
    key: 'professional_services',
    label: 'Accountancy / consultancy',
    commercialValue: 80,
    terms: ['gestoria', 'asesoria', 'accountant', 'consultoria', 'notaria', 'notary', 'auditoria', 'asesor fiscal'],
    rationale: 'Recurring retainer clients acquired through credibility',
  },
  {
    key: 'construction',
    label: 'Construction / renovation',
    commercialValue: 83,
    terms: ['construction', 'construccion', 'reformas', 'obras', 'contratista', 'builder', 'albanileria', 'piscinas'],
    rationale: 'Very high project value, sold on completed-work galleries',
  },
  {
    key: 'home_services',
    label: 'Installer / technical trade',
    commercialValue: 72,
    terms: ['plumber', 'fontanero', 'electricista', 'electrician', 'cerrajero', 'locksmith', 'climatizacion', 'aire acondicionado', 'placas solares', 'solar', 'toldos', 'carpinteria'],
    rationale: 'Urgent local searches convert directly from a mobile site',
  },
  {
    key: 'car_dealer',
    label: 'Car dealership / workshop',
    commercialValue: 79,
    terms: ['car dealer', 'concesionario', 'venta de coches', 'taller mecanico', 'car repair', 'neumaticos', 'desguace'],
    rationale: 'High ticket sales with online stock browsing',
  },
  {
    key: 'jewellery',
    label: 'Jeweller / high-end retail',
    commercialValue: 77,
    terms: ['jewellery', 'joyeria', 'relojeria', 'watches', 'orfebreria'],
    rationale: 'High margin retail that benefits from a premium presentation',
  },
  {
    key: 'optician',
    label: 'Optician / audiology',
    commercialValue: 74,
    terms: ['optician', 'optica', 'audiologia', 'audifonos', 'gafas'],
    rationale: 'Appointment driven with good average basket',
  },
  {
    key: 'fitness',
    label: 'Gym / sports club',
    commercialValue: 71,
    terms: ['gym', 'gimnasio', 'fitness', 'crossfit', 'padel', 'tenis', 'pilates', 'yoga', 'club deportivo', 'escuela de surf'],
    rationale: 'Membership subscriptions with online sign-up potential',
  },
  {
    key: 'spa_wellness',
    label: 'Spa & wellness',
    commercialValue: 73,
    terms: ['spa', 'balneario', 'wellness', 'masajes', 'centro de bienestar', 'hammam'],
    rationale: 'Bookable treatments with strong visual appeal',
  },
  {
    key: 'travel_agency',
    label: 'Travel agency / tours',
    commercialValue: 75,
    terms: ['travel agency', 'agencia de viajes', 'tours', 'excursiones', 'guia turistico', 'tour operator'],
    rationale: 'Booking driven with high seasonal transaction value',
  },

  // --- Mid value ----------------------------------------------------------
  {
    key: 'restaurant',
    label: 'Restaurant',
    commercialValue: 64,
    terms: ['restaurant', 'restaurante', 'marisqueria', 'asador', 'chiringuito', 'gastrobar', 'sushi', 'pizzeria', 'tapas'],
    rationale: 'Reservations and menus drive covers, though ticket size is modest',
  },
  {
    key: 'beauty',
    label: 'Beauty salon / hairdresser',
    commercialValue: 62,
    terms: ['beauty', 'peluqueria', 'hairdresser', 'estetica', 'salon de belleza', 'barberia', 'barber', 'unas', 'nails', 'depilacion', 'tatuajes', 'tattoo'],
    rationale: 'Appointment booking is the main conversion, ticket size modest',
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy / parapharmacy',
    commercialValue: 55,
    terms: ['pharmacy', 'farmacia', 'parafarmacia', 'herbolario'],
    rationale: 'Regulated and mostly walk-in, limited web upside',
  },
  {
    key: 'pet_services',
    label: 'Pet services',
    commercialValue: 58,
    terms: ['pet grooming', 'peluqueria canina', 'residencia canina', 'tienda de mascotas', 'adiestramiento'],
    rationale: 'Recurring bookings but small average ticket',
  },
  {
    key: 'retail',
    label: 'Specialist retail',
    commercialValue: 52,
    terms: ['shop', 'tienda', 'boutique', 'moda', 'clothes', 'muebles', 'furniture', 'decoracion', 'floristeria', 'libreria', 'deportes'],
    rationale: 'Website value depends on whether they sell online',

  },

  // --- Low value ----------------------------------------------------------
  {
    key: 'cafe_bar',
    label: 'Bar / cafe / bakery',
    commercialValue: 38,
    terms: ['bar', 'cafe', 'cafeteria', 'pub', 'panaderia', 'bakery', 'heladeria', 'churreria', 'kiosco'],
    rationale: 'Low ticket and largely walk-in trade',
  },
  {
    key: 'grocery',
    label: 'Supermarket / convenience',
    commercialValue: 30,
    terms: ['supermarket', 'supermercado', 'alimentacion', 'fruteria', 'carniceria', 'pescaderia', 'estanco'],
    rationale: 'Commodity retail with little website upside',
  },

  // --- Excluded: not businesses a design agency can sell a website to -----
  {
    key: 'infrastructure',
    label: 'Infrastructure / amenity',
    commercialValue: 0,
    excluded: true,
    terms: ['atm', 'cajero', 'bench', 'banco publico', 'parking', 'aparcamiento', 'bus stop', 'parada', 'toilets', 'aseos', 'fuente', 'recycling', 'contenedor', 'post box', 'buzon', 'telephone', 'charging station', 'taxi stand', 'waste basket', 'street lamp', 'bicycle parking'],
    rationale: 'Not a business',
  },
  {
    key: 'public_body',
    label: 'Public body / institution',
    commercialValue: 0,
    excluded: true,
    terms: ['ayuntamiento', 'town hall', 'police', 'policia', 'guardia civil', 'bomberos', 'fire station', 'juzgado', 'courthouse', 'oficina de empleo', 'seguridad social', 'consulate', 'embassy', 'prison', 'military'],
    rationale: 'Public sector, not an agency prospect',
  },
  {
    key: 'worship',
    label: 'Place of worship',
    commercialValue: 0,
    excluded: true,
    terms: ['church', 'iglesia', 'mosque', 'mezquita', 'synagogue', 'sinagoga', 'ermita', 'capilla', 'cemetery', 'cementerio'],
    rationale: 'Not a commercial prospect',
  },
  {
    key: 'other',
    label: 'Other',
    commercialValue: 45,
    terms: [],
    rationale: 'Unclassified business, treated as average commercial value',
  },
];

export const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export const OTHER_CATEGORY = CATEGORY_BY_KEY.get('other') as CategoryDefinition;

export interface CategoryMatch {
  key: string;
  label: string;
  commercialValue: number;
  excluded: boolean;
  confidence: number;
  matchedTerm: string | null;
  rationale: string;
}

interface IndexedTerm {
  term: string;
  normalized: string;
  category: CategoryDefinition;
}

const TERM_INDEX: IndexedTerm[] = CATEGORIES.flatMap((category) =>
  category.terms.map((term) => ({
    term,
    normalized: normalizeText(term),
    category,
  })),
  // Longest terms first so the most specific category wins.
).sort((a, b) => b.normalized.length - a.normalized.length);

function containsTerm(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.includes(' ')) return haystack.includes(needle);
  // Single words must match on a token boundary so "bar" does not match
  // "barberia" and "spa" does not match "espana".
  return haystack === needle || new RegExp(`(^| )${needle}( |$)`).test(haystack);
}

/**
 * Maps a raw category string (and, as weaker evidence, the business name) onto
 * the taxonomy.
 *
 * The explicit category field is trusted far more than the name: a business
 * called "Bar Manolo" whose source category is `restaurant` is a restaurant.
 */
export function classifyCategory(
  rawCategory: string | null | undefined,
  businessName?: string | null,
  extraTerms: string[] = [],
): CategoryMatch {
  const categoryText = normalizeText(
    [rawCategory ?? '', ...extraTerms].filter(Boolean).join(' '),
  );
  const nameText = normalizeText(businessName ?? '');

  for (const entry of TERM_INDEX) {
    if (categoryText && containsTerm(categoryText, entry.normalized)) {
      return {
        key: entry.category.key,
        label: entry.category.label,
        commercialValue: entry.category.commercialValue,
        excluded: entry.category.excluded === true,
        confidence: entry.normalized.includes(' ') ? 0.95 : 0.85,
        matchedTerm: entry.term,
        rationale: entry.category.rationale,
      };
    }
  }

  for (const entry of TERM_INDEX) {
    if (nameText && containsTerm(nameText, entry.normalized)) {
      return {
        key: entry.category.key,
        label: entry.category.label,
        commercialValue: entry.category.commercialValue,
        excluded: entry.category.excluded === true,
        confidence: entry.normalized.includes(' ') ? 0.7 : 0.55,
        matchedTerm: entry.term,
        rationale: entry.category.rationale,
      };
    }
  }

  return {
    key: OTHER_CATEGORY.key,
    label: OTHER_CATEGORY.label,
    commercialValue: OTHER_CATEGORY.commercialValue,
    excluded: false,
    confidence: 0.2,
    matchedTerm: null,
    rationale: OTHER_CATEGORY.rationale,
  };
}

/** Search keywords for a category, used to build the search index document. */
export function categoryKeywords(key: string): string[] {
  const category = CATEGORY_BY_KEY.get(key);
  if (!category) return [];
  return [category.label, ...category.terms];
}
