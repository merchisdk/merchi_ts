import { VariationJson, VariationsGroupJson } from './variation';

/** Pricing fields populated on a job by a quote (server or client-side). */
export interface QuoteFields {
  cost?: number;
  costPerUnit?: number;
  taxAmount?: number;
  totalCost?: number;
  currency?: string;
}

/** The job (order) a form builds, serializes, and submits. Mirrors the JSON
 * wire format used by merchi_product_form: top-level variations for
 * whole-order fields, variationsGroups for grouped line items. */
export interface JobJson extends QuoteFields {
  quantity?: number;
  variations?: VariationJson[];
  variationsGroups?: VariationsGroupJson[];
  product?: { id?: number };
  client?: { id?: number };
  tags?: Array<{ id: number }>;
}
