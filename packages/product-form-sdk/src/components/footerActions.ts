export type SubmitAction = 'addToCart' | 'buyNow' | 'getQuote';

/** One host-footer button. `getQuote` opens the Get quote modal. */
export interface FooterAction {
  action: SubmitAction;
  label?: string;
  primary?: boolean;
}

export const DEFAULT_FOOTER_LABELS: Record<SubmitAction, string> = {
  getQuote: 'Get quote',
  buyNow: 'Buy now',
  addToCart: 'Add to cart',
};

export const DEFAULT_FOOTER_ORDER: SubmitAction[] = [
  'getQuote',
  'buyNow',
  'addToCart',
];

export function isSubmitAction(value: unknown): value is SubmitAction {
  return value === 'addToCart' || value === 'buyNow' || value === 'getQuote';
}

/** Keep only well-formed footer actions. Empty / invalid input → null (use defaults). */
export function normalizeFooterActions(raw: unknown): FooterAction[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FooterAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const action = (item as FooterAction).action;
    if (!isSubmitAction(action)) continue;
    const label = (item as FooterAction).label;
    out.push({
      action,
      label: typeof label === 'string' && label.trim() ? label : undefined,
      primary: !!(item as FooterAction).primary,
    });
  }
  return out.length ? out : null;
}

export function footerActionsFromComponent(type: unknown): FooterAction[] | null {
  if (type == null || (typeof type !== 'function' && typeof type !== 'object')) {
    return null;
  }
  return normalizeFooterActions(
    (type as { footerActions?: unknown }).footerActions,
  );
}

export function resolveFooterActions(options: {
  available: Record<SubmitAction, boolean>;
  actionLabels?: Partial<Record<SubmitAction, string>>;
  footerActions?: FooterAction[] | null;
}): FooterAction[] {
  const { available, actionLabels = {}, footerActions } = options;
  const labelFor = (action: SubmitAction, override?: string) =>
    actionLabels[action] || override || DEFAULT_FOOTER_LABELS[action];

  const fromConfig = normalizeFooterActions(footerActions);
  if (fromConfig) {
    const resolved = fromConfig
      .filter((item) => available[item.action])
      .map((item) => ({
        ...item,
        label: labelFor(item.action, item.label),
      }));
    if (resolved.length) {
      if (!resolved.some((item) => item.primary)) {
        resolved[resolved.length - 1] = {
          ...resolved[resolved.length - 1],
          primary: true,
        };
      }
      return resolved;
    }
  }

  return DEFAULT_FOOTER_ORDER.filter((action) => available[action]).map(
    (action, index, list) => ({
      action,
      label: labelFor(action),
      primary:
        action === 'addToCart' ||
        (index === list.length - 1 && !available.addToCart),
    }),
  );
}
