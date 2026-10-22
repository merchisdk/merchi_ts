import { afterEach, describe, expect, it } from 'vitest';
import { hardenStitchesCssom } from './hardenStitchesCssom';

const original = Object.getOwnPropertyDescriptor(
  CSSGroupingRule.prototype,
  'cssRules',
);

afterEach(() => {
  if (original) {
    Object.defineProperty(CSSGroupingRule.prototype, 'cssRules', original);
  }
});

describe('hardenStitchesCssom', () => {
  it('returns an empty list when cssRules is missing', () => {
    Object.defineProperty(CSSGroupingRule.prototype, 'cssRules', {
      configurable: true,
      get() {
        return undefined;
      },
    });

    hardenStitchesCssom();

    const style = document.createElement('style');
    document.head.appendChild(style);
    style.sheet!.insertRule('@media{}');
    const group = style.sheet!.cssRules[0] as CSSGroupingRule;
    expect(group.cssRules).toBeDefined();
    expect(group.cssRules.length).toBe(0);
    style.remove();
  });
});
