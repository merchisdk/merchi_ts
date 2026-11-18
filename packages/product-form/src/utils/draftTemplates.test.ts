import { FieldType } from './types';
import {
  blankTemplate,
  bboxToPixels,
  canvasKindForFieldType,
  clampOrigin,
  confineToRegion,
  movementLimitForObject,
  allowedColoursForText,
  colourChoiceFromFill,
  editorAllows,
  editorPolicyForField,
  editorPolicyForObject,
  normaliseAllowedColours,
  restrictedColourSwatches,
  defaultPlacement,
  designGroupCount,
  downloadableDraftTemplates,
  detachField,
  expandTextBox,
  fitInside,
  fitTextBox,
  inferArtworkRole,
  isTemplateVisible,
  normaliseCssColour,
  resolveArtworkRole,
  linkedVariationsForTemplate,
  productAllowsClientDesign,
  regionsForRole,
  seedOrSyncCanvas,
  selectedOptionIdsFromVariations,
  textColourSwatches,
  variationCanvasContent,
  variationValuePathForGroup,
  visibleTemplatesForGroup,
} from './draftTemplates';

test('productAllowsClientDesign requires both flags and a template', () => {
  expect(productAllowsClientDesign({})).toBe(false);
  expect(productAllowsClientDesign({ needsDrafting: true })).toBe(false);
  expect(productAllowsClientDesign({ allowClientDraftContribution: true })).toBe(false);
  expect(productAllowsClientDesign({
    needsDrafting: true,
    allowClientDraftContribution: true,
  })).toBe(false);
  expect(productAllowsClientDesign({
    needsDrafting: true,
    allowClientDraftContribution: true,
    draftTemplates: [],
  })).toBe(false);
  expect(productAllowsClientDesign({
    needsDrafting: true,
    allowClientDraftContribution: true,
    draftTemplates: [{ id: 1 }],
  })).toBe(true);
});

test('designGroupCount is 1 without group fields', () => {
  expect(designGroupCount({}, { variationsGroups: [{}, {}] })).toBe(1);
  expect(designGroupCount(
    { groupVariationFields: [{ id: 1 }] },
    { variationsGroups: [{}, {}, {}] }
  )).toBe(3);
});

test('isTemplateVisible requires every selectedBy option', () => {
  const selected = new Set([10, 20]);
  expect(isTemplateVisible({ selectedByVariationFieldOptions: [] }, selected)).toBe(true);
  expect(isTemplateVisible(
    { selectedByVariationFieldOptions: [{ id: 10 }] },
    selected
  )).toBe(true);
  expect(isTemplateVisible(
    { selectedByVariationFieldOptions: [{ id: 10 }, { id: 20 }] },
    selected
  )).toBe(true);
  expect(isTemplateVisible(
    { selectedByVariationFieldOptions: [{ id: 10 }, { id: 30 }] },
    selected
  )).toBe(false);
});

test('visibleTemplatesForGroup uses independent and group selections', () => {
  const product = {
    draftTemplates: [
      { id: 1, selectedByVariationFieldOptions: [] },
      { id: 2, selectedByVariationFieldOptions: [{ id: 99 }] },
    ],
  };
  expect(visibleTemplatesForGroup(product, [], []).map((t: any) => t.id)).toEqual([1]);
  expect(visibleTemplatesForGroup(
    product,
    [{ value: '99' }],
    []
  ).map((t: any) => t.id)).toEqual([1, 2]);
});

test('downloadableDraftTemplates uses the templates for the current selection', () => {
  const product = {
    draftTemplates: [
      { id: 1, name: 'Shared', file: { downloadUrl: 'https://cdn.example/shared.png' } },
      {
        id: 2,
        name: 'Youth',
        file: { downloadUrl: 'https://cdn.example/youth.png' },
        selectedByVariationFieldOptions: [{ id: 9 }],
      },
    ],
  };
  expect(downloadableDraftTemplates(product, {}).map((template: any) => template.id)).toEqual([1]);
  expect(downloadableDraftTemplates(product, {
    variations: [{ value: '9' }],
  }).map((template: any) => template.id)).toEqual([1, 2]);
});

test('downloadableDraftTemplates offers every file when no template matches yet', () => {
  const product = {
    draftTemplates: [
      {
        id: 2,
        file: { id: 8 },
        selectedByVariationFieldOptions: [{ id: 9 }],
      },
    ],
  };
  expect(downloadableDraftTemplates(product, {}).map((template: any) => template.id)).toEqual([2]);
});

test('downloadableDraftTemplates skips templates without a file', () => {
  expect(downloadableDraftTemplates({
    draftTemplates: [{ id: 1, file: null }, { id: 2 }],
  }, {})).toEqual([]);
});

test('canvasKindForFieldType maps injectable types and skips the rest', () => {
  expect(canvasKindForFieldType(FieldType.TEXT_INPUT)).toBe('text');
  expect(canvasKindForFieldType(FieldType.FILE_UPLOAD)).toBe('image');
  expect(canvasKindForFieldType(FieldType.COLOUR_PICKER)).toBe('rect');
  expect(canvasKindForFieldType(FieldType.FIELD_INSTRUCTIONS)).toBe(null);
  expect(canvasKindForFieldType(FieldType.AREA)).toBe(null);
});

test('variationCanvasContent reads text, option labels, files and colours', () => {
  expect(variationCanvasContent({
    value: 'Hello',
    variationField: { fieldType: FieldType.TEXT_INPUT },
  })).toEqual({ kind: 'text', text: 'Hello' });

  expect(variationCanvasContent({
    value: '5,6',
    selectableOptions: [
      { optionId: 5, value: 'Red' },
      { optionId: 6, value: 'Large' },
    ],
    variationField: { fieldType: FieldType.CHECKBOX },
  })).toEqual({ kind: 'text', text: 'Red, Large' });

  expect(variationCanvasContent({
    variationFiles: [{ viewUrl: 'https://cdn.example/logo.png' }],
    variationField: { fieldType: FieldType.FILE_UPLOAD },
  })).toEqual({ kind: 'image', src: 'https://cdn.example/logo.png' });

  expect(variationCanvasContent({
    value: '#ff00aa',
    variationField: { fieldType: FieldType.COLOUR_PICKER },
  })).toEqual({ kind: 'rect', fill: '#ff00aa' });

  expect(variationCanvasContent({
    value: '12',
    variationField: {
      fieldType: FieldType.COLOUR_SELECT,
      options: [{ id: 12, colour: '#00aa00', value: 'Green' }],
    },
  })).toEqual({ kind: 'rect', fill: '#00aa00' });

  expect(variationCanvasContent({
    value: '12',
    variationField: { fieldType: FieldType.COLOUR_SELECT, options: [] },
  })).toEqual({ kind: 'rect', fill: undefined });
});

test('normaliseCssColour ignores option ids and keeps hex or names', () => {
  expect(normaliseCssColour('12', '#0a0')).toBe('#00aa00');
  expect(normaliseCssColour('Green')).toBe('Green');
  expect(normaliseCssColour(undefined, '')).toBeUndefined();
});

test('expandTextBox grows a short box from the centre and leaves a wider box', () => {
  const narrow = { x: 100, y: 40, width: 80, height: 50, text: 'example text' };
  const grown = expandTextBox(narrow, 140, 50);
  expect(grown).toMatchObject({ x: 70, y: 40, width: 140, height: 50 });
  expect(expandTextBox(grown, 100, 40)).toBe(grown);
});

test('fitTextBox shrinks to the text instead of the region', () => {
  const fitted = fitTextBox({
    x: 0,
    y: 0,
    width: 800,
    height: 200,
    text: 'Hi',
    fontSize: 40,
  });
  expect(fitted.width).toBeLessThan(200);
  expect(fitted.height).toBeLessThan(80);
  expect(fitted.x).toBeGreaterThan(200);
});

test('linkedVariationsForTemplate only returns editedBy fields', () => {
  const template = { editedByVariationFields: [{ id: 2 }] };
  const variations = [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT } },
    { variationField: { id: 2, fieldType: FieldType.TEXT_INPUT }, value: 'A' },
  ];
  expect(linkedVariationsForTemplate(template, variations)).toHaveLength(1);
  expect(linkedVariationsForTemplate({ editedByVariationFields: [] }, variations)).toHaveLength(0);
});

test('seedOrSyncCanvas places linked fields and updates content only', () => {
  const template = {
    id: 8,
    width: 1000,
    height: 1000,
    editedByVariationFields: [{ id: 1 }, { id: 2 }],
    customisationMap: {
      regions: [
        { role: 'text_placeholder', bbox: [0.1, 0.1, 0.4, 0.1] },
        { role: 'print_area', bbox: [0.2, 0.3, 0.5, 0.4] },
      ],
    },
  };
  const first = seedOrSyncCanvas(null, template, [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT }, value: 'Acme' },
    {
      variationField: { id: 2, fieldType: FieldType.FILE_UPLOAD },
      variationFiles: [{ viewUrl: 'https://cdn.example/a.png' }],
    },
  ]);
  expect(first.objects).toHaveLength(2);
  const text = first.objects.find((o) => o.type === 'text')!;
  expect(text.text).toBe('Acme');
  expect(text.width).toBeLessThan(200);
  expect(text.merchiFieldId).toBe(1);
  const image = first.objects.find((o) => o.type === 'image')!;
  expect(image.src).toBe('https://cdn.example/a.png');
  expect(image.x).toBeCloseTo(200);

  const movedCenter = 333 + text.width / 2;
  text.x = 333;
  const synced = seedOrSyncCanvas(first, template, [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT }, value: 'Beta' },
    {
      variationField: { id: 2, fieldType: FieldType.FILE_UPLOAD },
      variationFiles: [{ viewUrl: 'https://cdn.example/a.png' }],
    },
  ]);
  const syncedText = synced.objects.find((o) => o.merchiFieldId === 1)!;
  expect(syncedText.text).toBe('Beta');
  expect(syncedText.x + syncedText.width / 2).toBeCloseTo(movedCenter);
});

test('seedOrSyncCanvas keeps a customer text box and restores saved textStyle', () => {
  const template = {
    width: 1000,
    height: 1000,
    editedByVariationFields: [{ id: 1 }],
  };
  const savedStyle = {
    colour: '#abcdef',
    textSize: 72,
    font: 'Pacifico',
    align: 'right',
    x: 15,
    y: 25,
    width: 400,
    height: 80,
    rotation: 8,
    scaleX: 1.2,
    scaleY: 0.9,
  };
  const seeded = seedOrSyncCanvas(null, template, [{
    value: 'Saved',
    textStyle: savedStyle,
    variationField: { id: 1, fieldType: FieldType.TEXT_INPUT },
  }]);
  const linked = seeded.objects.find((obj) => obj.merchiFieldId === 1)!;
  expect(linked).toMatchObject({
    text: 'Saved',
    fill: '#abcdef',
    fontSize: 72,
    fontFamily: 'Pacifico',
    align: 'right',
    x: 15,
    y: 25,
    width: 400,
    height: 80,
    rotation: 8,
    scaleX: 1.2,
    scaleY: 0.9,
  });

  const withAdded = {
    ...seeded,
    objects: [
      ...seeded.objects,
      {
        id: 'added',
        type: 'text' as const,
        x: 40,
        y: 50,
        width: 320,
        height: 90,
        rotation: 12,
        scaleX: 1.4,
        scaleY: 0.8,
        text: 'Team night',
        fontSize: 56,
        fontFamily: 'Oswald',
        fill: '#112233',
        align: 'center',
      },
    ],
  };
  const synced = seedOrSyncCanvas(withAdded, template, [{
    value: 'Saved',
    textStyle: { ...savedStyle, x: 1, y: 1 },
    variationField: { id: 1, fieldType: FieldType.TEXT_INPUT },
  }]);
  expect(synced.objects.find((obj) => obj.merchiFieldId === 1)?.x).toBe(15);
  expect(synced.objects.find((obj) => obj.id === 'added')).toMatchObject({
    x: 40,
    y: 50,
    width: 320,
    height: 90,
    rotation: 12,
    scaleX: 1.4,
    scaleY: 0.8,
    text: 'Team night',
    fontSize: 56,
    fontFamily: 'Oswald',
    fill: '#112233',
    align: 'center',
  });
});

test('detachField prevents re-seeding that field', () => {
  const template = {
    width: 500,
    height: 500,
    editedByVariationFields: [{ id: 1 }],
  };
  const seeded = seedOrSyncCanvas(null, template, [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT }, value: 'Keep' },
  ]);
  const detached = detachField(seeded, seeded.objects[0].id);
  expect(detached.objects).toHaveLength(0);
  const again = seedOrSyncCanvas(detached, template, [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT }, value: 'Keep' },
  ]);
  expect(again.objects).toHaveLength(0);
});

test('regionsForRole and bboxToPixels convert fractional boxes', () => {
  expect(regionsForRole({
    regions: [
      { role: 'print_area', bbox: [0.1, 0.2, 0.3, 0.4] },
      { role: 'text_placeholder', bbox: [0, 0, 1, 1] },
    ],
  }, 'print_area')).toEqual([[0.1, 0.2, 0.3, 0.4]]);
  expect(bboxToPixels([0.1, 0.2, 0.3, 0.4], 1000, 500)).toEqual({
    x: 100,
    y: 100,
    width: 300,
    height: 200,
  });
});

test('inferArtworkRole maps colour fields to text or base', () => {
  expect(inferArtworkRole({ fieldType: FieldType.FILE_UPLOAD })).toBe('image');
  expect(inferArtworkRole({ fieldType: FieldType.TEXT_INPUT })).toBe('text');
  expect(inferArtworkRole({
    fieldType: FieldType.COLOUR_PICKER,
    name: 'Text Colour',
  })).toBe('text_fill');
  expect(inferArtworkRole({
    fieldType: FieldType.COLOUR_SELECT,
    name: 'Wristband Colour',
  })).toBe('body_colour_fill');
});

test('resolveArtworkRole keeps named base-colour fields as body fills', () => {
  expect(resolveArtworkRole({
    id: 3,
    fieldType: FieldType.COLOUR_PICKER,
    name: 'Wristband Colour',
  }, {
    customisationMap: {
      fieldBindings: [{ fieldId: 3, role: 'text_fill', targetFieldId: 1 }],
    },
  }, [{ id: 1, fieldType: FieldType.TEXT_INPUT }])).toBe('body_colour_fill');
});

test('fitInside preserves ratio inside a box', () => {
  const fitted = fitInside({ x: 0, y: 0, width: 200, height: 100 }, 100, 100, true);
  expect(fitted.width).toBe(100);
  expect(fitted.height).toBe(100);
  expect(fitted.x).toBe(50);
  expect(fitInside({ x: 0, y: 0, width: 200, height: 100 }, 100, 100, false)).toEqual({
    x: 0, y: 0, width: 200, height: 100,
  });
});

test('colourChoiceFromFill selects the matching priced colour and leaves other colours', () => {
  const variation = {
    value: '1',
    selectableOptions: [
      { optionId: 1, value: 'Red', colour: '#ff0000', unitCost: 1 },
      { optionId: 2, value: 'Blue', colour: '#0000ff', unitCost: 3, available: false },
      { optionId: 3, value: 'Blue', colour: '#0000FF', unitCost: 2 },
    ],
    variationField: { fieldType: FieldType.COLOUR_SELECT },
  };
  expect(colourChoiceFromFill(variation, '#0000ff')).toEqual({ value: '3' });
  expect(colourChoiceFromFill(variation, '#00ff00')).toBeNull();
  expect(colourChoiceFromFill({ ...variation, value: '3' }, '#0000ff')).toBeNull();
  expect(colourChoiceFromFill({
    value: '#ff0000',
    variationField: { fieldType: FieldType.COLOUR_PICKER },
  }, '#0000ff')).toEqual({ value: '#0000ff' });
  expect(textColourSwatches(variation)?.map((swatch) => swatch.label)).toEqual(['Red', 'Blue']);
});

test('movement stays inside the text area or print area', () => {
  const template = {
    width: 1000,
    height: 500,
    customisationMap: {
      regions: [
        { role: 'print_area', bbox: [0.2, 0.2, 0.6, 0.6] },
        { role: 'text_placeholder', bbox: [0.1, 0.1, 0.3, 0.2] },
      ],
      fieldBindings: [{ fieldId: 4, role: 'text', regionRole: 'print_area' }],
    },
  };
  const text = { type: 'text', x: 0, y: 0, width: 100, height: 40, rotation: 0, scaleX: 1, scaleY: 1 };
  expect(movementLimitForObject(template, text)).toEqual({ x: 100, y: 50, width: 300, height: 100 });
  expect(movementLimitForObject(template, { ...text, merchiFieldId: 4 })).toEqual({
    x: 200, y: 100, width: 600, height: 300,
  });
  expect(movementLimitForObject(template, { type: 'image', x: 0, y: 0, width: 10, height: 10 })).toEqual({
    x: 200, y: 100, width: 600, height: 300,
  });
  expect(clampOrigin({ ...text, x: 0, y: 0 }, { x: 100, y: 50, width: 300, height: 100 })).toEqual({
    x: 100, y: 50,
  });
  const shrunk = confineToRegion(
    { ...text, x: 100, y: 50, width: 400, height: 40 },
    { x: 100, y: 50, width: 300, height: 100 },
  );
  expect(shrunk.scaleX).toBeCloseTo(0.75);
  expect(shrunk.x).toBeGreaterThanOrEqual(100);
  expect(shrunk.x + shrunk.width * shrunk.scaleX).toBeLessThanOrEqual(400.01);
});

test('editor permissions default to allowed and can limit a linked colour', () => {
  const template = {
    customisationMap: {
      fieldBindings: [
        { fieldId: 1, role: 'text', editor: { allowRotation: false, allowedColours: ['#FF0000', '#00FF00'] } },
        { fieldId: 9, role: 'text_fill', editor: { allowedColours: ['#ff0000', '#0000ff'] } },
      ],
    },
  };
  const policy = editorPolicyForField(template, 1);
  expect(editorAllows(policy, 'allowRotation')).toBe(false);
  expect(editorAllows(policy, 'allowScale')).toBe(true);
  expect(editorAllows(editorPolicyForField(template, 4), 'allowTextSize')).toBe(true);
  expect(normaliseAllowedColours(['#FF0000', 'nope', '#ff0000'])).toEqual(['#ff0000']);
  expect(allowedColoursForText(template, 1, 9)).toEqual(['#ff0000']);
  expect(restrictedColourSwatches(
    [{ colour: '#ff0000', label: 'Red' }, { colour: '#00ff00', label: 'Green' }],
    ['#ff0000'],
  )?.map((swatch) => swatch.label)).toEqual(['Red']);
  expect(restrictedColourSwatches(null, [])).toBeNull();
});

test('extra text and pictures use template limits, and a linked option keeps its own', () => {
  const template = {
    width: 1000,
    height: 500,
    customisationMap: {
      regions: [
        { role: 'print_area', bbox: [0.2, 0.2, 0.6, 0.6] },
        { role: 'text_placeholder', bbox: [0.1, 0.1, 0.3, 0.2] },
      ],
      fieldBindings: [{
        fieldId: 4,
        role: 'text',
        editor: { allowRotation: false },
        regionRole: 'text_placeholder',
      }],
      additionalEditor: {
        text: { allowTextSize: false, allowedColours: ['#111111'] },
        image: { allowScale: false },
        textRegionRole: 'print_area',
      },
    },
  };
  const box = { x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1 };
  expect(editorAllows(editorPolicyForObject(template, { type: 'text' }), 'allowTextSize')).toBe(false);
  expect(editorAllows(editorPolicyForObject(template, { type: 'text' }), 'allowRotation')).toBe(true);
  expect(editorAllows(
    editorPolicyForObject(template, { type: 'text', merchiFieldId: 4 }),
    'allowRotation',
  )).toBe(false);
  expect(editorAllows(editorPolicyForObject(template, { type: 'image' }), 'allowScale')).toBe(false);
  expect(movementLimitForObject(template, { type: 'text', ...box })).toEqual({
    x: 200, y: 100, width: 600, height: 300,
  });
  expect(movementLimitForObject(template, { type: 'text', merchiFieldId: 4, ...box })).toEqual({
    x: 100, y: 50, width: 300, height: 100,
  });
});

test('variationValuePathForGroup uses the design group before another group', () => {
  const form = {
    variations: [{ variationField: { id: 8 } }],
    variationsGroups: [
      { variations: [{ variationField: { id: 4 } }] },
      { variations: [{ variationField: { id: 4 } }, { variationField: { id: 5 } }] },
    ],
  };
  expect(variationValuePathForGroup(form, 4, 1)).toBe('variationsGroups[1].variations[0].value');
  expect(variationValuePathForGroup(form, 8, 1)).toBe('variations[0].value');
});

test('seedOrSyncCanvas applies a linked colour to text instead of a rect', () => {
  const template = {
    width: 1000,
    height: 1000,
    editedByVariationFields: [{ id: 1 }, { id: 2 }],
    customisationMap: {
      fieldBindings: [
        { fieldId: 1, role: 'text' },
        { fieldId: 2, role: 'text_fill', targetFieldId: 1 },
      ],
    },
  };
  const seeded = seedOrSyncCanvas(null, template, [
    { variationField: { id: 1, fieldType: FieldType.TEXT_INPUT }, value: 'Hello' },
    { variationField: { id: 2, fieldType: FieldType.COLOUR_PICKER }, value: '#ff0000' },
  ]);
  expect(seeded.objects).toHaveLength(1);
  expect(seeded.objects[0].text).toBe('Hello');
  expect(seeded.objects[0].fill).toBe('#ff0000');
});

test('seedOrSyncCanvas paints base colour even without a mapped region', () => {
  const template = {
    width: 1000,
    height: 1000,
    editedByVariationFields: [{ id: 3 }],
  };
  const variations = [
    {
      variationField: { id: 3, fieldType: FieldType.COLOUR_PICKER, name: 'Base colour' },
      value: '#00aa00',
    },
  ];
  const fallback = seedOrSyncCanvas(null, template, variations);
  expect(fallback.objects).toHaveLength(1);
  expect(fallback.objects[0].type).toBe('rect');
  expect(fallback.objects[0].fill).toBe('#00aa00');
  expect(fallback.objects[0].width).toBe(1000);
  expect(fallback.objects[0].locked).toBe(true);
  const withRegion = seedOrSyncCanvas(null, {
    ...template,
    customisationMap: {
      regions: [{ role: 'body_colour_fill', bbox: [0, 0.8, 1, 0.2] }],
    },
  }, variations);
  expect(withRegion.objects[0].y).toBeCloseTo(800);
  const fromPrintArea = seedOrSyncCanvas(null, {
    ...template,
    customisationMap: {
      regions: [{ role: 'print_area', bbox: [0.1, 0.4, 0.8, 0.15] }],
    },
  }, variations);
  expect(fromPrintArea.objects[0].x).toBeCloseTo(100);
  expect(fromPrintArea.objects[0].width).toBeCloseTo(800);
});

test('defaultPlacement stacks text and centres images', () => {
  const image = defaultPlacement('image', 0, 1000, 1000);
  expect(image.width).toBe(600);
  const text = defaultPlacement('text', 1, 1000, 1000);
  expect(text.y).toBeGreaterThan(40);
});

test('blankTemplate uses fallback artboard size', () => {
  expect(blankTemplate().id).toBe(0);
  expect(blankTemplate().width).toBe(1000);
});

test('selectedOptionIdsFromVariations parses csv values', () => {
  expect(Array.from(selectedOptionIdsFromVariations([
    { value: '1, 2' },
    { value: '2' },
  ])).sort()).toEqual([1, 2]);
});
