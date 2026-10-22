import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hardenStitchesCssom } from './hardenStitchesCssom';

class FakeGroupingRule {
  get cssRules(): CSSRuleList | undefined {
    return undefined;
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, 'CSSGroupingRule');

beforeEach(() => {
  Object.defineProperty(globalThis, 'CSSGroupingRule', {
    configurable: true,
    value: FakeGroupingRule,
  });
});

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, 'CSSGroupingRule', original);
  } else {
    delete (globalThis as { CSSGroupingRule?: unknown }).CSSGroupingRule;
  }
});

describe('hardenStitchesCssom', () => {
  it('returns an empty list when cssRules is missing', () => {
    hardenStitchesCssom();
    const group = new FakeGroupingRule();
    expect(group.cssRules).toBeDefined();
    expect(group.cssRules?.length).toBe(0);
  });
});
