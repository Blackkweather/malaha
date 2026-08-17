import { CATEGORY_BY_KEY, OTHER_CATEGORY } from '../normalize/category';
import { clamp, round, type ComponentScore, type ScoreReason } from './types';

export interface CommercialValueInput {
  categoryKey: string;
  /** 0..1 confidence that the category classification is right. */
  categoryConfidence: number;
  /** Public review count, used only as a proxy for operational scale. */
  reviewCount: number | null;
  /** Services detected on the site or supplied by Groq extraction. */
  detectedServices?: string[];
  /** True when the business sells online or takes bookings. */
  hasTransactionalIntent?: boolean;
}

/**
 * Service keywords that indicate a high-ticket offering regardless of the
 * headline category, e.g. a "clinic" that does implants or a "shop" that runs
 * a full e-commerce operation.
 */
const HIGH_VALUE_SERVICE_TERMS = [
  'implante', 'implant', 'ortodoncia', 'invisalign', 'estetica dental',
  'cirugia', 'surgery', 'injerto', 'transplante', 'laser',
  'reforma integral', 'obra nueva', 'promocion', 'chalet', 'villa', 'penthouse',
  'wedding', 'boda', 'evento corporativo', 'charter', 'private tour',
  'tratamiento', 'financiacion', 'presupuesto', 'consultoria',
];

/**
 * How commercially attractive this business is to a website/design agency.
 *
 * The category is the dominant term because it determines the realistic project
 * budget. Scale and service mix adjust it, and a low-confidence classification
 * pulls the score back toward the neutral baseline rather than trusting a guess.
 */
export function scoreCommercialValue(input: CommercialValueInput): ComponentScore {
  const reasons: ScoreReason[] = [];
  const category = CATEGORY_BY_KEY.get(input.categoryKey) ?? OTHER_CATEGORY;

  const base = category.commercialValue;

  // A shaky classification is blended toward the neutral baseline.
  const confidence = clamp(input.categoryConfidence, 0, 1);
  const neutral = OTHER_CATEGORY.commercialValue;
  const categoryScore = base * confidence + neutral * (1 - confidence);

  if (base >= 85) {
    reasons.push({
      code: 'high_value_category',
      label: `${category.label} is a high-value category: ${category.rationale.toLowerCase()}`,
      impact: 'positive',
      points: round(categoryScore * 0.8),
    });
  } else if (base >= 65) {
    reasons.push({
      code: 'solid_value_category',
      label: `${category.label} has solid commercial value: ${category.rationale.toLowerCase()}`,
      impact: 'positive',
      points: round(categoryScore * 0.8),
    });
  } else {
    reasons.push({
      code: 'low_value_category',
      label: `${category.label} is a lower-value category: ${category.rationale.toLowerCase()}`,
      impact: 'negative',
      points: round(categoryScore * 0.8 - 40),
    });
  }

  if (confidence < 0.5) {
    reasons.push({
      code: 'uncertain_category',
      label: 'Category could not be determined confidently from public data',
      impact: 'negative',
      points: -8,
    });
  }

  // --- Operational scale ---------------------------------------------------
  let scaleBonus = 0;
  const reviewCount = input.reviewCount ?? 0;
  if (reviewCount >= 500) {
    scaleBonus = 8;
    reasons.push({
      code: 'large_operation',
      label: 'Review volume indicates a large operation with budget for a premium build',
      impact: 'positive',
      points: scaleBonus,
    });
  } else if (reviewCount >= 150) {
    scaleBonus = 5;
    reasons.push({
      code: 'substantial_operation',
      label: 'Review volume indicates a substantial, well-trafficked business',
      impact: 'positive',
      points: scaleBonus,
    });
  }

  // --- Service mix ---------------------------------------------------------
  let serviceBonus = 0;
  const services = (input.detectedServices ?? []).map((s) => s.toLowerCase());
  const matched = HIGH_VALUE_SERVICE_TERMS.filter((term) =>
    services.some((service) => service.includes(term)),
  );
  if (matched.length > 0) {
    serviceBonus = Math.min(8, matched.length * 3);
    reasons.push({
      code: 'high_value_services',
      label: `Advertises high-value services (${matched.slice(0, 3).join(', ')})`,
      impact: 'positive',
      points: serviceBonus,
    });
  }

  let transactionalBonus = 0;
  if (input.hasTransactionalIntent) {
    transactionalBonus = 4;
    reasons.push({
      code: 'transactional_intent',
      label: 'Sells or takes bookings online, so website quality maps directly to revenue',
      impact: 'positive',
      points: transactionalBonus,
    });
  }

  const score = clamp(categoryScore + scaleBonus + serviceBonus + transactionalBonus);

  return {
    score: round(score),
    reasons,
    breakdown: {
      categoryBase: base,
      categoryAdjusted: round(categoryScore),
      scaleBonus,
      serviceBonus,
      transactionalBonus,
    },
  };
}
