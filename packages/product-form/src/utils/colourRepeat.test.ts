import {
  colourPickerList,
  colourRepeatBounds,
  colourRepeatError,
  coloursFromPickerValue,
  pickerValueFromColours,
} from './colourRepeat';

test('a blank maximum is one colour', () => {
  expect(colourRepeatBounds({})).toEqual({ min: 1, max: 1 });
  expect(colourRepeatBounds({ colourRepeatMax: 1, colourRepeatMin: 1 })).toEqual({
    min: 1,
    max: 1,
  });
});

test('the minimum cannot pass the maximum and the maximum stops at 8', () => {
  expect(colourRepeatBounds({ colourRepeatMax: 3 })).toEqual({ min: 1, max: 3 });
  expect(colourRepeatBounds({ colourRepeatMin: 4, colourRepeatMax: 3 })).toEqual({
    min: 3,
    max: 3,
  });
  expect(colourRepeatBounds({ colourRepeatMax: 20 }).max).toBe(8);
});

test('a list is stored without empty slots', () => {
  expect(pickerValueFromColours(['#e23d3d', '', '1e4fa3'])).toBe(
    '["#E23D3D","#1E4FA3"]',
  );
  expect(pickerValueFromColours(['', ''])).toBe('');
  expect(coloursFromPickerValue('["#E23D3D","#1E4FA3"]')).toEqual([
    '#E23D3D',
    '#1E4FA3',
  ]);
  expect(colourPickerList('#E23D3D')).toBeNull();
});

test('a short list is invalid once the customer has started choosing', () => {
  const field = { name: 'Band colors', colourRepeatMin: 2, colourRepeatMax: 3, required: true };
  expect(colourRepeatError('', field)).toBe('Band colors is required');
  expect(colourRepeatError('["#112233"]', field)).toBe('Choose at least 2 colours');
  expect(colourRepeatError('["#112233","#445566"]', field)).toBeNull();
  expect(colourRepeatError('', { ...field, required: false })).toBeNull();
});
