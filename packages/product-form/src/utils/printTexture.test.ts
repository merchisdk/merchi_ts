import { bodyColourFromDesign, drawPrintTexture, printAreaFrame, printObjects } from './printTexture';
import type { DraftCanvasState } from './types';

function state(partial: Partial<DraftCanvasState> = {}): DraftCanvasState {
  return {
    width: 1000,
    height: 500,
    objects: [],
    ...partial,
  };
}

test('print objects leave body colour rects off the texture', () => {
  const objects = printObjects(state({
    objects: [
      { id: 'c', type: 'rect', x: 0, y: 0, width: 1000, height: 500, rotation: 0, scaleX: 1, scaleY: 1, fill: '#112233' },
      { id: 't', type: 'text', x: 10, y: 20, width: 80, height: 40, rotation: 0, scaleX: 1, scaleY: 1, text: 'Hi' },
      { id: 'i', type: 'image', x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1, src: 'logo.png' },
    ],
  }));
  expect(objects.map((obj) => obj.id)).toEqual(['t', 'i']);
});

test('print area frame uses the requested region, then the full artboard', () => {
  const template = {
    width: 200,
    height: 100,
    customisationMap: {
      regions: [{ role: 'print_area', bbox: [0.25, 0.5, 0.5, 0.25] }],
    },
  };
  expect(printAreaFrame(template, 0)).toEqual({ x: 50, y: 50, width: 100, height: 25 });
  expect(printAreaFrame({ width: 200, height: 100 }, 0)).toEqual({
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });
});

test('body colour prefers the artboard fill, then a colour variation', () => {
  expect(bodyColourFromDesign(state({
    objects: [
      { id: 'c', type: 'rect', x: 0, y: 0, width: 1000, height: 500, rotation: 0, scaleX: 1, scaleY: 1, fill: '#abcdef' },
    ],
  }), [])).toBe('#abcdef');
  expect(bodyColourFromDesign(state(), [{
    value: '7',
    variationField: {
      fieldType: 11,
      options: [{ id: 7, colour: '#00aa00', value: 'Green' }],
    },
  }])).toBe('#00aa00');
});

test('draw places text in print-area space without the template image', () => {
  const calls: unknown[][] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    scale: (x: number, y: number) => calls.push(['scale', x, y]),
    translate: (x: number, y: number) => calls.push(['translate', x, y]),
    rotate: (radians: number) => calls.push(['rotate', radians]),
    clearRect: () => calls.push(['clear']),
    fillRect: () => calls.push(['fillRect']),
    fillText: (text: string, x: number, y: number) => calls.push(['fillText', text, x, y]),
    drawImage: () => calls.push(['drawImage']),
  };
  drawPrintTexture(ctx, state({
    objects: [
      { id: 't', type: 'text', x: 60, y: 70, width: 40, height: 20, rotation: 0, scaleX: 1, scaleY: 1, text: 'Go', fontSize: 16, align: 'left' },
    ],
  }), { x: 50, y: 40, width: 100, height: 50 }, new Map(), 100, 50);
  expect(calls).toContainEqual(['translate', -50, -40]);
  expect(calls).toContainEqual(['translate', 60, 70]);
  expect(calls).toContainEqual(['fillText', 'Go', 0, 10]);
  expect(calls.some((call) => call[0] === 'drawImage')).toBe(false);
});
