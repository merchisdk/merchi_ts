import { JobJson } from '../types/job.js';
import { ProductJson } from '../types/product.js';
import { VariationFieldJson, VariationJson } from '../types/variation.js';
import { FieldSelection } from '../components/context.js';
import { OPTION_FIELD_TYPES } from './constants.js';
import {
  groupFieldsOf,
  independentFieldsOf,
  isOptionQuantityGridProduct,
  productHasGroups,
} from './product.js';

export interface GroupRow {
  quantity: number;
  selections: Record<number, FieldSelection>;
}

export interface ProductFormJobState {
  product: ProductJson;
  quantity: number;
  /** Independent (whole-order) field selections. */
  selections: Record<number, FieldSelection>;
  /** Multi-batch group rows when the product has 2+ group fields or non-grid group UX. */
  groups?: GroupRow[];
  /** Per-option quantities for single group-field grid products. */
  optionQuantities?: Record<number, number>;
}

export function selectionsToVariations(
  selections: Record<number, FieldSelection>,
): VariationJson[] {
  return Object.entries(selections).map(([fieldId, sel]) => {
    const variation: VariationJson = {
      variationField: { id: Number(fieldId) },
      value: sel.value,
    };
    if (sel.variationFiles?.length) {
      variation.variationFiles = sel.variationFiles.map((file) => ({
        id: file.id,
      }));
    }
    // Prefer explicit option rows (colour-extract colour/value edits).
    if (sel.selectedOptions?.length) {
      variation.selectedOptions = sel.selectedOptions;
    }
    return variation;
  });
}

/** Build the job JSON the API expects from provider/form state. */
export function buildProductFormJob(state: ProductFormJobState): JobJson {
  const { product, quantity, selections, groups, optionQuantities } = state;
  const independentVariations = selectionsToVariations(
    pickSelections(selections, independentFieldsOf(product)),
  );

  const job: JobJson = {
    product: { id: (product as { id?: number })?.id },
    variations: independentVariations,
  };

  if (!productHasGroups(product)) {
    return { ...job, quantity };
  }

  if (isOptionQuantityGridProduct(product) && optionQuantities) {
    const groupField = groupFieldsOf(product)[0];
    job.variationsGroups = (groupField.options || [])
      .filter((opt) => opt?.id !== undefined)
      .map((opt) => ({
        quantity: optionQuantities[opt.id as number] ?? 0,
        variations: [
          {
            variationField: { id: groupField.id as number },
            value: String(opt.id),
          },
        ],
      }))
      .filter((group) => group.quantity > 0);
    return job;
  }

  if (groups?.length) {
    job.variationsGroups = groups
      .filter((row) => row.quantity > 0)
      .map((row) => ({
        quantity: row.quantity,
        variations: selectionsToVariations(
          pickSelections(row.selections, groupFieldsOf(product)),
        ),
      }));
  }

  return job;
}

function pickSelections(
  selections: Record<number, FieldSelection>,
  fields: { id?: number }[],
): Record<number, FieldSelection> {
  const ids = new Set(
    fields.map((f) => f.id).filter((id): id is number => id !== undefined),
  );
  const out: Record<number, FieldSelection> = {};
  for (const [key, sel] of Object.entries(selections)) {
    const id = Number(key);
    if (ids.has(id)) out[id] = sel;
  }
  return out;
}

function fieldIdOf(variation: VariationJson): number | undefined {
  const field = variation.variationField;
  if (typeof field === 'number') return field;
  return field?.id;
}

function selectionFromVariation(
  variation: VariationJson,
  field?: VariationFieldJson,
): FieldSelection {
  const value = variation.value != null ? String(variation.value) : '';
  const selectedOptions = variation.selectedOptions || [];
  const fromOptions = selectedOptions
    .map((o) => o.id)
    .filter((id): id is number => id !== undefined);
  const variationFiles = (variation.variationFiles || [])
    .filter((file) => file?.id)
    .map((file) => ({ id: file.id }));
  if (fromOptions.length) {
    return {
      value: value || fromOptions.join(','),
      selectedOptionIds: fromOptions,
      selectedOptions,
      variationFiles: variationFiles.length ? variationFiles : undefined,
    };
  }
  if (field && OPTION_FIELD_TYPES.has(Number(field.fieldType)) && value) {
    const ids = value
      .split(',')
      .map((part) => parseInt(part.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    return {
      value,
      selectedOptionIds: ids,
      variationFiles: variationFiles.length ? variationFiles : undefined,
    };
  }
  return {
    value,
    selectedOptionIds: [],
    variationFiles: variationFiles.length ? variationFiles : undefined,
  };
}

function variationsToSelections(
  variations: VariationJson[] | undefined,
  fields: VariationFieldJson[],
): Record<number, FieldSelection> {
  const byId = new Map(
    fields
      .filter((f): f is VariationFieldJson & { id: number } => f.id !== undefined)
      .map((f) => [f.id, f]),
  );
  const out: Record<number, FieldSelection> = {};
  for (const variation of variations || []) {
    const id = fieldIdOf(variation);
    if (id === undefined) continue;
    out[id] = selectionFromVariation(variation, byId.get(id));
  }
  return out;
}

export interface HydratedProductFormState {
  quantity: number;
  selections: Record<number, FieldSelection>;
  groups: GroupRow[];
  optionQuantities: Record<number, number>;
}

/** Reverse of buildProductFormJob — hydrate provider state from a cart item / job. */
export function jobToFormState(
  product: ProductJson,
  job?: JobJson | null,
): HydratedProductFormState {
  const minQty = Number(product.minOrderQuantity ?? product.minimum) || 1;
  const independentFields = independentFieldsOf(product);
  const groupFields = groupFieldsOf(product);
  const selections = {
    ...initialDefaultSelections(independentFields),
    ...variationsToSelections(job?.variations, independentFields),
  };

  if (!productHasGroups(product)) {
    return {
      quantity: Number(job?.quantity) > 0 ? Number(job?.quantity) : minQty,
      selections,
      groups: [],
      optionQuantities: {},
    };
  }

  if (isOptionQuantityGridProduct(product)) {
    const field = groupFields[0];
    const optionQuantities: Record<number, number> = {};
    for (const opt of field?.options || []) {
      if (opt?.id !== undefined) optionQuantities[opt.id] = 0;
    }
    for (const group of job?.variationsGroups || []) {
      const variation = group.variations?.[0];
      const optId =
        variation?.value != null ? Number(variation.value) : undefined;
      if (optId !== undefined && !Number.isNaN(optId)) {
        optionQuantities[optId] = Number(group.quantity) || 0;
      }
    }
    return {
      quantity: minQty,
      selections,
      groups: [],
      optionQuantities,
    };
  }

  const groups = (job?.variationsGroups || [])
    .map((group) => ({
      quantity: Number(group.quantity) > 0 ? Number(group.quantity) : minQty,
      selections: {
        ...initialDefaultSelections(groupFields),
        ...variationsToSelections(group.variations, groupFields),
      },
    }))
    .filter((row) => row.quantity > 0);

  return {
    quantity: minQty,
    selections,
    groups: groups.length
      ? groups
      : [{ quantity: minQty, selections: initialDefaultSelections(groupFields) }],
    optionQuantities: {},
  };
}

function initialDefaultSelections(
  fields: VariationFieldJson[],
): Record<number, FieldSelection> {
  const out: Record<number, FieldSelection> = {};
  for (const f of fields) {
    if (f?.id === undefined) continue;
    if (OPTION_FIELD_TYPES.has(Number(f.fieldType)) && f.fieldType !== 6) {
      const opt = (f.options || []).find(
        (o) => o?.isVisible !== false && o?.available !== false,
      );
      if (opt?.id !== undefined) {
        out[f.id] = { value: String(opt.id), selectedOptionIds: [opt.id] };
      }
    }
  }
  return out;
}
