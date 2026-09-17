import { pricing } from 'merchi_sdk_ts';
import { JobJson } from '../types/job';
import { VariationJson } from '../types/variation';

// These pricing shapes mirror merchi_sdk_ts's pricing module. They are declared
// locally because the linked SDK build ships no type declarations. The logic
// below only reads plain object fields (ported from merchi_product_form's
// toSelections) and does not depend on SDK runtime types.
interface FieldSelection {
  selectedOptionIds?: number[];
  value?: string | number | null;
}

interface Selections {
  quantity?: number;
  fieldValues: Record<number, FieldSelection>;
  groups?: { quantity: number; fieldValues: Record<number, FieldSelection> }[];
}

interface PricingField {
  id: number;
  isSelectable: boolean;
}

export interface PricingRules {
  fields: PricingField[];
  groupFields: PricingField[];
  hasGroups: boolean;
}

function parseOptionIds(value: unknown): number[] {
  if (value === undefined || value === null || value === '') return [];
  return String(value)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function buildFieldValues(
  variations: VariationJson[],
  selectableByField: Record<number, boolean>,
): Record<number, FieldSelection> {
  const out: Record<number, FieldSelection> = {};
  for (const variation of variations || []) {
    const field = variation && variation.variationField;
    const fieldId =
      typeof field === 'object' && field !== null ? field.id : field;
    if (fieldId === undefined || fieldId === null) continue;
    if (selectableByField[fieldId]) {
      out[fieldId] = { selectedOptionIds: parseOptionIds(variation.value) };
    } else {
      out[fieldId] = { value: variation.value ?? null };
    }
  }
  return out;
}

/** Convert a job's form values into the `Selections` shape estimateQuote needs.
 * Ported from merchi_product_form/src/utils/selections.ts so a custom form gets
 * identical client-side pricing behaviour. */
export function toSelections(job: JobJson, rules: PricingRules): Selections {
  const selectableByField: Record<number, boolean> = {};
  for (const f of [...(rules.fields || []), ...(rules.groupFields || [])]) {
    selectableByField[f.id] = f.isSelectable;
  }
  if (rules.hasGroups) {
    return {
      fieldValues: buildFieldValues(job.variations || [], selectableByField),
      groups: (job.variationsGroups || []).map((g) => ({
        quantity: g.quantity || 0,
        fieldValues: buildFieldValues(g.variations || [], selectableByField),
      })),
    };
  }
  return {
    quantity: job.quantity || 0,
    fieldValues: buildFieldValues(job.variations || [], selectableByField),
  };
}

/** Compute a quote entirely client-side from pricing rules and merge the pricing
 * fields into the job. Returns the priced job, or null when client-side pricing
 * is unsupported for these rules (caller then falls back to a server quote). */
export function clientQuote(rules: PricingRules, job: JobJson): JobJson | null {
  const result = pricing.estimateQuote(rules, toSelections(job, rules));
  if (!result || result.unsupported) return null;
  const next: JobJson = {
    ...job,
    cost: result.cost,
    costPerUnit: result.costPerUnit,
    taxAmount: result.taxAmount,
    totalCost: result.totalCost,
    currency: result.currency,
  };
  if (Array.isArray(job.variationsGroups) && Array.isArray(result.groupCosts)) {
    next.variationsGroups = job.variationsGroups.map((g, i) => ({
      ...g,
      groupCost: result.groupCosts![i],
    }));
  }
  return next;
}
