import { ProductJson } from '../types/product';
import { VariationFieldJson } from '../types/variation';
import { OPTION_FIELD_TYPES } from './constants';

export function groupFieldsOf(product: ProductJson): VariationFieldJson[] {
  const fields = (product as { groupVariationFields?: VariationFieldJson[] })
    .groupVariationFields;
  return Array.isArray(fields) ? fields : [];
}

export function independentFieldsOf(product: ProductJson): VariationFieldJson[] {
  const fields = (product as { independentVariationFields?: VariationFieldJson[] })
    .independentVariationFields;
  return Array.isArray(fields) ? fields : [];
}

export function productHasGroups(product: ProductJson): boolean {
  return groupFieldsOf(product).length > 0;
}

/** One group field with selectable options — use OptionQuantityGrid (per-option qty). */
export function isOptionQuantityGridProduct(product: ProductJson): boolean {
  const groups = groupFieldsOf(product);
  if (groups.length !== 1) return false;
  const field = groups[0];
  if (field?.id === undefined) return false;
  const fieldType = Number(field.fieldType);
  if (!OPTION_FIELD_TYPES.has(fieldType) || fieldType === 6) return false;
  return (field.options || []).some((o) => o?.id !== undefined);
}
