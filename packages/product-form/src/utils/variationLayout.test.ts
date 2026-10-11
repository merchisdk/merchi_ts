import { clampVariationColumns, variationLayoutSpan } from './variationLayout';

test('column count stays between 1 and 4', () => {
  expect(clampVariationColumns(undefined)).toBe(1);
  expect(clampVariationColumns(2)).toBe(2);
  expect(clampVariationColumns(8)).toBe(4);
});

test('an empty span is the full width and a wider span is clamped', () => {
  expect(variationLayoutSpan(null, 2)).toBe(2);
  expect(variationLayoutSpan(undefined, 3)).toBe(3);
  expect(variationLayoutSpan(1, 2)).toBe(1);
  expect(variationLayoutSpan(4, 2)).toBe(2);
});
