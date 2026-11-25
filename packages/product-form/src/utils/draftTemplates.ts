import {
  BLANK_TEMPLATE_ID,
  DEFAULT_ARTBOARD,
  DraftArtworkRole,
  DraftCanvasObject,
  DraftCanvasObjectType,
  DraftCanvasState,
  DraftEditorPermissions,
  DraftFieldBinding,
  FieldType,
} from './types';
import { DEFAULT_DRAFT_FONT, cssFontFamily } from './draftFonts';
import { embroideryPixels, parseEmbroideryValue } from './embroidery';
import { productHasGroups } from './products';
import { pantoneByCode } from './pantoneColours';

export function productHasDraftTemplates(product: any): boolean {
  return Array.isArray(product?.draftTemplates) && product.draftTemplates.length > 0;
}

export function productAllowsClientDesign(product: any): boolean {
  return Boolean(
    product?.needsDrafting
    && product?.allowClientDraftContribution
    && productHasDraftTemplates(product),
  );
}

export function productHasVariationGroups(product: any): boolean {
  return productHasGroups(product);
}

export function designGroupCount(product: any, formValues: any): number {
  if (!productHasVariationGroups(product)) return 1;
  const groups = formValues?.variationsGroups;
  return Array.isArray(groups) && groups.length > 0 ? groups.length : 1;
}

export function parseSelectedOptionIds(value: any): number[] {
  if (value === undefined || value === null || value === '') return [];
  return String(value)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

export function selectedOptionIdsFromVariations(variations: any[]): Set<number> {
  const ids = new Set<number>();
  for (const variation of variations || []) {
    for (const id of parseSelectedOptionIds(variation?.value)) {
      ids.add(id);
    }
  }
  return ids;
}

export function isTemplateVisible(
  template: any,
  selectedOptionIds: Set<number>,
): boolean {
  const required = template?.selectedByVariationFieldOptions;
  if (!Array.isArray(required) || required.length === 0) return true;
  return required.every((opt: any) => opt?.id && selectedOptionIds.has(opt.id));
}

export function visibleTemplatesForGroup(
  product: any,
  independentVariations: any[],
  groupVariations: any[],
): any[] {
  const selected = selectedOptionIdsFromVariations([
    ...(independentVariations || []),
    ...(groupVariations || []),
  ]);
  return (product?.draftTemplates || []).filter((template: any) =>
    isTemplateVisible(template, selected)
  );
}

export function blankTemplate(product?: any) {
  const fromProduct = Number(product?.draftTemplates?.[0]?.width)
    || Number(product?.featureImage?.width)
    || DEFAULT_ARTBOARD.width;
  const height = Number(product?.draftTemplates?.[0]?.height)
    || Number(product?.featureImage?.height)
    || DEFAULT_ARTBOARD.height;
  return {
    id: BLANK_TEMPLATE_ID,
    name: 'Artwork',
    width: fromProduct,
    height,
    file: null,
    editedByVariationFields: [],
    selectedByVariationFieldOptions: [],
  };
}

export function templatesForGroup(
  product: any,
  independentVariations: any[],
  groupVariations: any[],
): any[] {
  const visible = visibleTemplatesForGroup(
    product,
    independentVariations,
    groupVariations,
  );
  return visible.length ? visible : [blankTemplate(product)];
}

function templateHasFile(template: any): boolean {
  const file = template?.file;
  if (!file) return false;
  return Boolean(
    file.id
    || file.downloadUrl
    || file.cachedDownloadUrl
    || file.viewUrl
    || file.cachedViewUrl,
  );
}

function uniqueFileTemplates(templates: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const template of templates) {
    if (!templateHasFile(template)) continue;
    const file = template.file || {};
    const key = template?.id != null
      ? `id:${template.id}`
      : `file:${file.id || file.downloadUrl || file.viewUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(template);
  }
  return result;
}

/** Blank templates the customer can download for the options currently selected. */
export function downloadableDraftTemplates(product: any, formValues: any): any[] {
  const independent = formValues?.variations || [];
  const groups = productHasVariationGroups(product)
    && Array.isArray(formValues?.variationsGroups)
    && formValues.variationsGroups.length
    ? formValues.variationsGroups
    : [{}];
  const matched: any[] = [];
  for (const group of groups) {
    matched.push(...visibleTemplatesForGroup(
      product,
      independent,
      group?.variations || [],
    ));
  }
  if (matched.length) return uniqueFileTemplates(matched);
  return uniqueFileTemplates(product?.draftTemplates || []);
}

export function canvasKindForField(field: any): DraftCanvasObjectType | null {
  if (parseInt(String(field?.fieldType), 10) === FieldType.EMBROIDERY) {
    return field?.embroideryInputMode === 'text' ? 'text' : 'image';
  }
  return canvasKindForFieldType(field?.fieldType);
}

export function canvasKindForFieldType(
  fieldType: any,
): DraftCanvasObjectType | null {
  switch (parseInt(String(fieldType), 10)) {
    case FieldType.TEXT_INPUT:
    case FieldType.TEXT_AREA:
    case FieldType.NUMBER_INPUT:
    case FieldType.SELECT:
    case FieldType.RADIO:
    case FieldType.CHECKBOX:
      return 'text';
    case FieldType.FILE_UPLOAD:
    case FieldType.IMAGE_SELECT:
      return 'image';
    case FieldType.COLOUR_PICKER:
    case FieldType.COLOUR_SELECT:
    case FieldType.COLOUR_EXTRACT:
    case FieldType.PANTONE_COLOUR_SELECT:
      return 'rect';
    default:
      return null;
  }
}

function optionById(variation: any, id: number): any | undefined {
  const fromSelectable = (variation?.selectableOptions || []).find(
    (option: any) => option.optionId === id || option.id === id
  );
  if (fromSelectable) return fromSelectable;
  return (variation?.variationField?.options || []).find(
    (option: any) => option.id === id || option.optionId === id
  );
}

export function variationCanvasContent(variation: any): {
  kind: DraftCanvasObjectType | null;
  text?: string;
  src?: string;
  fill?: string;
} {
  const field = variation?.variationField;
  const kind = canvasKindForField(field);
  if (!kind) return { kind: null };

  const type = parseInt(String(field.fieldType), 10);

  if (type === FieldType.EMBROIDERY) {
    const parsed = parseEmbroideryValue(variation?.value);
    if (kind === 'image') {
      const file = (variation?.variationFiles || [])[0];
      return { kind, src: file?.viewUrl || file?.cachedViewUrl || '' };
    }
    return { kind, text: parsed?.text || '' };
  }

  if (kind === 'text') {
    if (
      type === FieldType.SELECT
      || type === FieldType.RADIO
      || type === FieldType.CHECKBOX
    ) {
      const names = parseSelectedOptionIds(variation.value)
        .map((id) => optionById(variation, id)?.value)
        .filter(Boolean);
      return { kind, text: names.join(', ') };
    }
    return {
      kind,
      text: variation?.value != null && variation.value !== ''
        ? String(variation.value)
        : '',
    };
  }

  if (kind === 'image') {
    if (type === FieldType.FILE_UPLOAD) {
      const file = (variation?.variationFiles || [])[0];
      return {
        kind,
        src: file?.viewUrl || file?.cachedViewUrl || '',
      };
    }
    const ids = parseSelectedOptionIds(variation.value);
    const option = ids.length ? optionById(variation, ids[0]) : null;
    const file = option?.linkedFile;
    return { kind, src: file?.viewUrl || file?.cachedViewUrl || '' };
  }

  if (type === FieldType.COLOUR_PICKER) {
    return { kind, fill: normaliseCssColour(variation?.value) || '#000000' };
  }
  if (type === FieldType.PANTONE_COLOUR_SELECT && field?.allowAllPantones) {
    return { kind, fill: pantoneByCode(variation?.value)?.hex || '#cccccc' };
  }
  const ids = parseSelectedOptionIds(variation.value);
  const option = ids.length ? optionById(variation, ids[0]) : null;
  const selected = (variation?.selectedOptions || [])[0];
  return {
    kind,
    fill: normaliseCssColour(
      option?.colour,
      selected?.colour,
      option?.value,
      selected?.value,
      variation?.value,
    ),
  };
}

const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_FUNCTION_COLOUR = /^(rgba?|hsla?)\(/i;

export function normaliseCssColour(...candidates: any[]): string | undefined {
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const raw = String(value).trim();
    if (!raw || /^\d+$/.test(raw)) continue;
    if (HEX_COLOUR.test(raw)) {
      if (raw.length === 4) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
      }
      return raw;
    }
    if (CSS_FUNCTION_COLOUR.test(raw)) return raw;
    if (/^[a-z][a-z\s-]{2,}$/i.test(raw)) return raw;
  }
  return undefined;
}

export function linkedVariationsForTemplate(
  template: any,
  variations: any[],
): any[] {
  const linkedIds = new Set(
    (template?.editedByVariationFields || [])
      .map((field: any) => field?.id)
      .filter((id: any) => id != null)
  );
  if (!linkedIds.size) return [];
  return (variations || []).filter((variation) =>
    linkedIds.has(variation?.variationField?.id)
  );
}

export function variationsForGroup(
  formValues: any,
  groupIndex: number,
): any[] {
  const independent = formValues?.variations || [];
  const group = formValues?.variationsGroups?.[groupIndex]?.variations || [];
  return [...independent, ...group];
}

function variationIndex(variations: any[], fieldId: number): number {
  return (variations || []).findIndex(
    (variation: any) => Number(variation?.variationField?.id) === Number(fieldId)
  );
}

export function variationValuePathForGroup(
  formValues: any,
  fieldId: number,
  groupIndex: number,
): string | null {
  const inGroup = variationIndex(
    formValues?.variationsGroups?.[groupIndex]?.variations,
    fieldId,
  );
  if (inGroup >= 0) {
    return `variationsGroups[${groupIndex}].variations[${inGroup}].value`;
  }
  const top = variationIndex(formValues?.variations, fieldId);
  if (top >= 0) return `variations[${top}].value`;
  return null;
}

function colourKey(value: any): string {
  return (normaliseCssColour(value) || '').toLowerCase();
}

function colourOptions(variation: any): any[] {
  const options = variation?.selectableOptions?.length
    ? variation.selectableOptions
    : variation?.variationField?.options || [];
  return options.filter((option: any) => option && option.available !== false && option.isVisible !== false);
}

function optionColour(option: any): string {
  return colourKey(option?.colour || option?.color || option?.value);
}

export function textColourSwatches(variation: any): { colour: string; label: string }[] | null {
  const type = parseInt(String(variation?.variationField?.fieldType), 10);
  if (type !== FieldType.COLOUR_SELECT && type !== FieldType.PANTONE_COLOUR_SELECT) return null;
  if (type === FieldType.PANTONE_COLOUR_SELECT && variation?.variationField?.allowAllPantones) {
    return null;
  }
  const swatches = colourOptions(variation).map((option: any) => {
    const colour = normaliseCssColour(option?.colour || option?.color || option?.value);
    if (!colour || /^\d+$/.test(colour)) return null;
    return { colour, label: String(option?.value || colour) };
  }).filter(Boolean) as { colour: string; label: string }[];
  return swatches.length ? swatches : null;
}

export function colourChoiceFromFill(variation: any, fill: string): { value: string } | null {
  const field = variation?.variationField;
  const type = parseInt(String(field?.fieldType), 10);
  const colour = colourKey(fill);
  if (!field || !colour) return null;

  if (type === FieldType.COLOUR_PICKER) {
    if (colourKey(variation?.value) === colour) return null;
    return { value: colour };
  }

  if (type !== FieldType.COLOUR_SELECT && type !== FieldType.PANTONE_COLOUR_SELECT) return null;
  if (type === FieldType.PANTONE_COLOUR_SELECT && field.allowAllPantones) return null;
  const match = colourOptions(variation).find((option: any) => optionColour(option) === colour);
  const id = match?.optionId ?? match?.id;
  if (id == null) return null;
  const value = String(id);
  if (String(variation?.value ?? '') === value) return null;
  return { value };
}

function isValidBbox(bbox: any): bbox is number[] {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  const [x, y, w, h] = bbox.map(Number);
  return w > 0 && h > 0 && x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

export function regionsForRole(customisationMap: any, role: string): number[][] {
  const regions = customisationMap?.regions;
  if (!Array.isArray(regions)) return [];
  return regions
    .filter((region: any) => region?.role === role && isValidBbox(region.bbox))
    .map((region: any) => region.bbox.map(Number));
}

export function bboxToPixels(
  bbox: number[],
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const [x, y, w, h] = bbox;
  return {
    x: x * width,
    y: y * height,
    width: w * width,
    height: h * height,
  };
}

export type PixelBox = { x: number; y: number; width: number; height: number };

export function objectBounds(obj: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}): PixelBox {
  const w = (Number(obj.width) || 0) * Math.abs(Number(obj.scaleX) || 1);
  const h = (Number(obj.height) || 0) * Math.abs(Number(obj.scaleY) || 1);
  const rad = ((Number(obj.rotation) || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const signX = (Number(obj.scaleX) || 1) < 0 ? -1 : 1;
  const signY = (Number(obj.scaleY) || 1) < 0 ? -1 : 1;
  const points = [
    [0, 0],
    [w * signX, 0],
    [w * signX, h * signY],
    [0, h * signY],
  ].map(([px, py]) => [
    obj.x + px * cos - py * sin,
    obj.y + px * sin + py * cos,
  ]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function shiftInside(start: number, size: number, limitStart: number, limitSize: number): number {
  if (!(size > 0) || !(limitSize > 0)) return 0;
  if (size >= limitSize) {
    return (limitStart + limitSize / 2) - (start + size / 2);
  }
  if (start < limitStart) return limitStart - start;
  if (start + size > limitStart + limitSize) return limitStart + limitSize - (start + size);
  return 0;
}

export function clampOrigin<T extends {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}>(obj: T, limit: PixelBox): { x: number; y: number } {
  const bounds = objectBounds(obj);
  return {
    x: obj.x + shiftInside(bounds.x, bounds.width, limit.x, limit.width),
    y: obj.y + shiftInside(bounds.y, bounds.height, limit.y, limit.height),
  };
}

export function confineToRegion<T extends {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}>(obj: T, limit: PixelBox): T {
  const bounds = objectBounds(obj);
  const fit = Math.min(
    1,
    limit.width / Math.max(bounds.width, 1),
    limit.height / Math.max(bounds.height, 1),
  );
  const scaled = fit < 0.999
    ? {
      ...obj,
      scaleX: (Number(obj.scaleX) || 1) * fit,
      scaleY: (Number(obj.scaleY) || 1) * fit,
    }
    : obj;
  const pos = clampOrigin(scaled, limit);
  if (pos.x === obj.x && pos.y === obj.y && scaled === obj) return obj;
  return { ...scaled, x: pos.x, y: pos.y };
}

export function movementRegionRole(
  template: any,
  kind: string,
  preferred?: string,
): 'print_area' | 'text_placeholder' | null {
  const map = template?.customisationMap;
  const prefer = preferred === 'print_area' || preferred === 'text_placeholder' ? preferred : null;
  if (prefer && regionsForRole(map, prefer).length) return prefer;
  if (kind === 'text' && regionsForRole(map, 'text_placeholder').length) return 'text_placeholder';
  if ((kind === 'text' || kind === 'image') && regionsForRole(map, 'print_area').length) return 'print_area';
  return null;
}

export function movementLimitForObject(template: any, obj: any): PixelBox | null {
  if (!obj || obj.type === 'rect') return null;
  const binding = obj.merchiFieldId != null
    ? bindingForField(fieldBindingsFrom(template), obj.merchiFieldId)
    : undefined;
  const extraRole = obj.merchiFieldId == null && obj.type === 'text'
    ? additionalEditorFrom(template).textRegionRole
    : undefined;
  const role = movementRegionRole(
    template,
    obj.type,
    binding?.regionRole || extraRole || obj.regionRole,
  );
  if (!role) return null;
  const boxes = regionsForRole(template?.customisationMap, role);
  const index = Number.isInteger(Number(obj?.regionIndex)) ? Number(obj.regionIndex) : 0;
  const box = boxes[index] || boxes[0];
  if (!box) return null;
  const width = Number(template?.width) || DEFAULT_ARTBOARD.width;
  const height = Number(template?.height) || DEFAULT_ARTBOARD.height;
  return bboxToPixels(box, width, height);
}

export function fieldBindingsFrom(template: any): DraftFieldBinding[] {
  const raw = template?.customisationMap?.fieldBindings;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item: any) => item && item.fieldId != null);
}

export function bindingForField(
  bindings: DraftFieldBinding[],
  fieldId: any,
): DraftFieldBinding | undefined {
  const id = Number(fieldId);
  return bindings.find((item) => Number(item.fieldId) === id);
}

export function editorPolicyForField(template: any, fieldId: any): DraftEditorPermissions {
  const editor = bindingForField(fieldBindingsFrom(template), fieldId)?.editor;
  if (!editor || typeof editor !== 'object') return {};
  return editor;
}

export function additionalEditorFrom(template: any): any {
  const raw = template?.customisationMap?.additionalEditor;
  return raw && typeof raw === 'object' ? raw : {};
}

export function editorPolicyForObject(template: any, obj: any): DraftEditorPermissions {
  if (obj?.merchiFieldId != null) return editorPolicyForField(template, obj.merchiFieldId);
  const extra = additionalEditorFrom(template);
  const editor = obj?.type === 'text' ? extra.text : obj?.type === 'image' ? extra.image : null;
  if (!editor || typeof editor !== 'object') return {};
  return editor;
}

export function editorAllows(
  policy: DraftEditorPermissions | undefined,
  key: 'allowRotation' | 'allowScale' | 'allowTextColour' | 'allowTextAlign' | 'allowTextSize',
): boolean {
  return policy?.[key] !== false;
}

export function normaliseAllowedColours(colours: any): string[] {
  if (!Array.isArray(colours)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const colour of colours) {
    const normalised = normaliseCssColour(colour);
    if (!normalised) continue;
    const key = normalised.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function allowedColoursForText(
  template: any,
  textFieldId: any,
  colourFieldId: any,
): string[] {
  const lists = [
    normaliseAllowedColours(editorPolicyForField(template, textFieldId).allowedColours),
    colourFieldId == null
      ? []
      : normaliseAllowedColours(editorPolicyForField(template, colourFieldId).allowedColours),
  ].filter((list) => list.length > 0);
  if (lists.length === 0) return [];
  return lists.slice(1).reduce(
    (current, list) => current.filter((colour) => list.includes(colour)),
    lists[0],
  );
}

export function restrictedColourSwatches(
  swatches: { colour: string; label: string }[] | null,
  allowed: string[],
): { colour: string; label: string }[] | null {
  if (allowed.length === 0) return swatches;
  if (!swatches?.length) {
    return allowed.map((colour) => ({ colour, label: colour }));
  }
  const filtered = swatches.filter((swatch) => (
    allowed.includes(String(swatch.colour || '').toLowerCase())
  ));
  return filtered.length > 0 ? filtered : swatches;
}

function fieldName(field: any): string {
  return String(field?.name || '').toLowerCase();
}

function isColourKind(kind: DraftCanvasObjectType | null): boolean {
  return kind === 'rect';
}

export function inferArtworkRole(
  field: any,
  linkedFields: any[] = [],
): DraftArtworkRole {
  const kind = canvasKindForField(field);
  if (kind === 'image') return 'image';
  if (kind === 'text') return 'text';
  if (!isColourKind(kind)) return 'auto';
  const name = fieldName(field);
  if (/(text|font|letter|copy)/.test(name)) return 'text_fill';
  if (/(wrist|band|base|body|ground|blank)/.test(name)) return 'body_colour_fill';
  const hasText = linkedFields.some(
    (item) => canvasKindForField(item) === 'text'
  );
  return hasText ? 'text_fill' : 'body_colour_fill';
}

export function resolveArtworkRole(
  field: any,
  template: any,
  linkedFields: any[] = [],
): DraftArtworkRole {
  const inferred = inferArtworkRole(field, linkedFields);
  if (inferred === 'body_colour_fill') return 'body_colour_fill';
  const binding = bindingForField(fieldBindingsFrom(template), field?.id);
  if (binding?.role && binding.role !== 'auto') return binding.role;
  return inferred;
}

export function countsAsBackgroundColour(
  field: any,
  template: any,
  linkedFields: any[] = [],
): boolean {
  const binding = bindingForField(fieldBindingsFrom(template), field?.id);
  const role = binding?.role;
  if (role && role !== 'auto') {
    return role === 'body_colour_fill' && canvasKindForField(field) === 'rect';
  }
  return inferArtworkRole(field, linkedFields) === 'body_colour_fill';
}

export type BodyColourMode = 'segmentation' | 'mix';

export function bodyColourStrategy(template: any): BodyColourMode | null {
  const strategy = template?.customisationMap?.bodyColourStrategy;
  return strategy === 'segmentation' || strategy === 'mix' ? strategy : null;
}

function listedBodyColourModes(value: any): BodyColourMode[] {
  if (!Array.isArray(value)) return [];
  const modes: BodyColourMode[] = [];
  value.forEach((item) => {
    if ((item === 'segmentation' || item === 'mix') && !modes.includes(item)) {
      modes.push(item);
    }
  });
  return modes;
}

/** Styles the product builder turned on. A saved strategy counts when no list is stored. */
export function allowedBodyColourModes(template: any): BodyColourMode[] {
  const listed = listedBodyColourModes(template?.customisationMap?.bodyColourModes);
  if (listed.length) return listed;
  const strategy = bodyColourStrategy(template);
  return strategy ? [strategy] : [];
}

export function activeBodyColourMode(
  template: any,
  state?: { bodyColourMode?: string | null } | null,
): BodyColourMode | null {
  const allowed = allowedBodyColourModes(template);
  if (!allowed.length) return null;
  const chosen = state?.bodyColourMode;
  if ((chosen === 'segmentation' || chosen === 'mix') && allowed.includes(chosen)) {
    return chosen;
  }
  const strategy = bodyColourStrategy(template);
  if (strategy && allowed.includes(strategy)) return strategy;
  return allowed[0];
}

export function backgroundColourVariations(
  template: any,
  variations: any[],
  detached?: Set<number> | number[],
): any[] {
  const detachedIds = detached instanceof Set ? detached : new Set(detached || []);
  const linked = linkedVariationsForTemplate(template, variations);
  const linkedFields = linked.map((variation) => variation?.variationField).filter(Boolean);
  const linkOrder = (template?.editedByVariationFields || [])
    .map((field: any) => Number(field?.id))
    .filter((id: number) => !Number.isNaN(id));
  return linked
    .filter((variation) => {
      const field = variation?.variationField;
      const fieldId = field?.id;
      if (fieldId == null || detachedIds.has(fieldId)) return false;
      return countsAsBackgroundColour(field, template, linkedFields);
    })
    .sort((a, b) => {
      const aIndex = linkOrder.indexOf(Number(a?.variationField?.id));
      const bIndex = linkOrder.indexOf(Number(b?.variationField?.id));
      return (aIndex < 0 ? linkOrder.length : aIndex) - (bIndex < 0 ? linkOrder.length : bIndex);
    });
}

export interface BodyColourPanel {
  colours: Array<{ fieldId: number; name: string; fill: string; variation: any }>;
  modes: BodyColourMode[];
  mode: BodyColourMode | null;
}

/** One entry per assigned base colour, plus the styles the builder allows. */
export function bodyColourPanel(
  template: any,
  variations: any[],
  state?: DraftCanvasState | null,
): BodyColourPanel | null {
  if (!template) return null;
  const colours = backgroundColourVariations(template, variations, state?.detachedFieldIds)
    .map((variation) => {
      const field = variation?.variationField;
      const fill = variationCanvasContent(variation).fill;
      if (!fill || field?.id == null) return null;
      return {
        fieldId: Number(field.id),
        name: String(field.name || 'Base colour'),
        fill,
        variation,
      };
    })
    .filter((item): item is BodyColourPanel['colours'][number] => Boolean(item));
  if (colours.length < 2) return null;
  return {
    colours,
    modes: allowedBodyColourModes(template),
    mode: activeBodyColourMode(template, state),
  };
}

export function splitBbox(bbox: number[], count: number): number[][] {
  if (count <= 1) return [bbox];
  const [x, y, w, h] = bbox;
  const alongWidth = w >= h;
  const slices: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    if (alongWidth) {
      const sliceW = w / count;
      slices.push([x + sliceW * index, y, sliceW, h]);
    } else {
      const sliceH = h / count;
      slices.push([x, y + sliceH * index, w, sliceH]);
    }
  }
  return slices;
}

export function bodyColourBounds(template: any): number[] {
  const body = regionsForRole(template?.customisationMap, 'body_colour_fill');
  if (!body.length) {
    const print = regionsForRole(template?.customisationMap, 'print_area');
    return print[0] || [0, 0, 1, 1];
  }
  if (body.length === 1) return body[0];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  body.forEach(([x, y, w, h]) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  });
  return [x0, y0, x1 - x0, y1 - y0];
}

export function bodyColourSliceBoxes(template: any, count: number): number[][] {
  const body = regionsForRole(template?.customisationMap, 'body_colour_fill');
  if (body.length === count && count > 1) return body;
  return splitBbox(bodyColourBounds(template), count);
}

export function swirlUnit(nx: number, ny: number): number {
  const wave = Math.sin(nx * 6 + Math.sin(ny * 4) * 2) * 0.5
    + Math.sin(ny * 5 + nx * 3) * 0.5;
  return Math.min(1, Math.max(0, (wave + 1) / 2));
}

function channel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseCssColour(value: string): [number, number, number] | null {
  const raw = String(value || '').trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const text = hex[1].length === 3
      ? hex[1].split('').map((part) => part + part).join('')
      : hex[1];
    return [
      parseInt(text.slice(0, 2), 16),
      parseInt(text.slice(2, 4), 16),
      parseInt(text.slice(4, 6), 16),
    ];
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function swirlRgb(
  nx: number,
  ny: number,
  colours: Array<[number, number, number]>,
): [number, number, number] {
  if (colours.length <= 1) return colours[0] || [204, 204, 204];
  const position = swirlUnit(nx, ny) * (colours.length - 1);
  const index = Math.min(colours.length - 2, Math.floor(position));
  const fraction = position - index;
  const start = colours[index];
  const end = colours[index + 1];
  return [
    channel(start[0] + (end[0] - start[0]) * fraction),
    channel(start[1] + (end[1] - start[1]) * fraction),
    channel(start[2] + (end[2] - start[2]) * fraction),
  ];
}

export function renderSwirlCanvas(
  width: number,
  height: number,
  fills: string[],
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const colours = fills
    .map((fill) => parseCssColour(fill))
    .filter((colour): colour is [number, number, number] => Boolean(colour));
  if (colours.length < 2) {
    ctx.fillStyle = fills[0] || '#cccccc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const ny = y / Math.max(canvas.height, 1);
    for (let x = 0; x < canvas.width; x += 1) {
      const nx = x / Math.max(canvas.width, 1);
      const [r, g, b] = swirlRgb(nx, ny, colours);
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function paintBodyFillTexture(
  state: DraftCanvasState | null | undefined,
): HTMLCanvasElement | null {
  if (!state || typeof document === 'undefined') return null;
  const swirls = (state.objects || []).filter(
    (obj) => obj.fillStyle === 'swirl' && (obj.fills || []).length > 1,
  );
  const slices = (state.objects || []).filter(
    (obj) => obj.type === 'rect'
      && obj.artworkRole === 'body_colour_fill'
      && obj.fill
      && obj.fillStyle !== 'swirl',
  );
  if (!swirls.length && slices.length < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(state.width));
  canvas.height = Math.max(1, Math.round(state.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  swirls.forEach((obj) => {
    const pattern = renderSwirlCanvas(obj.width, obj.height, obj.fills || []);
    if (pattern) ctx.drawImage(pattern, obj.x, obj.y, obj.width, obj.height);
  });
  slices.forEach((obj) => {
    ctx.fillStyle = obj.fill || '#cccccc';
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
  });
  return canvas;
}

export function inferTextTargetFieldId(
  field: any,
  template: any,
  linkedFields: any[] = [],
): number | undefined {
  const binding = bindingForField(fieldBindingsFrom(template), field?.id);
  if (binding?.targetFieldId != null) return Number(binding.targetFieldId);
  const textField = linkedFields.find(
    (item) => canvasKindForField(item) === 'text' && item?.id != null
  );
  return textField?.id != null ? Number(textField.id) : undefined;
}

export function fitInside(
  box: { x: number; y: number; width: number; height: number },
  contentWidth: number,
  contentHeight: number,
  lockAspectRatio = true,
): { x: number; y: number; width: number; height: number } {
  if (
    !lockAspectRatio
    || !(contentWidth > 0)
    || !(contentHeight > 0)
    || !(box.width > 0)
    || !(box.height > 0)
  ) {
    return { ...box };
  }
  const scale = Math.min(box.width / contentWidth, box.height / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

export function shouldLockImageAspect(field: any, template?: any): boolean {
  const binding = bindingForField(fieldBindingsFrom(template), field?.id);
  if (typeof binding?.lockAspectRatio === 'boolean') return binding.lockAspectRatio;
  if (typeof field?.aspectRatioLock === 'boolean') return field.aspectRatioLock;
  return true;
}

export function isBackgroundFill(obj: { type?: string }): boolean {
  return obj?.type === 'rect';
}

export function canvasPaintOrder<T extends { type?: string }>(objects: T[]): T[] {
  const fills = objects.filter(isBackgroundFill);
  const content = objects.filter((obj) => !isBackgroundFill(obj));
  return [...fills, ...content];
}

export function isFullArtboardFill(
  obj: { x?: number; y?: number; width?: number; height?: number },
  artWidth: number,
  artHeight: number,
): boolean {
  return (
    Number(obj.width) >= artWidth * 0.9
    && Number(obj.height) >= artHeight * 0.9
    && Number(obj.x) <= artWidth * 0.05
    && Number(obj.y) <= artHeight * 0.05
  );
}

export function measureDraftText(
  text: string,
  fontSize = 48,
  fontFamily?: string,
): { width: number; height: number; measured: boolean } {
  const lines = String(text || 'Text').split('\n');
  const size = Math.max(12, Number(fontSize) || 48);
  let width = 0;
  let measured = false;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `normal ${size}px ${cssFontFamily(fontFamily)}`;
        width = Math.max(...lines.map((line) => ctx.measureText(line || ' ').width), 0);
        measured = width > 0;
      }
    } catch {
      measured = false;
    }
  }
  if (!(width > 0)) {
    width = Math.max(...lines.map((line) => (line || ' ').length), 1) * size * 0.62;
  }
  return {
    width: Math.ceil(width + size * 0.16),
    height: Math.ceil(Math.max(1, lines.length) * size * 1.15),
    measured,
  };
}

export function expandTextBox<T extends { x?: number; y?: number; width?: number; height?: number }>(
  obj: T,
  minWidth: number,
  minHeight: number,
): T {
  const currentWidth = Number(obj.width) || 0;
  const currentHeight = Number(obj.height) || 0;
  const width = Math.max(currentWidth, minWidth);
  const height = Math.max(currentHeight, minHeight);
  if (width === currentWidth && height === currentHeight) return obj;
  return {
    ...obj,
    width,
    height,
    x: (Number(obj.x) || 0) + (currentWidth - width) / 2,
    y: (Number(obj.y) || 0) + (currentHeight - height) / 2,
  };
}

export function unclipTextBox<T extends DraftCanvasObject>(obj: T): T {
  if (obj.type !== 'text') return obj;
  const measured = measureDraftText(obj.text || 'Text', obj.fontSize, obj.fontFamily);
  if (!measured.measured) return obj;
  const lines = String(obj.text || 'Text').split('\n').length;
  const lineHeight = Math.max(12, Number(obj.fontSize) || 48);
  const currentHeight = Number(obj.height) || 0;
  const minHeight = currentHeight + 0.5 >= lines * lineHeight ? currentHeight : measured.height;
  return expandTextBox(obj, measured.width, minHeight);
}

export function fitTextBox(
  obj: Pick<DraftCanvasObject, 'x' | 'y' | 'width' | 'height' | 'text' | 'fontSize' | 'fontFamily'>,
): { x: number; y: number; width: number; height: number } {
  const measured = measureDraftText(obj.text || 'Text', obj.fontSize, obj.fontFamily);
  const width = Math.max(24, measured.width);
  const height = Math.max(20, measured.height);
  const prevW = Number(obj.width) > 0 ? Number(obj.width) : width;
  const prevH = Number(obj.height) > 0 ? Number(obj.height) : height;
  return {
    width,
    height,
    x: (Number(obj.x) || 0) + (prevW - width) / 2,
    y: (Number(obj.y) || 0) + (prevH - height) / 2,
  };
}

function placementBoxes(
  role: DraftArtworkRole,
  kind: DraftCanvasObjectType,
  template: any,
  preferred?: string,
): number[][] {
  if (kind !== 'rect' && role !== 'body_colour_fill') {
    const movement = movementRegionRole(template, kind, preferred);
    if (movement) return regionsForRole(template?.customisationMap, movement);
  }
  if (role === 'body_colour_fill' || kind === 'rect') {
    const body = regionsForRole(template?.customisationMap, 'body_colour_fill');
    if (body.length) return body;
    const print = regionsForRole(template?.customisationMap, 'print_area');
    if (print.length) return print;
    return [[0, 0, 1, 1]];
  }
  if (kind === 'text') {
    const placeholders = regionsForRole(template?.customisationMap, 'text_placeholder');
    if (placeholders.length) return placeholders;
    return regionsForRole(template?.customisationMap, 'print_area');
  }
  return regionsForRole(template?.customisationMap, 'print_area');
}

export function defaultPlacement(
  kind: DraftCanvasObjectType,
  index: number,
  artWidth: number,
  artHeight: number,
): { x: number; y: number; width: number; height: number } {
  const pad = Math.max(24, artWidth * 0.04);
  if (kind === 'image') {
    return {
      x: artWidth * 0.2,
      y: artHeight * 0.2,
      width: artWidth * 0.6,
      height: artHeight * 0.6,
    };
  }
  if (kind === 'rect') {
    return { x: 0, y: 0, width: artWidth, height: artHeight };
  }
  return {
    x: pad,
    y: pad + index * Math.max(64, artHeight * 0.08),
    width: artWidth - pad * 2,
    height: Math.max(56, artHeight * 0.07),
  };
}

export function createObjectId(): string {
  return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Placement saved on Variation.textStyle. Only keys the variation actually has. */
export function canvasPatchFromTextStyle(style: any): Partial<DraftCanvasObject> {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return {};
  const patch: Partial<DraftCanvasObject> = {};
  const colour = String(style.colour || style.color || '').trim();
  if (colour) patch.fill = colour;
  const font = String(style.font || style.fontFamily || '').trim();
  if (font) patch.fontFamily = font;
  const align = String(style.align || '').trim();
  if (align) patch.align = align;
  const textSize = Number(style.textSize ?? style.fontSize);
  if (Number.isFinite(textSize)) patch.fontSize = textSize;
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY'] as const) {
    const number = Number(style[key]);
    if (Number.isFinite(number)) patch[key] = number;
  }
  return patch;
}

export function seedOrSyncCanvas(
  existing: DraftCanvasState | null | undefined,
  template: any,
  variations: any[],
): DraftCanvasState {
  const width = Number(template?.width) || DEFAULT_ARTBOARD.width;
  const height = Number(template?.height) || DEFAULT_ARTBOARD.height;
  const detached = new Set(existing?.detachedFieldIds || []);
  const linked = linkedVariationsForTemplate(template, variations);
  const linkedFields = linked.map((variation) => variation?.variationField).filter(Boolean);
  const backgroundVariations = backgroundColourVariations(template, variations, detached);
  const mode = activeBodyColourMode(template, existing);
  const multiBackground = Boolean(mode) && backgroundVariations.length >= 2;
  const multiIds = new Set(
    multiBackground
      ? backgroundVariations.map((variation) => Number(variation?.variationField?.id))
      : [],
  );
  const objects: DraftCanvasObject[] = (existing?.objects || [])
    .filter((obj) => obj.fillStyle !== 'swirl')
    .filter((obj) => obj.merchiFieldId == null || !multiIds.has(Number(obj.merchiFieldId)))
    .map((obj) => {
      if (obj.type !== 'text') return { ...obj };
      if (Number(obj.width) > 1 && Number(obj.height) > 1) return { ...obj };
      return { ...obj, ...fitTextBox(obj) };
    });
  const usedRegions: Record<string, number> = {};

  for (const variation of linked) {
    const field = variation?.variationField;
    if (resolveArtworkRole(field, template, linkedFields) !== 'text_fill') continue;
    const index = objects.findIndex(
      (obj) => obj.merchiFieldId === field?.id && obj.type === 'rect'
    );
    if (index >= 0) objects.splice(index, 1);
  }

  const applyColourToText = (targetFieldId: number | undefined, fill?: string, colourFieldId?: number) => {
    if (!fill || targetFieldId == null) return false;
    const textObj = objects.find((obj) => obj.merchiFieldId === targetFieldId && obj.type === 'text');
    if (!textObj) return false;
    textObj.fill = fill;
    textObj.colourFieldId = colourFieldId;
    return true;
  };

  const placeObject = (
    kind: DraftCanvasObjectType,
    role: DraftArtworkRole,
    field: any,
    fieldId: number,
    content: ReturnType<typeof variationCanvasContent>,
    textStyle?: any,
  ) => {
    const binding = bindingForField(fieldBindingsFrom(template), fieldId);
    const boxes = placementBoxes(role, kind, template, binding?.regionRole);
    const movement = movementRegionRole(template, kind, binding?.regionRole);
    const key = `${movement || role}:${kind}`;
    const regionIndex = usedRegions[key] || 0;
    usedRegions[key] = regionIndex + 1;
    const box = boxes[regionIndex] || boxes[0];
    const place = box
      ? bboxToPixels(box, width, height)
      : defaultPlacement(kind, objects.length, width, height);
    const lockAspectRatio = kind === 'image' ? shouldLockImageAspect(field, template) : undefined;
    const next: DraftCanvasObject = {
      id: createObjectId(),
      type: kind,
      merchiFieldId: fieldId,
      artworkRole: role,
      regionRole: movement || undefined,
      regionIndex: movement ? regionIndex : undefined,
      locked: kind === 'rect',
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      lockAspectRatio,
      ...place,
      text: content.text,
      src: content.src,
      fill: content.fill || (kind === 'text' ? '#111111' : undefined),
      fontFamily: kind === 'text' ? DEFAULT_DRAFT_FONT : undefined,
      fontSize: Math.max(28, Math.round(place.height * 0.62)),
    };
    if (kind === 'text') {
      const saved = canvasPatchFromTextStyle(textStyle);
      Object.assign(next, saved);
      if (saved.width == null && saved.height == null) {
        const fitted = fitTextBox(next);
        next.width = fitted.width;
        next.height = fitted.height;
        if (saved.x == null) next.x = fitted.x;
        if (saved.y == null) next.y = fitted.y;
      }
    }
    const limit = movementLimitForObject(template, next);
    if (limit && kind !== 'rect') {
      const embroidery = parseInt(String(field?.fieldType), 10) === FieldType.EMBROIDERY;
      Object.assign(
        next,
        embroidery ? { ...clampOrigin(next, limit) } : confineToRegion(next, limit),
      );
    }
    if (kind === 'rect') objects.unshift(next);
    else objects.push(next);
  };

  const holdInside = (
    obj: DraftCanvasObject,
    kind: DraftCanvasObjectType,
    field: any,
    shrink: boolean,
  ) => {
    if (kind === 'rect') return;
    const binding = bindingForField(fieldBindingsFrom(template), field?.id);
    const movement = movementRegionRole(template, kind, binding?.regionRole);
    if (!movement) return;
    const key = `${movement}:${kind}`;
    const regionIndex = usedRegions[key] || 0;
    usedRegions[key] = regionIndex + 1;
    obj.regionRole = movement;
    obj.regionIndex = regionIndex;
    const limit = movementLimitForObject(template, obj);
    if (!limit) return;
    if (shrink) {
      Object.assign(obj, confineToRegion(obj, limit));
      return;
    }
    const pos = clampOrigin(obj, limit);
    obj.x = pos.x;
    obj.y = pos.y;
  };

  for (const variation of linked) {
    const field = variation?.variationField;
    const fieldId = field?.id;
    const content = variationCanvasContent(variation);
    if (!content.kind || fieldId == null || detached.has(fieldId) || multiIds.has(Number(fieldId))) continue;
    const role = resolveArtworkRole(field, template, linkedFields);
    if (role === 'text_fill') continue;

    const found = objects.find((obj) => obj.merchiFieldId === fieldId);
    if (found) {
      if (parseInt(String(field?.fieldType), 10) === FieldType.EMBROIDERY) {
        const parsed = parseEmbroideryValue(variation?.value);
        const px = embroideryPixels(
          Number(parsed?.widthMm),
          Number(parsed?.heightMm),
          template,
        );
        if (px) {
          found.width = px.width;
          found.height = px.height;
          found.scaleX = (Number(found.scaleX) || 1) < 0 ? -1 : 1;
          found.scaleY = (Number(found.scaleY) || 1) < 0 ? -1 : 1;
        }
        if (content.kind === 'text') found.text = content.text || found.text;
        if (content.kind === 'image' && content.src) found.src = content.src;
        holdInside(found, content.kind, field, false);
        continue;
      }
      if (content.kind === 'text' && content.text != null) {
        const textChanged = found.text !== content.text;
        found.text = content.text;
        if (textChanged) Object.assign(found, fitTextBox(found));
      }
      if (content.kind === 'image' && content.src) found.src = content.src;
      if (content.kind === 'rect' && content.fill) found.fill = content.fill;
      if (found.type === 'image') {
        found.lockAspectRatio = shouldLockImageAspect(field, template);
      }
      if (found.type === 'rect') {
        found.locked = true;
        found.artworkRole = role;
      }
      holdInside(found, content.kind, field, content.kind === 'text');
      continue;
    }

    if (content.kind === 'text' && !content.text) continue;
    if (content.kind === 'image' && !content.src) continue;
    if (content.kind === 'rect' && !content.fill) continue;
    placeObject(content.kind, role, field, fieldId, content, variation?.textStyle);
  }

  for (const variation of linked) {
    const field = variation?.variationField;
    const fieldId = field?.id;
    const content = variationCanvasContent(variation);
    if (fieldId == null || detached.has(fieldId) || !content.fill) continue;
    const role = resolveArtworkRole(field, template, linkedFields);
    if (role !== 'text_fill') continue;
    const targetId = inferTextTargetFieldId(field, template, linkedFields);
    applyColourToText(targetId, content.fill, fieldId);
  }

  if (multiBackground) {
    const paints = backgroundVariations
      .map((variation) => {
        const content = variationCanvasContent(variation);
        return {
          fieldId: Number(variation?.variationField?.id),
          fill: content.fill,
        };
      })
      .filter((item) => item.fill);
    const bounds = bodyColourBounds(template);
    const boundsPx = bboxToPixels(bounds, width, height);
    const multiplyFill = isFullArtboardFill(boundsPx, width, height);
    const previousObjects = existing?.objects || [];
    if (mode === 'mix' && paints.length >= 2) {
      const previous = previousObjects.find((obj) => obj.fillStyle === 'swirl');
      objects.unshift({
        id: previous?.id || createObjectId(),
        type: 'rect',
        artworkRole: 'body_colour_fill',
        fillStyle: 'swirl',
        fills: paints.map((item) => item.fill as string),
        fill: paints[0].fill,
        multiplyFill,
        locked: true,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        ...boundsPx,
      });
    } else if (mode === 'segmentation' && paints.length >= 2) {
      const boxes = bodyColourSliceBoxes(template, paints.length);
      const slices = paints.map((item, index) => {
        const box = boxes[index] || boxes[0];
        const previous = previousObjects.find((obj) => (
          obj.type === 'rect' && Number(obj.merchiFieldId) === item.fieldId
        ));
        return {
          id: previous?.id || createObjectId(),
          type: 'rect' as const,
          merchiFieldId: item.fieldId,
          artworkRole: 'body_colour_fill' as const,
          fill: item.fill,
          multiplyFill,
          locked: true,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          ...bboxToPixels(box, width, height),
        };
      });
      objects.unshift(...slices);
    }
  }

  return {
    width,
    height,
    objects,
    detachedFieldIds: Array.from(detached),
    bodyColourMode: multiBackground ? mode || undefined : undefined,
  };
}

export function detachField(
  state: DraftCanvasState,
  objectId: string,
): DraftCanvasState {
  const target = state.objects.find((obj) => obj.id === objectId);
  const detachedFieldIds = [...(state.detachedFieldIds || [])];
  if (target?.merchiFieldId != null && !detachedFieldIds.includes(target.merchiFieldId)) {
    detachedFieldIds.push(target.merchiFieldId);
  }
  return {
    ...state,
    objects: state.objects.filter((obj) => obj.id !== objectId),
    detachedFieldIds,
  };
}

export function printAreaGuides(template: any): Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
}> {
  const width = Number(template?.width) || DEFAULT_ARTBOARD.width;
  const height = Number(template?.height) || DEFAULT_ARTBOARD.height;
  const guides = [
    ...regionsForRole(template?.customisationMap, 'print_area').map((bbox) => ({
      ...bboxToPixels(bbox, width, height),
      stroke: '#2563eb',
    })),
    ...regionsForRole(template?.customisationMap, 'text_placeholder').map((bbox) => ({
      ...bboxToPixels(bbox, width, height),
      stroke: '#d97706',
    })),
  ];
  return guides;
}
