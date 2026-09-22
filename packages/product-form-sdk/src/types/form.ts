import { ComponentType } from 'react';
import { ProductJson } from './product.js';
import { JobJson } from './job.js';
import { Pricing } from '../runtime/pricing.js';
import { Actions, Helpers } from '../runtime/runtime.js';
import type { FooterAction } from '../components/footerActions.js';

/** Props every custom product form receives. This is the ONLY surface a form
 * may rely on; the static-analysis gate (Plan 3) rejects anything else. */
export interface ProductFormProps {
  /** The product being ordered. */
  product: ProductJson;
  /** Request a quote for an arbitrary job (for live pricing as the user edits). */
  pricing: Pricing;
  /** Submit the order. The form builds + serializes the job, then calls one of
   * these. Actions not enabled for the product/embed are undefined. */
  actions: Actions;
  /** Stateless helpers: serialize a job, filter qty>0 groups, format currency,
   * build merchi urls. */
  helpers: Helpers;
}

/** A custom product form is a default-exported React component of this type. */
export type ProductFormComponent = ComponentType<ProductFormProps> & {
  /** Optional host-footer config (Get quote / Buy now / Add to cart). */
  footerActions?: FooterAction[];
};

export type { JobJson, ProductJson };
