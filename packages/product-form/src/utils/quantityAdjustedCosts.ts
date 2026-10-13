import { FieldType } from './types';

/**
 * Quantity-adjusted once-off and per-unit costs for select options and field labels.
 *
 * The server sets these in Variations.generate_variation_option by pricing each
 * option with get_variation_cost([quantity]) and get_variation_unit_cost([quantity]).
 * One quantity means both restricted and unrestricted discounts use that quantity.
 * Independent fields use the job quantity (the sum of the groups). A group field
 * uses that group's quantity.
 *
 * The discount step matches @merchi/sdk pricing applyDiscount / variationUnitCosts.
 */

interface DiscountTier {
  lowerLimit: number;
  amount: number;
}

interface DiscountGroup {
  discounts?: DiscountTier[];
}

interface CostSource {
  variationCost?: number;
  variationUnitCost?: number;
  variationCostDiscountGroup?: DiscountGroup | null;
  variationUnitCostDiscountGroup?: DiscountGroup | null;
}

function roundHalfEven(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, dp);
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const EPS = 1e-9;
  let rounded: number;
  if (Math.abs(diff - 0.5) < EPS) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }
  return rounded / factor;
}

function applyDiscount(
  price: number,
  qty: number,
  group: DiscountGroup | null | undefined
): number {
  const tiers = group?.discounts || [];
  if (!tiers.length) return roundHalfEven(price, 3);
  const applicable = tiers
    .filter((tier) => tier.lowerLimit <= qty)
    .sort((a, b) => b.lowerLimit - a.lowerLimit);
  const amount = applicable.length ? applicable[0].amount : 0;
  return roundHalfEven(price * (1 - amount / 100), 3);
}

export function costsAtQuantity(
  source: CostSource,
  quantity: number
): { onceOffCost: number; unitCost: number } {
  const qty = Number(quantity);
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const setupBase = Number(source.variationCost);
  const unitBase = Number(source.variationUnitCost);
  const onceOffBase = Number.isFinite(setupBase) ? setupBase : 0;
  const unitStart = Number.isFinite(unitBase) ? unitBase : 0;
  const onceOffCost = source.variationCostDiscountGroup
    ? applyDiscount(onceOffBase, safeQty, source.variationCostDiscountGroup)
    : roundHalfEven(onceOffBase, 3);
  const unitCost = source.variationUnitCostDiscountGroup
    ? roundHalfEven(
        applyDiscount(unitStart, safeQty, source.variationUnitCostDiscountGroup),
        3
      )
    : roundHalfEven(unitStart, 3);
  return { onceOffCost, unitCost };
}

function sameId(left: unknown, right: unknown): boolean {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && a === b;
}

function findPricingField(rules: any, fieldId: unknown) {
  const fields = [...(rules?.fields || []), ...(rules?.groupFields || [])];
  return fields.find(
    (field: any) => sameId(field?.id, fieldId) || sameId(field?.originalId, fieldId)
  );
}

function findPricingOption(field: any, optionId: unknown) {
  return (field?.options || []).find(
    (option: any) =>
      sameId(option?.id, optionId) || sameId(option?.originalId, optionId)
  );
}

export function groupIndexFromVariationName(name: string): number | null {
  const match = /^variationsGroups\[(\d+)\]/.exec(name || '');
  return match ? Number(match[1]) : null;
}

export function displayQuantity(options: {
  groupIndex: number | null;
  groupQuantity: unknown;
  groups?: Array<{ quantity?: unknown }> | null;
  jobQuantity: unknown;
  hasGroups: boolean;
}): number {
  const toQty = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  if (options.groupIndex != null) return toQty(options.groupQuantity);
  if (options.hasGroups) {
    return (options.groups || []).reduce(
      (sum, group) => sum + toQty(group?.quantity),
      0
    );
  }
  return toQty(options.jobQuantity);
}

/** Replace stale base rates on a variation with the costs for `quantity`. */
export function withQuantityAdjustedDisplayCosts(
  variation: any,
  rules: any,
  quantity: number
) {
  if (!rules || rules.unsupported || !variation) return variation;
  const field = findPricingField(rules, variation?.variationField?.id);
  if (!field) return variation;
  const fieldType = Number(field.fieldType ?? variation?.variationField?.fieldType);
  if (fieldType === FieldType.AREA) return variation;

  if (
    field.isSelectable &&
    Array.isArray(variation.selectableOptions) &&
    variation.selectableOptions.length
  ) {
    let changed = false;
    const selectableOptions = variation.selectableOptions.map((option: any) => {
      const pricingOption = findPricingOption(field, option?.optionId ?? option?.id);
      if (!pricingOption) return option;
      const costs = costsAtQuantity(pricingOption, quantity);
      if (
        Number(option.onceOffCost) === costs.onceOffCost &&
        Number(option.unitCost) === costs.unitCost
      ) {
        return option;
      }
      changed = true;
      return {
        ...option,
        onceOffCost: costs.onceOffCost,
        unitCost: costs.unitCost,
        currency: option.currency || rules.currency,
      };
    });
    return changed ? { ...variation, selectableOptions } : variation;
  }

  if (field.isSelectable) return variation;
  const costs = costsAtQuantity(field, quantity);
  if (
    Number(variation.onceOffCost) === costs.onceOffCost &&
    Number(variation.unitCost) === costs.unitCost
  ) {
    return variation;
  }
  return {
    ...variation,
    onceOffCost: costs.onceOffCost,
    unitCost: costs.unitCost,
    currency: variation.currency || rules.currency,
  };
}
