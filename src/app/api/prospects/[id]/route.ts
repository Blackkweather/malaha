import { CATEGORY_BY_KEY, OTHER_CATEGORY } from '@/lib/normalize/category';
import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { uuidSchema } from '@/lib/http/validate';
import { getBusinessDetail } from '@/lib/repo/businesses';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/prospects/{id}
 *
 * The prospect view: scores with their explanations, the website audit, the
 * public reputation signals and any AI analyses already produced.
 */
export const GET = withGuard<[Params]>('read', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  const detail = await getBusinessDetail(parsed.data);
  if (!detail) return notFound('Prospect not found');

  const category = CATEGORY_BY_KEY.get(detail.business.category) ?? OTHER_CATEGORY;
  const bestReview = detail.reviews[0] ?? null;
  const reasons = (detail.score?.reasons ?? {}) as Record<string, unknown>;

  return ok({
    id: detail.business.id,
    name: detail.business.name,
    category: { key: detail.business.category, label: category.label },
    location: {
      address: detail.business.address,
      city: detail.business.city,
      municipality: detail.business.municipality,
      postalCode: detail.business.postal_code,
      province: detail.business.province,
      country: detail.business.country,
      latitude: detail.business.latitude,
      longitude: detail.business.longitude,
      confidence: detail.business.location_confidence,
      inScope: detail.business.in_scope,
      reason: detail.business.scope_reason,
      evidence: detail.business.location_evidence,
    },
    contacts: {
      phone: detail.business.primary_phone,
      email: detail.business.primary_email,
      website: detail.business.website_url,
      all: detail.contacts,
    },
    reputation: {
      rating: bestReview?.rating ?? null,
      reviewCount: bestReview?.review_count ?? null,
      signals: detail.reviews,
    },
    socialProfiles: detail.socials,
    scores: detail.score
      ? {
          businessQuality: detail.score.business_quality,
          commercialValue: detail.score.commercial_value,
          digitalOpportunity: detail.score.digital_opportunity,
          opportunity: detail.score.opportunity,
          weights: detail.score.weights,
          breakdown: detail.score.breakdown,
          reasons: reasons.reasons ?? [],
          topReasons: reasons.top ?? [],
          qualified: reasons.qualified ?? false,
          disqualification: reasons.disqualification ?? [],
          websiteVerdict: reasons.websiteVerdict ?? null,
          computedAt: detail.score.computed_at,
        }
      : null,
    website: detail.website,
    audit: detail.audit,
    issues: detail.issues,
    pages: detail.pages,
    analyses: detail.analyses,
    demos: detail.demos,
    crm: detail.crm,
    sources: detail.sources,
    evidenceScore: detail.business.evidence_score,
  });
});
