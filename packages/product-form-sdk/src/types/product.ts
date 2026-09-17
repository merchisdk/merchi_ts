import { VariationFieldJson } from './variation';

/** The product JSON a custom form receives. Fields are optional because the
 * shape varies by product type; the commonly-used fields are documented here. */
export interface ProductJson {
  id?: number;
  name?: string;
  productType?: number;
  currency?: string;
  unitPrice?: number;
  bestPrice?: number;
  minimum?: number;
  minOrderQuantity?: number;
  groupsFirst?: boolean;
  needsInventory?: boolean;
  allowAddToCart?: boolean;
  allowPaymentUpfront?: boolean;
  allowQuotation?: boolean;
  clientSideCalculation?: boolean;
  defaultJob?: Record<string, unknown>;
  independentVariationFields?: VariationFieldJson[];
  groupVariationFields?: VariationFieldJson[];
  images?: Array<{ id?: string; viewUrl?: string }>;
  domain?: { id?: number; domain?: string };
}
