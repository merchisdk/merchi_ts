import { previewScaleY, templateForSurface, templateMillimetres } from './previewSize';

const widths = [
  { id: 1, name: 'Outside 1/4 inch', selectedByVariationFieldOptions: [{ value: '1/4 inch' }] },
  { id: 2, name: 'Inside 1/4 inch', selectedByVariationFieldOptions: [{ value: '1/4 inch' }] },
  { id: 3, name: 'Outside 1 inch', selectedByVariationFieldOptions: [{ value: '1 inch (25 mm)' }] },
  { id: 4, name: 'Inside 1 inch', selectedByVariationFieldOptions: [{ value: '1 inch (25 mm)' }] },
];

test('reads an explicit millimetre width ahead of the inch in the name', () => {
  expect(templateMillimetres(widths[2])).toBe(25);
  expect(templateMillimetres(widths[0])).toBe(6.35);
});

test('scales Y only when the model uses the shared face materials', () => {
  const shared = [
    { role: 'print', materialName: 'Print_outside' },
    { role: 'print', materialName: 'Print_inside' },
  ];
  expect(previewScaleY(widths, 1, shared)).toBeCloseTo(6.35 / 25);
  expect(previewScaleY(widths, 3, shared)).toBe(1);
  const stacked = [{ role: 'print', materialName: 'Print_Outside_1_4_inch_1' }];
  expect(previewScaleY(widths, 1, stacked)).toBe(1);
});

test('paints the selected size onto the shared face', () => {
  const surfaces = [
    { role: 'print', materialName: 'Print_outside', templateId: 3 },
  ];
  const visible = [widths[0]];
  const match = templateForSurface(surfaces[0], visible, widths, 1, surfaces);
  expect(match.id).toBe(1);
  const largest = templateForSurface(
    { role: 'print', materialName: 'Print_outside', templateId: 1 },
    [widths[2]],
    widths,
    3,
    surfaces,
  );
  expect(largest.id).toBe(3);
  expect(previewScaleY(widths, 3, surfaces)).toBe(1);
});
