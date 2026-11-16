import { Merchi } from '../merchi.js';

test('can make Variation', () => {
  const merchi = new Merchi();
  const variation = new merchi.Variation();
  expect(variation).toBeTruthy();
});

test('textStyle keeps the designer text box from the server', () => {
  const merchi = new Merchi();
  const variation = new merchi.Variation();
  const textStyle = {
    colour: '#112233',
    textSize: 56,
    font: 'Oswald',
    align: 'center',
    x: 12.5,
    y: 40,
    width: 180,
    height: 48,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  variation.fromJson({ textStyle });
  expect(variation.textStyle).toEqual(textStyle);
  expect(variation.toJson().textStyle).toEqual(textStyle);
});
