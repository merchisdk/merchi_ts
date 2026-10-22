const patched = new WeakSet<object>();

function emptyRules(): CSSRuleList {
  return [] as unknown as CSSRuleList;
}

function coerceCssRules(proto: object) {
  if (patched.has(proto)) return;
  const desc = Object.getOwnPropertyDescriptor(proto, 'cssRules');
  const getter = desc?.get;
  if (!getter) return;
  try {
    Object.defineProperty(proto, 'cssRules', {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        const rules = getter.call(this) as CSSRuleList | null | undefined;
        return rules == null ? emptyRules() : rules;
      },
    });
    patched.add(proto);
  } catch {
    // Some browsers lock the CSSOM descriptor.
  }
}

/**
 * Square's payment form initialises Stitches while the module evaluates.
 * Stitches reads `rule.cssRules.length` and throws if that list is missing.
 */
export function hardenStitchesCssom() {
  if (typeof window === 'undefined') return;
  if (typeof CSSGroupingRule !== 'undefined') {
    coerceCssRules(CSSGroupingRule.prototype);
  }
}
