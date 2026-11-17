import {
  applyCanvasTextToJob,
  collectDesignerInputs,
  packDesignInputNotes,
} from './designerInputs';
import { DraftTemplateData } from './types';

const groupedProduct = { groupVariationFields: [{ id: 9 }] };
const plainProduct = { groupVariationFields: [] };

function drafts(): DraftTemplateData[] {
  return [{
    groupIndex: 0,
    productId: 4,
    previews: [],
    templateData: [{
      templateId: 1,
      draft: 'draft',
      canvasPreview: 'preview',
      canvasJson: {
        width: 100,
        height: 100,
        objects: [
          {
            id: 'linked',
            type: 'text',
            merchiFieldId: 9,
            text: 'From the form',
            x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1,
          },
          {
            id: 'added',
            type: 'text',
            text: 'Team night',
            fill: '#112233',
            fontSize: 56,
            fontFamily: 'Oswald',
            align: 'center',
            x: 12, y: 20, width: 240, height: 64, rotation: 0, scaleX: 1, scaleY: 1,
          },
          {
            id: 'logo',
            type: 'image',
            src: 'data:image/png;base64,aaa',
            x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1,
          },
          {
            id: 'fill',
            type: 'rect',
            fill: '#111111',
            x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1,
          },
        ],
      },
    }],
  }];
}

test('collectDesignerInputs keeps only text and images the customer added', () => {
  expect(collectDesignerInputs(plainProduct, drafts())).toEqual([
    {
      kind: 'text',
      name: 'Team night',
      value: 'Team night',
      textStyle: {
        colour: '#112233',
        textSize: 56,
        font: 'Oswald',
        align: 'center',
        x: 12,
        y: 20,
        width: 240,
        height: 64,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
    },
    { kind: 'file', name: 'Custom image', src: 'data:image/png;base64,aaa' },
  ]);
});

test('collectDesignerInputs drops extra text and images when the product disallows them', () => {
  expect(collectDesignerInputs(
    { ...plainProduct, allowAdditionalDesignObjects: false },
    drafts(),
  )).toEqual([]);
});

test('collectDesignerInputs records the variation group when the product has groups', () => {
  const [text] = collectDesignerInputs(groupedProduct, drafts());
  expect(text.groupIndex).toBe(0);
});

test('applyCanvasTextToJob stores the text box on its variation', () => {
  const job = {
    variations: [
      { value: 'Old', variationField: { id: 3, fieldType: 1 } },
      { value: '4,5', variationField: { id: 8, fieldType: 2 } },
    ],
    variationsGroups: [{
      quantity: 1,
      variations: [
        { value: 'Group old', variationField: { id: 9, fieldType: 4 } },
      ],
    }],
  };
  const next = applyCanvasTextToJob(job, [{
    groupIndex: 0,
    productId: 1,
    previews: [],
    templateData: [{
      templateId: 1,
      draft: '',
      canvasPreview: '',
      canvasJson: {
        width: 100,
        height: 100,
        objects: [
          {
            id: 'linked',
            type: 'text',
            merchiFieldId: 3,
            text: 'Hello',
            fill: '#111111',
            fontSize: 40,
            fontFamily: 'Inter',
            align: 'left',
            x: 1,
            y: 2,
            width: 80,
            height: 20,
            rotation: 5,
            scaleX: 1,
            scaleY: 1.5,
          },
          {
            id: 'choice',
            type: 'text',
            merchiFieldId: 8,
            text: 'Shown label',
            fill: '#ff0000',
            fontSize: 20,
            fontFamily: 'Inter',
            align: 'center',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          {
            id: 'group',
            type: 'text',
            merchiFieldId: 9,
            text: 'Group hello',
            fill: '#00ff00',
            fontSize: 18,
            fontFamily: 'Inter',
            align: 'right',
            x: 3,
            y: 4,
            width: 50,
            height: 16,
            rotation: 0,
            scaleX: 2,
            scaleY: 1,
          },
        ],
      },
    }],
  }]);

  expect(next.variations[0].value).toBe('Hello');
  expect(next.variations[0].textStyle).toEqual({
    colour: '#111111',
    textSize: 40,
    font: 'Inter',
    align: 'left',
    x: 1,
    y: 2,
    width: 80,
    height: 20,
    rotation: 5,
    scaleX: 1,
    scaleY: 1.5,
  });
  expect(next.variations[1].value).toBe('4,5');
  expect(next.variations[1].textStyle.colour).toBe('#ff0000');
  expect(next.variationsGroups[0].variations[0].value).toBe('Group hello');
  expect(next.variationsGroups[0].variations[0].textStyle).toMatchObject({
    colour: '#00ff00',
    align: 'right',
    scaleX: 2,
  });
  expect(job.variations[0].value).toBe('Old');
});

test('packDesignInputNotes hides the checkout payload in the cart marker', () => {
  const notes = packDesignInputNotes([
    {
      kind: 'text',
      name: 'Team night',
      value: 'Team night',
      textStyle: {
        colour: '#112233',
        textSize: 56,
        font: 'Oswald',
        align: 'center',
      },
    },
    { kind: 'file', name: 'Custom image', file: { id: 'file-1' } },
  ]);
  expect(notes?.startsWith('[[client-design-inputs:')).toBe(true);
  expect(notes?.includes('data:image')).toBe(false);
  const encoded = notes!.slice('[[client-design-inputs:'.length, -2);
  const parsed = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
  ));
  expect(parsed).toEqual([
    {
      kind: 'text',
      name: 'Team night',
      value: 'Team night',
      textStyle: {
        colour: '#112233',
        textSize: 56,
        font: 'Oswald',
        align: 'center',
      },
    },
    { kind: 'file', name: 'Custom image', file: { id: 'file-1' } },
  ]);
});
