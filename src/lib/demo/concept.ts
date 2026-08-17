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
 */
export interface DemoConcept {
  businessName: string;
  tagline: string;
  intro: string;
  categoryLabel: string;
  accent: string;
  services: { title: string; description: string }[];
  trustPoints: { value: string; label: string }[];
  reviews: { rating: number | null; count: number | null; source: string }[];
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  contact: {
    phone: string | null;
    phoneHref: string | null;
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

/** Per-category accent colours so demos do not all look identical. */
const ACCENTS: Record<string, string> = {
  dental_clinic: '#38bdf8',
  cosmetic_surgery: '#f472b6',
  private_clinic: '#34d399',
  law_firm: '#a78bfa',
  real_estate: '#fbbf24',
  hotel: '#fb923c',
  yacht_charter: '#22d3ee',
  wedding_events: '#f9a8d4',
  private_education: '#60a5fa',
  restaurant: '#f87171',
  beauty: '#e879f9',
  fitness: '#4ade80',
  architecture: '#94a3b8',
  construction: '#facc15',
  professional_services: '#818cf8',
};

/** Default service sets per category, used when the audit detected none. */
const DEFAULT_SERVICES: Record<string, { title: string; description: string }[]> = {
  dental_clinic: [
    { title: 'General dentistry', description: 'Check-ups, hygiene and preventive care for the whole family.' },
    { title: 'Implants', description: 'Fixed, natural-looking replacements planned with 3D imaging.' },
    { title: 'Orthodontics', description: 'Discreet aligners and modern braces for adults and teenagers.' },
  ],
  law_firm: [
    { title: 'Civil and commercial law', description: 'Contracts, disputes and company matters handled end to end.' },
    { title: 'Property law', description: 'Purchases, conveyancing and title issues across Malaga.' },
    { title: 'Family law', description: 'Separation, custody and inheritance, handled discreetly.' },
  ],
  real_estate: [
    { title: 'Buy', description: 'Curated homes and investment property across the city.' },
    { title: 'Sell', description: 'Valuation, photography and qualified buyer matching.' },
    { title: 'Rent', description: 'Long and short-term rentals with full management.' },
  ],
  hotel: [
    { title: 'Rooms and suites', description: 'Comfortable, quiet rooms a short walk from the centre.' },
    { title: 'Direct booking', description: 'Best available rate, booked directly with no commission.' },
    { title: 'Experiences', description: 'Local guidance, transfers and curated city experiences.' },
  ],
};

const GENERIC_SERVICES = [
  { title: 'What we do', description: 'Our core service, explained clearly and without jargon.' },
  { title: 'How we work', description: 'A simple, transparent process from first contact to delivery.' },
  { title: 'Get a quote', description: 'Tell us what you need and receive a clear, itemised proposal.' },
];

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
      description: `Offered at our Malaga location. Ask about ${service} when you get in touch.`,
    }));
  }
  return DEFAULT_SERVICES[categoryKey] ?? GENERIC_SERVICES;
}

export function buildConcept(detail: BusinessDetail, claude: ClaudeAnalysis | null): DemoConcept {
  const category = CATEGORY_BY_KEY.get(detail.business.category) ?? OTHER_CATEGORY;
  const bestReview = detail.reviews[0] ?? null;
  const metrics = (detail.audit?.metrics ?? {}) as Record<string, unknown>;
  const detected = Array.isArray(metrics.detectedServices)
    ? (metrics.detectedServices as string[])
    : [];

  const phone = detail.business.primary_phone;
  const phoneFormatted = formatPhone(phone);
  const phoneDigits = phone ? phone.replace(/[^\d+]/g, '') : null;
  const city = detail.business.city ?? detail.business.municipality ?? 'Malaga';

  const trustPoints: { value: string; label: string }[] = [];
  if (bestReview?.rating) {
    trustPoints.push({ value: bestReview.rating.toFixed(1), label: 'Average public rating' });
  }
  if (bestReview?.review_count) {
    trustPoints.push({ value: String(bestReview.review_count), label: 'Public reviews' });
  }
  trustPoints.push({ value: city, label: 'Where to find us' });
  if (detail.business.postal_code) {
    trustPoints.push({ value: detail.business.postal_code, label: 'Postal code' });
  }

  const bookingAvailable = !['retail', 'grocery', 'cafe_bar'].includes(category.key);
  const claudeCta = claude?.recommendedPrimaryCta?.trim();
  const primaryCtaLabel = claudeCta
    ? claudeCta.slice(0, 40)
    : bookingAvailable
      ? 'Book an appointment'
      : 'Request a quote';

  const positioning = claude?.businessPositioning?.split('.')[0]?.trim();

  return {
    businessName: detail.business.name,
    tagline: positioning ? positioning.slice(0, 110) : `${category.label} in ${city}`,
    intro:
      detail.business.description?.slice(0, 300) ??
      `${detail.business.name} is a ${category.label.toLowerCase()} serving ${city}. This concept shows how the business could present itself online: clear services, visible proof, and a contact path that works on a phone.`,
    categoryLabel: category.label,
    accent: ACCENTS[category.key] ?? '#38bdf8',
    services: servicesFromEvidence(detected, category.key),
    trustPoints: trustPoints.slice(0, 4),
    reviews: detail.reviews.slice(0, 3).map((r) => ({
      rating: r.rating,
      count: r.review_count,
      source: r.source,
    })),
    primaryCta: { label: primaryCtaLabel, href: phoneDigits ? `tel:${phoneDigits}` : '#contact' },
    secondaryCta: phoneDigits
      ? { label: 'Send a message', href: '#contact' }
      : { label: 'See our services', href: '#services' },
    contact: {
      phone: phoneFormatted ?? phone,
      phoneHref: phoneDigits ? `tel:${phoneDigits}` : null,
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
      label: bookingAvailable ? 'Book online' : 'Request a callback',
      href: '#contact',
    },
    sourceNote:
      'Concept generated from publicly available business information, for demonstration purposes.',
    generatedFrom: claude ? 'facts_and_claude' : 'facts',
  };
}
