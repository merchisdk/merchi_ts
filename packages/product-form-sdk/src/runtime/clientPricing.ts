import { pricing } from '@merchi/sdk';
import { JobJson } from '../types/job.js';
import { VariationJson } from '../types/variation.js';

// These pricing shapes mirror @merchi/sdk's pricing module. They are declared
// locally because the linked SDK build ships no type declarations. The logic
// below only reads plain object fields (ported from @merchi/product-form's
// toSelections) and does not depend on SDK runtime types.
interface FieldSelection {
  selectedOptionIds?: number[];
  value?: string | number | null;
  colourCount?: number;
  coverage?: number;
  hasFiles?: boolean;
}

interface Selections {
  quantity?: number;
  fieldValues: Record<number, FieldSelection>;
  groups?: { quantity: number; fieldValues: Record<number, FieldSelection> }[];
}

interface PricingField {
  id: number;
  isSelectable: boolean;
  fieldType?: number;
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

function embroiderySelection(variation: VariationJson): FieldSelection {
  let parsed: { colours?: unknown; coverage?: unknown } | null = null;
  try {
    parsed = variation?.value ? JSON.parse(String(variation.value)) : null;
  } catch {
    parsed = null;
  }
  const colours = Array.isArray(parsed?.colours) ? parsed.colours : [];
  const files = variation?.variationFiles || [];
  return {
    value: variation?.value ?? null,
    colourCount: colours.length,
    coverage: Number(parsed?.coverage) || undefined,
    hasFiles: files.some((file) => Boolean(file && file.id)),
  };
}

function buildFieldValues(
  variations: VariationJson[],
  metaByField: Record<number, PricingField>,
): Record<number, FieldSelection> {
  const out: Record<number, FieldSelection> = {};
  for (const variation of variations || []) {
    const field = variation && variation.variationField;
    const fieldId =
      typeof field === 'object' && field !== null ? field.id : field;
    if (fieldId === undefined || fieldId === null) continue;
    const meta = metaByField[fieldId];
    if (Number(meta?.fieldType) === 16) {
      out[fieldId] = embroiderySelection(variation);
      continue;
    }
    if (meta?.isSelectable) {
      out[fieldId] = { selectedOptionIds: parseOptionIds(variation.value) };
    } else {
      out[fieldId] = { value: variation.value ?? null };
    }
  }
  return out;
}

/** Convert a job's form values into the `Selections` shape estimateQuote needs.
 * Ported from @merchi/product-form's selections helper so a custom form gets
 * identical client-side pricing behaviour. */
function fieldMeta(rules: PricingRules): Record<number, PricingField> {
  const meta: Record<number, PricingField> = {};
  for (const field of [...(rules.fields || []), ...(rules.groupFields || [])]) {
    meta[field.id] = field;
  }
  return meta;
}

export function toSelections(job: JobJson, rules: PricingRules): Selections {
  const meta = fieldMeta(rules);
  if (rules.hasGroups) {
    return {
      fieldValues: buildFieldValues(job.variations || [], meta),
      groups: (job.variationsGroups || []).map((g) => ({
        quantity: g.quantity || 0,
        fieldValues: buildFieldValues(g.variations || [], meta),
      })),
    };
  }
  return {
    quantity: job.quantity || 0,
    fieldValues: buildFieldValues(job.variations || [], meta),
  };
}

/** Fill coverage and measured size before the local quote. Stitch price needs
 * those figures, and they come from the artwork rather than from arithmetic. */
export async function withEmbroideryEstimates(
  apiUrl: string,
  rules: PricingRules,
  job: JobJson,
): Promise<JobJson> {
  const embroideryIds = new Set(
    [...(rules.fields || []), ...(rules.groupFields || [])]
      .filter((field) => Number(field.fieldType) === 16)
      .map((field) => field.id),
  );
  if (!embroideryIds.size) return job;
  const base = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;

  async function fill(variation: VariationJson): Promise<VariationJson> {
    const field = variation && variation.variationField;
    const fieldId = typeof field === 'object' && field !== null ? field.id : field;
    if (fieldId == null || !embroideryIds.has(Number(fieldId))) return variation;
    let parsed: Record<string, any> | null = null;
    try {
      parsed = variation.value ? JSON.parse(String(variation.value)) : null;
    } catch {
      parsed = null;
    }
    const saved = parsed && typeof parsed === 'object' ? parsed : {};
    const fileId = (variation.variationFiles || [])[0]?.id;
    const colours = Array.isArray(saved.colours) ? saved.colours : [];
    if (
      saved.coverage
      && saved.widthMm
      && saved.heightMm
      && (String(saved.text || '').trim() || fileId || colours.length)
    ) {
      return variation;
    }
    if (!fileId && !String(saved.text || '').trim() && !(saved.widthMm && saved.heightMm)) {
      return variation;
    }
    try {
      const response = await fetch(
        `${base}variation-fields/${fieldId}/estimate-embroidery/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: saved.text || '',
            widthMm: saved.widthMm,
            heightMm: saved.heightMm,
            colours: saved.colours,
            fileId,
          }),
        },
      );
      if (!response.ok) return variation;
      const data = await response.json();
      const merged = {
        ...saved,
        colours: data.colours || saved.colours,
        coverage: data.coverage,
        pixelWidth: data.pixelWidth || saved.pixelWidth,
        pixelHeight: data.pixelHeight || saved.pixelHeight,
        widthMm: saved.widthMm || data.widthMm || data.measuredWidthMm,
        heightMm: saved.heightMm || data.heightMm || data.measuredHeightMm,
      };
      return { ...variation, value: JSON.stringify(merged) };
    } catch {
      return variation;
    }
  }

  const variations = await Promise.all((job.variations || []).map(fill));
  const variationsGroups = job.variationsGroups
    ? await Promise.all(
      job.variationsGroups.map(async (group) => ({
        ...group,
        variations: await Promise.all((group.variations || []).map(fill)),
      })),
    )
    : job.variationsGroups;
  return { ...job, variations, variationsGroups };
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
