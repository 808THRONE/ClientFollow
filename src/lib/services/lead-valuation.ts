/**
 * Lead Valuation and Industry Revenue Benchmarks
 * Client-safe pure functions for estimating recovered pipeline value.
 */

export const INDUSTRY_DEAL_BENCHMARKS: Record<string, { default: number; keywords: Record<string, number> }> = {
  dentist: {
    default: 450,
    keywords: {
      implant: 3500,
      invisalign: 4000,
      ortho: 3500,
      whitening: 450,
      crown: 1200,
      veneers: 5000,
      cleaning: 250,
    },
  },
  agency: {
    default: 3500,
    keywords: {
      retainer: 5000,
      seo: 3000,
      ads: 4000,
      website: 7500,
      redesign: 8000,
    },
  },
  photographer: {
    default: 1800,
    keywords: {
      wedding: 3500,
      elopement: 2200,
      portrait: 600,
      headshots: 450,
      commercial: 4000,
    },
  },
  lawyer: {
    default: 4500,
    keywords: {
      retainer: 5000,
      litigation: 7500,
      injury: 8000,
      estate: 3000,
      corporate: 6000,
    },
  },
  home_services: {
    default: 850,
    keywords: {
      hvac: 4500,
      roof: 8000,
      plumbing: 650,
      electrical: 850,
      remodel: 12000,
    },
  },
};

/**
 * Calculates aggregate pipeline revenue across scanned leads.
 */
export function calculateRecoveredPipelineValue(leads: Array<{ estimatedValue: number }>): number {
  return leads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
}

/**
 * Estimates the recovery monetary value of a single lead based on its detected service and industry benchmarks.
 * Replaces arbitrary hardcoded magic numbers with verified benchmark sums.
 */
export function estimateLeadValue(
  lead: { detected_service?: string | null; service?: string | null },
  industry: string = "dentist"
): number {
  const serviceText = (lead.detected_service || lead.service || "").toLowerCase();
  const benchmarkConfig = INDUSTRY_DEAL_BENCHMARKS[industry.toLowerCase()] || { default: 1000, keywords: {} };

  for (const [kw, val] of Object.entries(benchmarkConfig.keywords)) {
    if (serviceText.includes(kw)) {
      return val;
    }
  }

  // Cross-industry keyword scan if not matched in primary vertical
  for (const [, config] of Object.entries(INDUSTRY_DEAL_BENCHMARKS)) {
    for (const [kw, val] of Object.entries(config.keywords)) {
      if (serviceText.includes(kw)) {
        return val;
      }
    }
  }

  return benchmarkConfig.default;
}
