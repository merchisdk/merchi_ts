import { bodyColourFromDesign, drawPrintTexture, printAreaFrame, printObjects } from './printTexture';
import type { DraftCanvasState } from './types';

jest.mock('./draftTemplates', () => {
  const actual = jest.requireActual('./draftTemplates');
  return {
    ...actual,
    paintBodyFillTexture: (state?: DraftCanvasState | null) => {
      const objects = state?.objects || [];
      const swirls = objects.filter((obj) => obj.fillStyle === 'swirl' && (obj.fills || []).length > 1);
      const slices = objects.filter((obj) => (
        obj.type === 'rect'
        && obj.artworkRole === 'body_colour_fill'
        && obj.fill
        && obj.fillStyle !== 'swirl'
      ));
      if (!state || (!swirls.length && slices.length < 2)) return null;
      return { width: state.width, height: state.height };
    },
  };
});

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
    fillRect: () => calls.push(['fillRect', ctx.fillStyle]),
    fillText: (text: string, x: number, y: number) => calls.push(['fillText', text, x, y]),
    drawImage: () => calls.push(['drawImage']),
  };
  drawPrintTexture(ctx, state({
    objects: [
      { id: 't', type: 'text', x: 60, y: 70, width: 40, height: 20, rotation: 0, scaleX: 1, scaleY: 1, text: 'Go', fontSize: 16, align: 'left' },
    ],
  }), { x: 50, y: 40, width: 100, height: 50 }, new Map(), 100, 50);
  expect(calls).toContainEqual(['fillRect', '#f4f4f5']);
  expect(calls).toContainEqual(['translate', -50, -40]);
  expect(calls).toContainEqual(['translate', 60, 70]);
  expect(calls).toContainEqual(['fillText', 'Go', 0, 10]);
  expect(calls.some((call) => call[0] === 'drawImage')).toBe(false);
});

test('print texture background is the design colour, with text drawn on top', () => {
  const calls: unknown[][] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    scale: () => calls.push(['scale']),
    translate: () => calls.push(['translate']),
    rotate: () => calls.push(['rotate']),
    clearRect: () => calls.push(['clear']),
    fillRect: () => calls.push(['fillRect', ctx.fillStyle]),
    fillText: (text: string) => calls.push(['fillText', text]),
    drawImage: () => calls.push(['drawImage']),
  };
  drawPrintTexture(ctx, state({
    objects: [
      { id: 'c', type: 'rect', x: 0, y: 300, width: 1000, height: 80, rotation: 0, scaleX: 1, scaleY: 1, fill: '#22aa44' },
      { id: 't', type: 'text', x: 60, y: 320, width: 40, height: 20, rotation: 0, scaleX: 1, scaleY: 1, text: 'Go', fontSize: 16 },
    ],
  }), { x: 0, y: 300, width: 1000, height: 80 }, new Map(), 200, 16, '#22aa44');
  expect(calls).toContainEqual(['fillRect', '#22aa44']);
  expect(calls).toContainEqual(['fillText', 'Go']);
});

test('swirl and segmented base colours are drawn onto the print texture', () => {
  const drawImage = jest.fn();
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: () => undefined,
    restore: () => undefined,
    scale: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    drawImage,
  };
  const area = { x: 0, y: 0, width: 800, height: 200 };
  drawPrintTexture(ctx, state({
    width: 800,
    height: 200,
    objects: [{
      id: 'swirl',
      type: 'rect',
      x: 0,
      y: 0,
      width: 800,
      height: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fill: '#112233',
      fillStyle: 'swirl',
      fills: ['#112233', '#abcdef'],
    }],
  }), area, new Map(), 800, 200);
  expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 200 }), 0, 0, 800, 200);

  drawImage.mockClear();
  drawPrintTexture(ctx, state({
    width: 800,
    height: 200,
    objects: [
      { id: 'a', type: 'rect', artworkRole: 'body_colour_fill', x: 0, y: 0, width: 400, height: 200, rotation: 0, scaleX: 1, scaleY: 1, fill: '#ff0000' },
      { id: 'b', type: 'rect', artworkRole: 'body_colour_fill', x: 400, y: 0, width: 400, height: 200, rotation: 0, scaleX: 1, scaleY: 1, fill: '#0000ff' },
    ],
  }), area, new Map(), 800, 200);
  expect(drawImage).toHaveBeenCalledTimes(1);
});
