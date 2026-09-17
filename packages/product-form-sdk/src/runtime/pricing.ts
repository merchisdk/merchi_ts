import { Merchi } from 'merchi_sdk_ts';
import { JobJson } from '../types/job';
import { ProductJson } from '../types/product';
import { serializeJob } from '../helpers/serialize';
import { clientQuote, PricingRules } from './clientPricing';

export interface Pricing {
  /** Request a quote for the given job; resolves to the job json with pricing
   * fields (cost, totalCost, currency, ...) populated. Uses client-side
   * calculation when the product supports it, else a server quote. */
  getQuote: (job: JobJson) => Promise<JobJson>;
  /** Eagerly fetch + cache the client-side pricing rules (no-op unless the
   * product has clientSideCalculation). Safe to call fire-and-forget on mount so
   * the first quote is instant. */
  warm: () => void;
}

export interface PricingOptions {
  /** The product being quoted. Its `id` is used as the default product on the
   * job, and `clientSideCalculation` enables the local pricing path. */
  product?: ProductJson;
  /** Pre-fetched pricing rules; if omitted and client-side is enabled, the rules
   * are lazily fetched from `products/{id}/pricing-rules/`. */
  pricingRules?: unknown;
}

/** Build a pricing helper bound to a backend api url.
 *
 * When `product.clientSideCalculation` is set, getQuote computes the quote
 * locally via merchi_sdk_ts's pricing engine (mirroring merchi_product_form),
 * fetching the product's pricing-rules bundle once and caching it. It falls back
 * to a server quote (`Job.getQuote` → /specialised-order-estimate/) when
 * client-side is disabled, the rules can't be loaded, or the rules are
 * unsupported for the given selections. */
export function createPricing(apiUrl: string, options: PricingOptions = {}): Pricing {
  const { product, pricingRules: providedRules } = options;
  const defaultProductId = product && product.id;
  const merchi = new Merchi(undefined, undefined, undefined, undefined, apiUrl);

  let rulesCache: PricingRules | null = (providedRules as PricingRules) || null;
  let rulesFetchAttempted = false;

  async function getRules(): Promise<PricingRules | null> {
    if (rulesCache) return rulesCache;
    if (rulesFetchAttempted || !product || product.id === undefined) return null;
    rulesFetchAttempted = true;
    try {
      const base = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
      const res = await fetch(`${base}products/${product.id}/pricing-rules/`, {
        credentials: 'omit',
      });
      if (!res.ok) return null;
      rulesCache = (await res.json()) as PricingRules;
      return rulesCache;
    } catch {
      return null;
    }
  }

  async function serverQuote(job: JobJson): Promise<JobJson> {
    const withProduct: JobJson =
      job.product && job.product.id !== undefined
        ? job
        : { ...job, product: { id: defaultProductId } };
    const cleaned = serializeJob(withProduct);
    const merchiJob = new merchi.Job();
    merchiJob.fromJson(cleaned as Record<string, unknown>, {
      makeDirty: false,
      arrayValueStrict: false,
    });
    const quoted = await merchiJob.getQuote();
    return quoted.toJson() as JobJson;
  }

  return {
    warm: () => {
      if (product && product.clientSideCalculation) {
        // fire-and-forget: populate the cache so the first quote is instant.
        void getRules();
      }
    },
    getQuote: async (job: JobJson): Promise<JobJson> => {
      if (product && product.clientSideCalculation) {
        const rules = await getRules();
        if (rules) {
          const local = clientQuote(rules, job);
          if (local) return local;
        }
      }
      return serverQuote(job);
    },
  };
}
