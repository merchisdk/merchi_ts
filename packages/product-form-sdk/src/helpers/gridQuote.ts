import { JobJson } from '../types/job';
import { VariationsGroupJson, VariationJson } from '../types/variation';

function variationFieldId(
  variationField: VariationJson['variationField'],
): number | undefined {
  if (variationField === undefined || variationField === null) return undefined;
  if (typeof variationField === 'number') return variationField;
  if (typeof variationField === 'object') return variationField.id;
  return undefined;
}

/** Find the quoted variationsGroup row for a grid option (single group field). */
export function quoteGroupForOption(
  quote: JobJson | null | undefined,
  groupFieldId: number,
  optionId: number,
): VariationsGroupJson | undefined {
  if (!quote?.variationsGroups?.length) return undefined;
  const optionKey = String(optionId);
  return quote.variationsGroups.find((group) =>
    (group.variations || []).some((variation) => {
      const fieldId = variationFieldId(variation.variationField);
      return fieldId === groupFieldId && String(variation.value ?? '') === optionKey;
    }),
  );
}

export interface InventoryStatusText {
  tone: 'ok' | 'warn' | 'error';
  label: string;
}

/** Human-readable inventory pill text (mirrors merchi_product_form). */
export function inventoryStatusText(
  group: VariationsGroupJson | undefined,
  needsInventory: boolean,
): InventoryStatusText | null {
  if (!needsInventory || !group) return null;
  if (group.inventorySufficient !== false) {
    return { tone: 'ok', label: 'In stock' };
  }
  const count = group.inventoryCount ?? 0;
  if (count > 0) {
    return { tone: 'warn', label: `Insufficient stock (${count} in stock)` };
  }
  return { tone: 'error', label: 'Out of stock' };
}
