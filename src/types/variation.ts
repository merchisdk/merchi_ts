/** A selectable option within a variation field (e.g. a colour swatch). */
export interface OptionJson {
  id?: number;
  value?: string;
  colour?: string;
  isExtracted?: boolean;
  isVisible?: boolean;
  available?: boolean;
  linkedFile?: { id?: string; viewUrl?: string };
}

/** A single variation field definition on a product. */
export interface VariationFieldJson {
  id?: number;
  name?: string;
  fieldType?: number;
  required?: boolean;
  options?: OptionJson[];
  maxColours?: number;
  simplifyColours?: boolean;
  colourVariationCost?: number;
  colourVariationUnitCost?: number;
}

/** A variation selection within a job (one chosen field value). */
export interface VariationJson {
  id?: number;
  variationField?: number | VariationFieldJson;
  value?: string | number | null;
  selectedOptions?: OptionJson[];
  variationFiles?: Array<{ id?: string }>;
  isVisible?: boolean;
}

/** A grouped line item: a set of variations with its own quantity. */
export interface VariationsGroupJson {
  id?: number;
  quantity?: number;
  groupCost?: number | null;
  variations?: VariationJson[];
  inventoryCount?: number;
  inventorySufficient?: boolean;
}
