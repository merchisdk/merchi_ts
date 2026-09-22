import * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ProductJson } from '../types/product.js';
import { JobJson } from '../types/job.js';
import { VariationFieldJson } from '../types/variation.js';
import { Pricing } from '../runtime/pricing.js';
import { Actions, Helpers } from '../runtime/runtime.js';
import {
  buildProductFormJob,
  GroupRow,
  jobToFormState,
} from '../helpers/buildJob.js';
import { OPTION_FIELD_TYPES } from '../helpers/constants.js';
import {
  groupFieldsOf,
  independentFieldsOf,
  isOptionQuantityGridProduct,
  productHasGroups,
} from '../helpers/product.js';

import {
  FooterAction,
  normalizeFooterActions,
  type SubmitAction,
} from './footerActions.js';

export { OPTION_FIELD_TYPES };
export type { FooterAction, SubmitAction } from './footerActions.js';

export interface FieldSelection {
  /** Comma-separated option ids (selectable fields) or the raw text/number. */
  value: string;
  selectedOptionIds: number[];
  /** Uploaded files for file / colour-extract fields. */
  variationFiles?: Array<{ id?: string; name?: string; viewUrl?: string }>;
  /** Selected option rows (used by colour-extract for colour/value edits). */
  selectedOptions?: Array<{
    id?: number;
    value?: string;
    colour?: string;
    isExtracted?: boolean;
  }>;
}

export interface ProductFormContextValue {
  product: ProductJson;
  hasGroups: boolean;
  /** True when one group field has options — prefer OptionQuantityGrid. */
  optionQuantityGrid: boolean;
  groupFields: VariationFieldJson[];
  independentFields: VariationFieldJson[];
  quantity: number;
  setQuantity: (n: number) => void;
  /** Selections for independent (whole-order) variation fields. */
  selections: Record<number, FieldSelection>;
  setFieldSelection: (fieldId: number, sel: FieldSelection) => void;
  /** Per-batch group rows (multi group-field products). */
  groups: GroupRow[];
  setGroupQuantity: (index: number, quantity: number) => void;
  setGroupFieldSelection: (
    groupIndex: number,
    fieldId: number,
    sel: FieldSelection,
  ) => void;
  addGroup: () => void;
  removeGroup: (index: number) => void;
  /** Per-option quantities for single group-field grid products. */
  optionQuantities: Record<number, number>;
  setOptionQuantity: (optionId: number, quantity: number) => void;
  quote: JobJson | null;
  loading: boolean;
  currency?: string;
  helpers: Helpers;
  /** Which submit actions the host enabled. */
  available: { addToCart: boolean; buyNow: boolean; getQuote: boolean };
  /** Optional overrides for footer button labels. */
  actionLabels: Partial<Record<SubmitAction, string>>;
  /** Form-configured footer buttons; null uses the default Get quote / Buy now / Add to cart set. */
  footerActions: FooterAction[] | null;
  /** Replace or clear the host footer buttons from form source. */
  setFooterActions: (actions: FooterAction[] | null) => void;
  /** Build the current job and invoke the given host action. */
  submit: (action: SubmitAction) => void;
}

const Ctx = createContext<ProductFormContextValue | null>(null);

export function useProductForm(): ProductFormContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      'Merchi form components must be rendered inside <ProductFormProvider>.',
    );
  }
  return ctx;
}

export interface ProductFormProviderProps {
  product: ProductJson;
  pricing: Pricing;
  actions: Actions;
  helpers: Helpers;
  children: React.ReactNode;
  /** Optional cart-item / quote job used to hydrate quantity and selections. */
  initialJob?: JobJson | null;
  /** Override footer button labels (e.g. cart edit: addToCart → "Save"). */
  actionLabels?: Partial<Record<SubmitAction, string>>;
  /** Restrict / relabel host footer buttons. Host labels still win when set. */
  footerActions?: FooterAction[] | null;
}

function initialSelectionsForFields(
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

function initialGroupRow(product: ProductJson): GroupRow {
  const minQty = Number(product.minOrderQuantity ?? product.minimum) || 1;
  return {
    quantity: minQty,
    selections: initialSelectionsForFields(groupFieldsOf(product)),
  };
}

export function ProductFormProvider({
  product,
  pricing,
  actions,
  helpers,
  children,
  initialJob = null,
  actionLabels,
  footerActions: footerActionsProp = null,
}: ProductFormProviderProps) {
  const hasGroups = productHasGroups(product);
  const optionQuantityGrid = hasGroups && isOptionQuantityGridProduct(product);
  const groupFields = groupFieldsOf(product);
  const independentFields = independentFieldsOf(product);
  const minQty = Number(product.minOrderQuantity ?? product.minimum) || 1;
  const hydrated = jobToFormState(product, initialJob);

  const [quantity, setQuantity] = useState<number>(
    () => (initialJob ? hydrated.quantity : minQty),
  );
  const [selections, setSelections] = useState<Record<number, FieldSelection>>(
    () =>
      initialJob
        ? hydrated.selections
        : initialSelectionsForFields(independentFields),
  );
  const [groups, setGroups] = useState<GroupRow[]>(() =>
    initialJob
      ? hydrated.groups
      : hasGroups && !optionQuantityGrid
        ? [initialGroupRow(product)]
        : [],
  );
  const [optionQuantities, setOptionQuantities] = useState<Record<number, number>>(
    () => {
      if (initialJob) return hydrated.optionQuantities;
      if (!optionQuantityGrid) return {};
      const field = groupFields[0];
      const out: Record<number, number> = {};
      for (const opt of field?.options || []) {
        if (opt?.id !== undefined) out[opt.id] = 0;
      }
      return out;
    },
  );
  const [quote, setQuote] = useState<JobJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [footerActionsOverride, setFooterActionsState] = useState<
    FooterAction[] | null
  >(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const setFieldSelection = useCallback((fieldId: number, sel: FieldSelection) => {
    setSelections((prev) => ({ ...prev, [fieldId]: sel }));
  }, []);

  const setGroupQuantity = useCallback((index: number, qty: number) => {
    setGroups((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: qty } : row)),
    );
  }, []);

  const setGroupFieldSelection = useCallback(
    (groupIndex: number, fieldId: number, sel: FieldSelection) => {
      setGroups((prev) =>
        prev.map((row, i) =>
          i === groupIndex
            ? { ...row, selections: { ...row.selections, [fieldId]: sel } }
            : row,
        ),
      );
    },
    [],
  );

  const addGroup = useCallback(() => {
    setGroups((prev) => [...prev, initialGroupRow(product)]);
  }, [product]);

  const removeGroup = useCallback((index: number) => {
    setGroups((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const setOptionQuantity = useCallback((optionId: number, qty: number) => {
    setOptionQuantities((prev) => ({ ...prev, [optionId]: Math.max(0, qty) }));
  }, []);

  const buildJob = useCallback(
    (): JobJson =>
      buildProductFormJob({
        product,
        quantity,
        selections,
        groups: hasGroups && !optionQuantityGrid ? groups : undefined,
        optionQuantities: optionQuantityGrid ? optionQuantities : undefined,
      }),
    [
      product,
      quantity,
      selections,
      groups,
      optionQuantities,
      hasGroups,
      optionQuantityGrid,
    ],
  );

  const pricingRef = useRef(pricing);
  pricingRef.current = pricing;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      try {
        const priced = await pricingRef.current.getQuote(buildJob());
        if (reqId === reqIdRef.current) setQuote(priced);
      } catch {
        /* keep the previous quote on failure */
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buildJob]);

  const submit = useCallback(
    (action: SubmitAction) => {
      const fn = actions[action];
      if (fn) fn(buildJob());
    },
    [actions, buildJob],
  );

  const setFooterActions = useCallback((next: FooterAction[] | null) => {
    setFooterActionsState(normalizeFooterActions(next));
  }, []);

  const footerActions =
    footerActionsOverride ?? normalizeFooterActions(footerActionsProp);

  const value = useMemo<ProductFormContextValue>(
    () => ({
      product,
      hasGroups,
      optionQuantityGrid,
      groupFields,
      independentFields,
      quantity,
      setQuantity,
      selections,
      setFieldSelection,
      groups,
      setGroupQuantity,
      setGroupFieldSelection,
      addGroup,
      removeGroup,
      optionQuantities,
      setOptionQuantity,
      quote,
      loading,
      currency: (quote as { currency?: string })?.currency,
      helpers,
      available: {
        addToCart: !!actions.addToCart,
        buyNow: !!actions.buyNow,
        getQuote: !!actions.getQuote,
      },
      actionLabels: actionLabels || {},
      footerActions,
      setFooterActions,
      submit,
    }),
    [
      product,
      hasGroups,
      optionQuantityGrid,
      groupFields,
      independentFields,
      quantity,
      selections,
      groups,
      optionQuantities,
      quote,
      loading,
      helpers,
      actions,
      actionLabels,
      footerActions,
      setFooterActions,
      submit,
      setQuantity,
      setFieldSelection,
      setGroupQuantity,
      setGroupFieldSelection,
      addGroup,
      removeGroup,
      setOptionQuantity,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type { GroupRow };
