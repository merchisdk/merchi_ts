'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaArrowDown,
  FaArrowUp,
  FaCheck,
  FaChevronDown,
  FaChevronUp,
  FaClone,
  FaCloudUploadAlt,
  FaEllipsisH,
  FaExchangeAlt,
  FaFillDrip,
  FaFont,
  FaGripVertical,
  FaImage,
  FaLayerGroup,
  FaLock,
  FaMousePointer,
  FaPlus,
  FaRedo,
  FaUndo,
  FaUnlock,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import { useMerchiFormContext } from '../../context/MerchiProductFormProvider';
import {
  canvasPaintOrder,
  allowedColoursForText,
  bodyColourPanel,
  colourChoiceFromFill,
  confineToRegion,
  createObjectId,
  editorAllows,
  editorPolicyForField,
  editorPolicyForObject,
  designGroupCount,
  detachField,
  fitTextBox,
  isBackgroundFill,
  movementLimitForObject,
  productHasVariationGroups,
  normaliseAllowedColours,
  restrictedColourSwatches,
  seedOrSyncCanvas,
  templatesForGroup,
  textColourSwatches,
  unclipTextBox,
  variationValuePathForGroup,
  variationsForGroup,
} from '../../utils/draftTemplates';
import {
  EMBROIDERY,
  embroideryMillimetres,
  embroideryValueJson,
  parseEmbroideryValue,
  variationValuePath,
} from '../../utils/embroidery';
import {
  loadDrafts,
  pruneDrafts,
  saveDrafts,
  savedPreview,
  upsertGroupTemplateDraft,
} from '../../utils/draftStorage';
import { exportDraftPngs, templateImageSources } from '../../utils/draftExport';
import type { PreviewSurfaceBinding } from './DraftProductPreview';
import { productAllowsAdditionalDesignObjects } from '../../utils/designerInputs';
import {
  DraftCanvasHandle,
  DraftCanvasObject,
  DraftCanvasState,
  FieldType,
} from '../../utils/types';
import {
  DEFAULT_DRAFT_FONT,
  DRAFT_TEXT_FONTS,
  cssFontFamily,
  ensureDraftFonts,
  loadDraftFonts,
} from '../../utils/draftFonts';

const DraftCanvas = React.lazy(() => import('./DraftCanvas'));
const DraftProductPreview = React.lazy(() => import('./DraftProductPreview'));

class DraftCanvasBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Canvas failed to load',
    };
  }

  render() {
    if (this.state.error) {
      return (
        <div className='merchi-product-draft-canvas-fallback'>
          {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function stopBubble(event: React.SyntheticEvent) {
  event.stopPropagation();
}

interface Props {
  open: boolean;
  initialGroupIndex?: number;
  onClose: () => void;
  onSaved: () => void;
}

function templateSrc(template: any, apiUrl?: string): string[] {
  return templateImageSources(template, apiUrl);
}

function surfaceBindings(model: any): PreviewSurfaceBinding[] {
  return (model?.previewSurfaces || []).map((surface: any) => ({
    materialName: surface.materialName || surface.material_name,
    role: surface.role,
    regionIndex: Number(surface.regionIndex ?? surface.region_index) || 0,
    templateId: surface.draftTemplate?.id ?? surface.draftTemplateId ?? null,
  })).filter((surface: PreviewSurfaceBinding) => Boolean(surface.materialName));
}

const QUICK_COLOURS = [
  '#ffffff',
  '#000000',
  '#2f3cc2',
  '#facc15',
  '#ef4444',
  '#dbeafe',
  '#f28c28',
  '#2f9e5b',
];

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

const TEXT_SIZES = [12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144, 180, 240];

const TEXT_ALIGNMENTS = [
  { value: 'left', label: 'Align left', Icon: FaAlignLeft },
  { value: 'center', label: 'Align centre', Icon: FaAlignCenter },
  { value: 'right', label: 'Align right', Icon: FaAlignRight },
];

const HISTORY_LIMIT = 50;
/** Rapid edits to the same field (typing, colour dragging) collapse into one undo step. */
const HISTORY_MERGE_MS = 1000;

type LayerDropPlace = 'above' | 'below';

interface CanvasHistory {
  past: DraftCanvasState[];
  future: DraftCanvasState[];
  mergeKey: string | null;
  mergedAt: number;
}

function emptyHistory(): CanvasHistory {
  return { past: [], future: [], mergeKey: null, mergedAt: 0 };
}

function LayerIcon({ obj }: { obj: DraftCanvasObject }) {
  if (obj.type === 'text') return <FaFont />;
  if (obj.type === 'image') return <FaImage />;
  return <FaFillDrip />;
}

function sameColour(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function ColourPicker({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: string;
  onChange: (colour: string) => void;
  choices?: { colour: string; label: string }[] | null;
}) {
  const swatches = choices?.length
    ? choices
    : QUICK_COLOURS.map((colour) => ({ colour, label: colour }));
  const chosen = swatches.some((swatch) => sameColour(swatch.colour, value));
  return (
    <div className='merchi-product-draft-field'>
      <span className='merchi-product-draft-field-label'>{label}</span>
      <div className='merchi-product-draft-swatches' role='group' aria-label={label}>
        {swatches.map((swatch) => {
          const active = sameColour(swatch.colour, value);
          return (
            <button
              key={`${swatch.label}:${swatch.colour}`}
              type='button'
              className={`merchi-product-draft-swatch${active ? ' is-active' : ''}`}
              style={{ backgroundColor: swatch.colour }}
              aria-label={swatch.label}
              aria-pressed={active}
              onClick={() => onChange(swatch.colour)}
            >
              {active ? <FaCheck /> : null}
            </button>
          );
        })}
        {choices?.length ? null : (
          <label
            className={`merchi-product-draft-swatch is-custom${chosen ? '' : ' is-active'}`}
            style={chosen ? undefined : { backgroundColor: value }}
          >
            <span className='merchi-sr-only'>Custom colour</span>
            {chosen ? <FaPlus /> : <FaCheck />}
            <input
              type='color'
              value={HEX_COLOUR.test(value) ? value : '#111111'}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function visualTextSize(obj: DraftCanvasObject): { width: number; height: number } {
  return {
    width: obj.width * Math.abs(Number(obj.scaleX) || 1),
    height: obj.height * Math.abs(Number(obj.scaleY) || 1),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function DraftDesignerSheet({
  open,
  initialGroupIndex = 0,
  onClose,
  onSaved,
}: Props) {
  const {
    apiUrl,
    classNameDraftSheet,
    getQuote,
    hookForm,
    product,
  } = useMerchiFormContext();
  const formValues = hookForm.watch();
  const allowAdditionalObjects = productAllowsAdditionalDesignObjects(product);
  const hasGroups = productHasVariationGroups(product);
  const groupCount = designGroupCount(product, formValues);
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [state, setState] = useState<DraftCanvasState>({
    width: 1000,
    height: 1000,
    objects: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'design' | 'product'>('design');
  const [dragOver, setDragOver] = useState(false);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; place: LayerDropPlace } | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [layerMenuPos, setLayerMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<DraftCanvasHandle>(null);
  const layerRefs = useRef<Record<string, HTMLElement | null>>({});
  const touchDragRef = useRef<{ id: string; y: number; moved: boolean; hint: { id: string; place: LayerDropPlace } | null } | null>(null);
  const sheetDragRef = useRef<{ y: number; dy: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const faceCanvasesRef = useRef<Record<string, DraftCanvasState>>({});
  const canvasOwnerRef = useRef<string | null>(null);
  const historyRef = useRef<CanvasHistory>(emptyHistory());
  const linkedFormSnapshot = useRef<{ path: string; value: string; quote: boolean }[]>([]);

  const templates = useMemo(
    () => templatesForGroup(
      product,
      formValues?.variations || [],
      formValues?.variationsGroups?.[groupIndex]?.variations || [],
    ),
    [product, formValues, groupIndex],
  );
  const template = templates[Math.min(templateIndex, templates.length - 1)] || templates[0];
  const previewModel = (product?.previewModels || [])[0];
  const previewModelUrl = templateImageSources({ file: previewModel?.file }, apiUrl)[0] || '';
  const previewSurfaces = useMemo(
    () => surfaceBindings(previewModel),
    [previewModel],
  );
  const textureStates = useMemo(() => {
    const drafts = open && product?.id ? loadDrafts(product.id) : [];
    const variations = variationsForGroup(formValues, groupIndex);
    const map: Record<string, DraftCanvasState> = {};
    templates.forEach((item: any) => {
      if (item?.id == null) return;
      if (item.id === template?.id) {
        map[item.id] = state;
        return;
      }
      // The live canvas belongs to the open template. Other faces still need
      // their linked background colour before anyone selects them.
      const remembered = faceCanvasesRef.current[`${groupIndex}:${item.id}`];
      const saved = savedPreview(drafts, groupIndex, item.id);
      map[item.id] = seedOrSyncCanvas(
        remembered || saved?.canvasJson || null,
        item,
        variations,
      );
    });
    return map;
  }, [open, product?.id, templates, template?.id, state, groupIndex, formValues]);
  const fixedSizeFieldIds = useMemo(
    () => variationsForGroup(formValues, groupIndex)
      .filter((item: any) => Number(item?.variationField?.fieldType) === EMBROIDERY)
      .map((item: any) => Number(item?.variationField?.id))
      .filter((id: number) => Number.isFinite(id)),
    [formValues, groupIndex],
  );

  useEffect(() => {
    if (open) setGroupIndex(initialGroupIndex);
  }, [open, initialGroupIndex]);

  useEffect(() => {
    if (!open) return;
    const values = hookForm.getValues();
    const groupCount = values?.variationsGroups?.length || 1;
    const entries: { path: string; value: string; quote: boolean }[] = [];
    for (let index = 0; index < groupCount; index += 1) {
      for (const variation of variationsForGroup(values, index)) {
        const id = Number(variation?.variationField?.id);
        const type = Number(variation?.variationField?.fieldType);
        const quote = type === FieldType.COLOUR_PICKER
          || type === FieldType.COLOUR_SELECT
          || type === FieldType.PANTONE_COLOUR_SELECT;
        const text = type === FieldType.TEXT_INPUT || type === FieldType.TEXT_AREA;
        if (!quote && !text) continue;
        const path = variationValuePathForGroup(values, id, index);
        if (!path || entries.some((entry) => entry.path === path)) continue;
        entries.push({
          path,
          value: variation?.value == null ? '' : String(variation.value),
          quote,
        });
      }
    }
    linkedFormSnapshot.current = entries;
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmClose(false);
  }, [open]);

  useEffect(() => {
    if (open) ensureDraftFonts();
  }, [open]);

  const variationSyncKey = JSON.stringify(
    variationsForGroup(formValues, groupIndex).map((variation: any) => ({
      id: variation?.variationField?.id,
      value: variation?.value,
      files: (variation?.variationFiles || []).map(
        (file: any) => file?.viewUrl || file?.id
      ),
    }))
  );

  useEffect(() => {
    if (!open || !template) return;
    const key = `${groupIndex}:${template.id}`;
    canvasOwnerRef.current = key;
    const remembered = faceCanvasesRef.current[key];
    const drafts = loadDrafts(product.id);
    const saved = savedPreview(drafts, groupIndex, template.id);
    const variations = variationsForGroup(formValues, groupIndex);
    replaceState(seedOrSyncCanvas(remembered || saved?.canvasJson || null, template, variations));
    historyRef.current = emptyHistory();
    refreshHistoryFlags();
    setSelectedId(null);
    setEditingTextId(null);
    setMobileLayersOpen(false);
    setMobileSheetOpen(false);
    setError(null);
    // Reload the saved canvas when switching group/template, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupIndex, template?.id, product?.id]);

  useEffect(() => {
    if (!open || !template) return;
    const variations = variationsForGroup(formValues, groupIndex);
    const current = stateRef.current;
    const next = seedOrSyncCanvas(current, template, variations);
    const same = current.width === next.width
      && current.height === next.height
      && current.objects.length === next.objects.length
      && current.objects.every((obj, index) => {
        const other = next.objects[index];
        return obj.id === other.id
          && obj.text === other.text
          && obj.src === other.src
          && obj.fill === other.fill
          && obj.fillStyle === other.fillStyle
          && JSON.stringify(obj.fills || []) === JSON.stringify(other.fills || [])
          && obj.width === other.width
          && obj.height === other.height
          && obj.merchiFieldId === other.merchiFieldId;
      })
      && current.bodyColourMode === next.bodyColourMode;
    if (!same) replaceState(next);
  }, [open, variationSyncKey, template?.id, groupIndex]);

  const textMeasureKey = state.objects
    .filter((obj) => obj.type === 'text')
    .map((obj) => `${obj.id}\0${obj.text}\0${obj.fontSize}\0${obj.fontFamily}`)
    .join('\n');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const families = stateRef.current.objects
      .filter((obj) => obj.type === 'text')
      .map((obj) => obj.fontFamily || DEFAULT_DRAFT_FONT);
    const fit = () => {
      if (cancelled) return;
      const current = stateRef.current;
      const embroideryIds = new Set(
        variationsForGroup(hookForm.getValues(), groupIndex)
          .filter((item: any) => Number(item?.variationField?.fieldType) === EMBROIDERY)
          .map((item: any) => Number(item?.variationField?.id))
      );
      let changed = false;
      const objects = current.objects.map((obj) => {
        if (obj.merchiFieldId != null && embroideryIds.has(Number(obj.merchiFieldId))) return obj;
        const next = unclipTextBox(obj);
        if (next !== obj) changed = true;
        return next;
      });
      if (!changed) return;
      const next = { ...current, objects };
      syncEmbroideryFields(next, current);
      replaceState(next);
    };
    loadDraftFonts(families).then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [open, textMeasureKey, groupIndex]);

  function replaceState(next: DraftCanvasState) {
    stateRef.current = next;
    if (canvasOwnerRef.current) faceCanvasesRef.current[canvasOwnerRef.current] = next;
    setState(next);
  }

  function refreshHistoryFlags() {
    const history = historyRef.current;
    setHistoryFlags({ undo: history.past.length > 0, redo: history.future.length > 0 });
  }

  function commit(next: DraftCanvasState, mergeKey?: string) {
    const current = stateRef.current;
    if (next === current) return;
    const history = historyRef.current;
    const now = Date.now();
    const merge = mergeKey != null
      && history.mergeKey === mergeKey
      && now - history.mergedAt < HISTORY_MERGE_MS;
    if (!merge) history.past = [...history.past, current].slice(-HISTORY_LIMIT);
    history.future = [];
    history.mergeKey = mergeKey ?? null;
    history.mergedAt = now;
    replaceState(next);
    refreshHistoryFlags();
  }

  function restore(target: DraftCanvasState) {
    syncEmbroideryFields(target, stateRef.current);
    for (const obj of target.objects) {
      if (obj.type !== 'text') continue;
      if (obj.merchiFieldId != null && typeof obj.text === 'string') {
        syncLinkedText(obj.merchiFieldId, obj.text);
      }
      if (obj.colourFieldId != null && obj.fill) {
        syncLinkedTextColour(obj.colourFieldId, obj.fill);
      }
    }
    const variations = variationsForGroup(hookForm.getValues(), groupIndex);
    replaceState(template ? seedOrSyncCanvas(target, template, variations) : target);
    historyRef.current.mergeKey = null;
    refreshHistoryFlags();
  }

  function undo() {
    const history = historyRef.current;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    history.past = history.past.slice(0, -1);
    history.future = [stateRef.current, ...history.future];
    restore(previous);
  }

  function redo() {
    const history = historyRef.current;
    const following = history.future[0];
    if (!following) return;
    history.future = history.future.slice(1);
    history.past = [...history.past, stateRef.current].slice(-HISTORY_LIMIT);
    restore(following);
  }

  function handleCanvasChange(next: DraftCanvasState) {
    syncEmbroideryFields(next, stateRef.current);
    commit(next);
  }

  function syncEmbroideryFields(next: DraftCanvasState, previous: DraftCanvasState) {
    const variations = variationsForGroup(hookForm.getValues(), groupIndex);
    let wrote = false;
    for (const obj of next.objects) {
      if (obj.merchiFieldId == null) continue;
      const before = previous.objects.find((item) => item.id === obj.id);
      const visual = visualTextSize(obj);
      const previousVisual = before ? visualTextSize(before) : null;
      if (
        previousVisual
        && previousVisual.width === visual.width
        && previousVisual.height === visual.height
      ) continue;
      const variation = variations.find(
        (item: any) => Number(item?.variationField?.id) === Number(obj.merchiFieldId)
      );
      if (Number(variation?.variationField?.fieldType) !== 16) continue;
      const mm = embroideryMillimetres(visual.width, visual.height, template);
      if (!mm) continue;
      const path = variationValuePath(hookForm.getValues(), obj.merchiFieldId);
      if (!path) continue;
      const parsed = parseEmbroideryValue(variation?.value) || {};
      hookForm.setValue(path, embroideryValueJson({ ...parsed, ...mm }), { shouldDirty: true });
      wrote = true;
    }
    if (wrote) Promise.resolve().then(() => getQuote());
  }

  const selected = state.objects.find((obj) => obj.id === selectedId) || null;
  const bodyPanel = bodyColourPanel(
    template,
    variationsForGroup(formValues, groupIndex),
    state,
  );
  const layers = useMemo(() => canvasPaintOrder(state.objects).reverse(), [state.objects]);
  const imagePanelVisible = selected?.type === 'image' || (!selected && imagePanelOpen);

  useEffect(() => {
    if (selectedId && !state.objects.some((obj) => obj.id === selectedId)) {
      setSelectedId(null);
      setEditingTextId(null);
    }
  }, [selectedId, state.objects]);

  useEffect(() => {
    const row = selectedId ? layerRefs.current[selectedId] : null;
    const list = row?.parentElement;
    if (!row || !list) return;
    const rowBox = row.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    if (rowBox.top < listBox.top) list.scrollTop -= listBox.top - rowBox.top;
    else if (rowBox.bottom > listBox.bottom) list.scrollTop += rowBox.bottom - listBox.bottom;
  }, [selectedId]);

  useEffect(() => {
    setLayerMenuOpen(false);
  }, [selectedId, layersCollapsed]);

  useEffect(() => {
    if (!layerMenuOpen) return undefined;
    function close(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.merchi-product-draft-layer-menu, .merchi-product-draft-layer-more')) return;
      setLayerMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [layerMenuOpen]);

  function selectObject(id: string | null) {
    setSelectedId(id);
    setEditingTextId(null);
    setImagePanelOpen(false);
    if (id == null) setMobileSheetOpen(false);
    else setMobileSheetOpen(true);
  }

  function closeMobileSheet() {
    setMobileLayersOpen(false);
    setImagePanelOpen(false);
    setMobileSheetOpen(false);
    setEditingTextId(null);
  }

  function layerName(obj: DraftCanvasObject): string {
    if (obj.type === 'text') return String(obj.text || '').trim() || 'Text';
    const field = obj.merchiFieldId == null
      ? null
      : variationsForGroup(formValues, groupIndex).find(
        (item: any) => Number(item?.variationField?.id) === Number(obj.merchiFieldId)
      )?.variationField;
    if (obj.type === 'image') return obj.name || field?.name || 'Image';
    return field?.name || 'Base colour';
  }

  function layerKind(obj: DraftCanvasObject): string {
    if (obj.type === 'text') return 'Text';
    return obj.type === 'image' ? 'Image' : 'Colour';
  }

  function setBackgroundColour(fieldId: number, fill: string) {
    const values = hookForm.getValues();
    const variation = variationsForGroup(values, groupIndex).find(
      (item: any) => Number(item?.variationField?.id) === Number(fieldId)
    );
    const choice = colourChoiceFromFill(variation, fill);
    const path = variationValuePathForGroup(values, fieldId, groupIndex);
    if (!choice || !path) return;
    hookForm.setValue(path, choice.value, { shouldDirty: true });
    Promise.resolve().then(() => getQuote());
  }

  function applyBodyColourMode(mode: 'segmentation' | 'mix') {
    if (!template || bodyPanel?.mode === mode) return;
    const variations = variationsForGroup(hookForm.getValues(), groupIndex);
    const next = seedOrSyncCanvas(
      { ...stateRef.current, bodyColourMode: mode },
      template,
      variations,
    );
    commit(next);
    const keep = next.objects.find((obj) => obj.id === selectedId)
      || next.objects.find((obj) => obj.type === 'rect');
    if (keep) setSelectedId(keep.id);
  }

  function syncLinkedTextColour(colourFieldId: number, fill: string) {
    const values = hookForm.getValues();
    const variation = variationsForGroup(values, groupIndex).find(
      (item: any) => Number(item?.variationField?.id) === Number(colourFieldId)
    );
    const choice = colourChoiceFromFill(variation, fill);
    const path = variationValuePathForGroup(values, colourFieldId, groupIndex);
    if (!choice || !path) return;
    hookForm.setValue(path, choice.value, { shouldDirty: true });
    Promise.resolve().then(() => getQuote());
  }

  function syncLinkedText(fieldId: number, text: string) {
    const values = hookForm.getValues();
    const variation = variationsForGroup(values, groupIndex).find(
      (item: any) => Number(item?.variationField?.id) === Number(fieldId)
    );
    const type = Number(variation?.variationField?.fieldType);
    if (type !== FieldType.TEXT_INPUT && type !== FieldType.TEXT_AREA) return;
    if (String(variation?.value ?? '') === text) return;
    const path = variationValuePathForGroup(values, fieldId, groupIndex);
    if (!path) return;
    hookForm.setValue(path, text, { shouldDirty: true });
  }

  function policyFor(obj?: DraftCanvasObject | null) {
    return editorPolicyForObject(template, obj);
  }

  function settleAdded(obj: DraftCanvasObject): DraftCanvasObject {
    const limit = movementLimitForObject(template, obj);
    return limit ? { ...obj, ...confineToRegion(obj, limit) } : obj;
  }

  function patchSelected(patch: Partial<DraftCanvasObject>) {
    if (!selectedId) return;
    const current = stateRef.current;
    const target = current.objects.find((obj) => obj.id === selectedId);
    const policy = policyFor(target);
    const nextPatch = { ...patch };
    if (!editorAllows(policy, 'allowTextColour')) delete nextPatch.fill;
    if (!editorAllows(policy, 'allowTextAlign')) delete nextPatch.align;
    if (!editorAllows(policy, 'allowTextSize')) delete nextPatch.fontSize;
    if (Object.keys(nextPatch).length === 0) return;
    commit({
      ...current,
      objects: current.objects.map((obj) => {
        if (obj.id !== selectedId) return obj;
        let next = { ...obj, ...nextPatch };
        if (
          next.type === 'text'
          && ('text' in nextPatch || 'fontSize' in nextPatch || 'fontFamily' in nextPatch)
        ) {
          next = { ...next, ...fitTextBox(next) };
        }
        const limit = movementLimitForObject(template, next);
        return limit ? { ...next, ...confineToRegion(next, limit) } : next;
      }),
    }, `${selectedId}:${Object.keys(nextPatch).sort().join(',')}`);
    if (
      target?.type === 'text'
      && target.colourFieldId != null
      && nextPatch.fill
    ) {
      syncLinkedTextColour(target.colourFieldId, nextPatch.fill);
    }
    if (
      target?.type === 'text'
      && target.merchiFieldId != null
      && typeof nextPatch.text === 'string'
    ) {
      syncLinkedText(target.merchiFieldId, nextPatch.text);
    }
  }

  function addText() {
    const id = createObjectId();
    const colours = normaliseAllowedColours(
      editorPolicyForObject(template, { type: 'text' }).allowedColours,
    );
    const drafted: DraftCanvasObject = {
      id,
      type: 'text',
      x: state.width * 0.5,
      y: state.height * 0.35,
      width: 1,
      height: 1,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text: 'Your text',
      fontSize: 56,
      fontFamily: DEFAULT_DRAFT_FONT,
      fill: colours[0] || '#111111',
      align: 'left',
    };
    const obj = settleAdded({ ...drafted, ...fitTextBox(drafted) });
    const current = stateRef.current;
    commit({ ...current, objects: [...current.objects, obj] });
    setSelectedId(id);
    setEditingTextId(id);
  }

  async function addImage(file: File) {
    const src = await readFileAsDataUrl(file);
    const id = createObjectId();
    const obj: DraftCanvasObject = {
      id,
      type: 'image',
      x: state.width * 0.2,
      y: state.height * 0.2,
      width: state.width * 0.6,
      height: state.height * 0.6,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      src,
      name: file.name || undefined,
      lockAspectRatio: true,
    };
    const placed = settleAdded(obj);
    const current = stateRef.current;
    commit({ ...current, objects: [...current.objects, placed] });
    setSelectedId(id);
    setEditingTextId(null);
  }

  function removeSelected() {
    if (!selectedId) return;
    commit(detachField(stateRef.current, selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  }

  const canDuplicate = allowAdditionalObjects && !!selected && selected.type !== 'rect';

  function duplicateSelected() {
    const current = stateRef.current;
    const source = current.objects.find((obj) => obj.id === selectedId);
    if (!allowAdditionalObjects || !source || source.type === 'rect') return;
    const copy: DraftCanvasObject = {
      ...source,
      id: createObjectId(),
      x: source.x + 24,
      y: source.y + 24,
    };
    delete copy.merchiFieldId;
    delete copy.colourFieldId;
    delete copy.artworkRole;
    delete copy.locked;
    if (copy.type === 'text') Object.assign(copy, fitTextBox(copy));
    const objects = [...current.objects];
    objects.splice(objects.indexOf(source) + 1, 0, copy);
    commit({ ...current, objects });
    setSelectedId(copy.id);
    setEditingTextId(null);
  }

  const shortcutsRef = useRef({ undo, redo, duplicateSelected });
  shortcutsRef.current = { undo, redo, duplicateSelected };

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) shortcutsRef.current.undo();
      else if ((key === 'z' && event.shiftKey) || key === 'y') shortcutsRef.current.redo();
      else if (key === 'd') shortcutsRef.current.duplicateSelected();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function layerNeighbour(direction: 1 | -1): string | null {
    const order = canvasPaintOrder(state.objects);
    const index = order.findIndex((obj) => obj.id === selectedId);
    const current = order[index];
    const other = order[index + direction];
    if (!current || !other || isBackgroundFill(current) || isBackgroundFill(other)) return null;
    return other.id;
  }

  function moveLayer(direction: 1 | -1) {
    const otherId = layerNeighbour(direction);
    if (!selectedId || !otherId) return;
    const current = stateRef.current;
    const objects = [...current.objects];
    const from = objects.findIndex((obj) => obj.id === selectedId);
    const to = objects.findIndex((obj) => obj.id === otherId);
    if (from < 0 || to < 0) return;
    [objects[from], objects[to]] = [objects[to], objects[from]];
    commit({ ...current, objects });
  }

  function canDropLayer(target: DraftCanvasObject): boolean {
    const dragged = state.objects.find((obj) => obj.id === dragLayerId);
    return !!dragged
      && dragged.id !== target.id
      && !isBackgroundFill(dragged)
      && !isBackgroundFill(target);
  }

  function dropLayer(targetId: string, place: LayerDropPlace, draggedId: string | null = dragLayerId) {
    const current = stateRef.current;
    const dragged = current.objects.find((obj) => obj.id === draggedId);
    const target = current.objects.find((obj) => obj.id === targetId);
    if (!dragged || !target || dragged === target || isBackgroundFill(dragged) || isBackgroundFill(target)) return;
    const objects = current.objects.filter((obj) => obj !== dragged);
    const targetIndex = objects.indexOf(target);
    objects.splice(place === 'above' ? targetIndex + 1 : targetIndex, 0, dragged);
    if (objects.every((obj, index) => obj === current.objects[index])) return;
    commit({ ...current, objects });
  }

  function endLayerDrag() {
    setDragLayerId(null);
    setDropHint(null);
  }

  /** Touch screens never start an HTML5 drag, so the grip reorders by pointer instead. */
  function layerHintAt(x: number, y: number) {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-layer-id]');
    const id = row?.dataset.layerId;
    if (!row || !id) return null;
    const rect = row.getBoundingClientRect();
    const place: LayerDropPlace = y < rect.top + rect.height / 2 ? 'above' : 'below';
    return { id, place };
  }

  function startLayerPointer(event: React.PointerEvent, obj: DraftCanvasObject) {
    if (event.pointerType === 'mouse' || isBackgroundFill(obj)) return;
    touchDragRef.current = { id: obj.id, y: event.clientY, moved: false, hint: null };
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }

  function moveLayerPointer(event: React.PointerEvent) {
    const drag = touchDragRef.current;
    if (!drag || event.pointerType === 'mouse') return;
    if (!drag.moved && Math.abs(event.clientY - drag.y) < 6) return;
    drag.moved = true;
    event.preventDefault();
    setDragLayerId(drag.id);
    const hint = layerHintAt(event.clientX, event.clientY);
    const target = stateRef.current.objects.find((obj) => obj.id === hint?.id);
    drag.hint = hint && target && hint.id !== drag.id && !isBackgroundFill(target) ? hint : null;
    setDropHint(drag.hint);
  }

  function endLayerPointer(event: React.PointerEvent) {
    const drag = touchDragRef.current;
    touchDragRef.current = null;
    if (!drag || event.pointerType === 'mouse') return;
    if (drag.moved && drag.hint) dropLayer(drag.hint.id, drag.hint.place, drag.id);
    if (drag.moved) endLayerDrag();
  }

  function startSheetDrag(event: React.PointerEvent) {
    if (event.pointerType === 'mouse') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, a, .merchi-product-draft-layer-grip')) return;
    sheetDragRef.current = { y: event.clientY, dy: 0 };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }

  function moveSheetDrag(event: React.PointerEvent) {
    const drag = sheetDragRef.current;
    if (!drag) return;
    const dock = event.currentTarget as HTMLElement;
    if (dock.scrollTop > 0) return;
    drag.dy = Math.max(0, event.clientY - drag.y);
    setSheetDragY(drag.dy);
  }

  function endSheetDrag() {
    const dy = sheetDragRef.current?.dy || 0;
    sheetDragRef.current = null;
    setSheetDragY(0);
    if (dy > 48) closeMobileSheet();
  }

  function handleDroppedFiles(files: FileList | null) {
    const file = Array.from(files || []).find((item) => item.type.startsWith('image/'));
    if (file) addImage(file);
  }

  function discardLinkedFields() {
    let quote = false;
    for (const entry of linkedFormSnapshot.current) {
      const current = hookForm.getValues(entry.path);
      if (String(current ?? '') === entry.value) continue;
      hookForm.setValue(entry.path, entry.value, { shouldDirty: true });
      if (entry.quote) quote = true;
    }
    if (quote) Promise.resolve().then(() => getQuote());
  }

  function requestClose() {
    if (historyFlags.undo) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  async function handleDone() {
    if (!template || !product?.id) return;
    setSaving(true);
    setError(null);
    try {
      const pngs = canvasRef.current
        ? await canvasRef.current.exportPngs()
        : await exportDraftPngs(
          state,
          templateImageSources(template, apiUrl),
          apiUrl,
        );
      const drafts = pruneDrafts(
        loadDrafts(product.id),
        designGroupCount(product, hookForm.getValues()),
      );
      const next = upsertGroupTemplateDraft(drafts, product.id, groupIndex, {
        templateId: template.id,
        canvasJson: stateRef.current,
        ...pngs,
      });
      saveDrafts(product.id, next);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Could not save draft');
    } finally {
      setSaving(false);
    }
  }

  const layerActionButtons = (
    <>
      <button
        type='button'
        className='merchi-product-draft-layer-action'
        onClick={duplicateSelected}
        disabled={!canDuplicate}
        aria-label='Duplicate'
        title='Duplicate (Ctrl+D)'
      >
        <FaClone />
      </button>
      <button
        type='button'
        className='merchi-product-draft-layer-action is-danger'
        onClick={removeSelected}
        disabled={!selectedId}
        aria-label='Delete selected'
      >
        <FaTrash />
      </button>
    </>
  );

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${classNameDraftSheet || ''} merchi-product-draft-sheet`}
      role='dialog'
      aria-modal='true'
      aria-label='Design artwork'
      onMouseDown={stopBubble}
      onClick={stopBubble}
    >
      <header className={`merchi-product-draft-sheet-header${allowAdditionalObjects ? ' has-tools' : ''}`}>
        <button
          type='button'
          className='merchi-product-draft-icon-btn'
          onClick={requestClose}
          aria-label='Close designer'
        >
          <FaTimes />
        </button>
        <div className='merchi-product-draft-sheet-title'>
          <strong>{template?.name || 'Artwork'}</strong>
          {hasGroups ? <span>Group {groupIndex + 1}</span> : null}
        </div>
        <div className='merchi-product-draft-history'>
          <button
            type='button'
            className='merchi-product-draft-icon-btn'
            onClick={undo}
            disabled={!historyFlags.undo}
            aria-label='Undo'
            title='Undo (Ctrl+Z)'
          >
            <FaUndo />
          </button>
          <button
            type='button'
            className='merchi-product-draft-icon-btn'
            onClick={redo}
            disabled={!historyFlags.redo}
            aria-label='Redo'
            title='Redo (Ctrl+Shift+Z)'
          >
            <FaRedo />
          </button>
        </div>
        <button
          type='button'
          className='merchi-product-draft-done-btn'
          onClick={handleDone}
          disabled={saving}
        >
          {saving ? <CgSpinner className='animate_spin' /> : <FaCheck />}
          Done
        </button>
      </header>

      {hasGroups && groupCount > 1 ? (
        <div className='merchi-product-draft-chips' role='tablist' aria-label='Groups'>
          {Array.from({ length: groupCount }, (_, index) => (
            <button
              key={index}
              type='button'
              role='tab'
              aria-selected={index === groupIndex}
              className={`merchi-product-draft-chip${index === groupIndex ? ' is-active' : ''}`}
              onClick={() => {
                setGroupIndex(index);
                setTemplateIndex(0);
              }}
            >
              Group {index + 1}
            </button>
          ))}
        </div>
      ) : null}

      {templates.length > 1 ? (
        <div className='merchi-product-draft-chips' role='tablist' aria-label='Templates'>
          {templates.map((item: any, index: number) => (
            <button
              key={item.id ?? index}
              type='button'
              role='tab'
              aria-selected={item.id === template?.id}
              className={`merchi-product-draft-chip${item.id === template?.id ? ' is-active' : ''}`}
              onClick={() => setTemplateIndex(index)}
            >
              {item.name || `Template ${index + 1}`}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={[
          'merchi-product-draft-main',
          allowAdditionalObjects ? '' : 'is-no-tools',
          mobileLayersOpen ? 'is-layers-open' : '',
          mobileSheetOpen ? '' : 'is-sheet-closed',
        ].filter(Boolean).join(' ')}
      >
        {allowAdditionalObjects ? (
          <nav className='merchi-product-draft-toolbar' aria-label='Design tools'>
            <button
              type='button'
              className={mobileSheetOpen && !mobileLayersOpen && selected?.type === 'text' ? 'is-active' : ''}
              aria-pressed={selected?.type === 'text'}
              onClick={() => {
                setImagePanelOpen(false);
                setMobileLayersOpen(false);
                setMobileSheetOpen(true);
                addText();
              }}
            >
              <FaFont />
              <span>Text</span>
            </button>
            <button
              type='button'
              className={mobileSheetOpen && !mobileLayersOpen && imagePanelVisible ? 'is-active' : ''}
              aria-pressed={imagePanelVisible}
              onClick={() => {
                setEditingTextId(null);
                if (selected && selected.type !== 'image') setSelectedId(null);
                setImagePanelOpen(true);
                setMobileLayersOpen(false);
                setMobileSheetOpen(true);
              }}
            >
              <FaImage />
              <span>Image</span>
            </button>
            <button
              type='button'
              className={`merchi-product-draft-toolbar-layers${mobileLayersOpen ? ' is-active' : ''}`}
              aria-pressed={mobileLayersOpen}
              onClick={() => {
                setEditingTextId(null);
                if (mobileLayersOpen) closeMobileSheet();
                else {
                  setMobileLayersOpen(true);
                  setMobileSheetOpen(true);
                }
              }}
            >
              <FaLayerGroup />
              <span>Layers</span>
            </button>
          </nav>
        ) : null}

        <div className='merchi-product-draft-sheet-body'>
          {previewModelUrl ? (
            <div className='merchi-product-draft-view-toggle' role='tablist' aria-label='Designer view'>
              <button
                type='button'
                role='tab'
                aria-selected={mobileView === 'design'}
                className={`merchi-product-draft-chip${mobileView === 'design' ? ' is-active' : ''}`}
                onClick={() => setMobileView('design')}
              >
                Design
              </button>
              <button
                type='button'
                role='tab'
                aria-selected={mobileView === 'product'}
                className={`merchi-product-draft-chip${mobileView === 'product' ? ' is-active' : ''}`}
                onClick={() => setMobileView('product')}
              >
                On product
              </button>
            </div>
          ) : null}
          <div
            className={`merchi-product-draft-stage${previewModelUrl ? ' has-preview' : ''} is-${mobileView}`}
          >
          <div className='merchi-product-draft-stage-pane is-design'>
          <DraftCanvasBoundary>
            <React.Suspense
              fallback={
                <div className='merchi-product-draft-canvas-fallback'>Loading canvas…</div>
              }
            >
              <DraftCanvas
                ref={canvasRef}
                state={state}
                template={template}
                templateSrc={templateSrc(template, apiUrl)}
                selectedId={selectedId}
                editingTextId={editingTextId}
                onSelect={(id) => {
                  selectObject(id);
                  setMobileLayersOpen(false);
                }}
                onChange={handleCanvasChange}
                onEditText={(id) => {
                  selectObject(id);
                  setEditingTextId(id);
                  setMobileLayersOpen(false);
                }}
                onTextChange={(text) => patchSelected({ text })}
                onFinishEdit={() => setEditingTextId(null)}
                fixedSizeFieldIds={fixedSizeFieldIds}
                transformPolicy={{
                  allowRotation: editorAllows(policyFor(selected), 'allowRotation'),
                  allowScale: editorAllows(policyFor(selected), 'allowScale'),
                }}
              />
            </React.Suspense>
          </DraftCanvasBoundary>
          </div>
          {previewModelUrl ? (
            <div className='merchi-product-draft-stage-pane is-preview'>
              <React.Suspense
                fallback={
                  <div className='merchi-product-draft-canvas-fallback'>Loading product…</div>
                }
              >
                <DraftProductPreview
                  modelUrl={previewModelUrl}
                  surfaces={previewSurfaces}
                  templates={templates}
                  sizeTemplates={product?.draftTemplates || templates}
                  states={textureStates}
                  variations={variationsForGroup(formValues, groupIndex)}
                  activeTemplateId={template?.id}
                />
              </React.Suspense>
            </div>
          ) : null}
          </div>
          {error ? <p className='merchi-product-draft-error'>{error}</p> : null}
        </div>

        <aside
          className={`merchi-product-draft-dock${!mobileSheetOpen || (!selected && !imagePanelVisible) ? ' is-empty' : ''}`}
          aria-label='Design panel'
          style={sheetDragY ? { transform: `translateY(${sheetDragY}px)` } : undefined}
          onPointerDown={startSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={endSheetDrag}
          onPointerCancel={endSheetDrag}
        >
          <div className='merchi-product-draft-dock-handle' />
          <section className='merchi-product-draft-panel'>
            {mobileSheetOpen && selected ? (
              <div className='merchi-product-draft-panel-actions'>{layerActionButtons}</div>
            ) : null}
            {mobileSheetOpen && selected?.type === 'text' ? (
              <>
                <h3 className='merchi-product-draft-panel-title'>Text</h3>
                <p className='merchi-product-draft-layers-hint merchi-product-draft-mobile-hint'>
                  Double-tap text to edit it on the canvas.
                </p>
                <label className='merchi-product-draft-field'>
                  <span className='merchi-sr-only'>Text</span>
                  <textarea
                    className='merchi-product-draft-text-input'
                    value={selected.text || ''}
                    rows={2}
                    aria-label='Edit text'
                    onChange={(e) => patchSelected({ text: e.target.value })}
                  />
                </label>
                <div className='merchi-product-draft-text-row'>
                  <label className='merchi-product-draft-field merchi-product-draft-font'>
                    <span className='merchi-product-draft-field-label'>Font</span>
                    <select
                      aria-label='Font'
                      value={selected.fontFamily || DEFAULT_DRAFT_FONT}
                      style={{ fontFamily: cssFontFamily(selected.fontFamily || DEFAULT_DRAFT_FONT) }}
                      onChange={(e) => patchSelected({ fontFamily: e.target.value })}
                    >
                      {DRAFT_TEXT_FONTS.map((font) => (
                        <option
                          key={font.value}
                          value={font.value}
                          style={{ fontFamily: cssFontFamily(font.value) }}
                        >
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editorAllows(policyFor(selected), 'allowTextSize') ? (
                    <div className='merchi-product-draft-field'>
                      <span className='merchi-product-draft-field-label'>Size</span>
                      <div className='merchi-product-draft-size'>
                        <button
                          type='button'
                          className='merchi-product-draft-stepper'
                          onClick={() => patchSelected({
                            fontSize: Math.max(12, (selected.fontSize || 48) - 8),
                          })}
                          aria-label='Smaller text'
                        >
                          A-
                        </button>
                        <select
                          aria-label='Text size'
                          value={Math.round(selected.fontSize || 48)}
                          onChange={(e) => patchSelected({ fontSize: Number(e.target.value) })}
                        >
                          {Array.from(new Set([...TEXT_SIZES, Math.round(selected.fontSize || 48)]))
                            .sort((a, b) => a - b)
                            .map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <button
                          type='button'
                          className='merchi-product-draft-stepper'
                          onClick={() => patchSelected({
                            fontSize: Math.min(240, (selected.fontSize || 48) + 8),
                          })}
                          aria-label='Larger text'
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {editorAllows(policyFor(selected), 'allowTextAlign') ? (
                  <div className='merchi-product-draft-field'>
                    <span className='merchi-product-draft-field-label'>Align</span>
                    <div className='merchi-product-draft-align' role='group' aria-label='Text alignment'>
                      {TEXT_ALIGNMENTS.map(({ value, label, Icon }) => {
                        const active = (selected.align || 'left') === value;
                        return (
                          <button
                            key={value}
                            type='button'
                            className={active ? 'is-active' : ''}
                            aria-pressed={active}
                            aria-label={label}
                            title={label}
                            onClick={() => patchSelected({ align: value })}
                          >
                            <Icon />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {editorAllows(policyFor(selected), 'allowTextColour')
                  && (selected.colourFieldId != null || selected.merchiFieldId == null) ? (
                  <ColourPicker
                    label='Colour'
                    value={selected.fill || '#111111'}
                    choices={selected.colourFieldId != null
                      ? restrictedColourSwatches(
                        textColourSwatches(variationsForGroup(formValues, groupIndex).find(
                          (item: any) => Number(item?.variationField?.id) === Number(selected.colourFieldId)
                        )),
                        allowedColoursForText(template, selected.merchiFieldId, selected.colourFieldId),
                      )
                      : (() => {
                        const allowed = normaliseAllowedColours(policyFor(selected).allowedColours);
                        return allowed.length ? restrictedColourSwatches(null, allowed) : null;
                      })()}
                    onChange={(fill) => patchSelected({ fill })}
                  />
                ) : null}
              </>
            ) : mobileSheetOpen && imagePanelVisible ? (
              <>
                <h3 className='merchi-product-draft-panel-title'>Image</h3>
                {allowAdditionalObjects ? (
                  <>
                    <div
                      className={`merchi-product-draft-upload${dragOver ? ' is-dragging' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleDroppedFiles(e.dataTransfer.files);
                      }}
                    >
                      <FaCloudUploadAlt className='merchi-product-draft-upload-icon' />
                      <strong>Upload your artwork</strong>
                      <span>Drag and drop an image here</span>
                      <button
                        type='button'
                        className='merchi-product-draft-primary-btn'
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse files
                      </button>
                    </div>
                    <button
                      type='button'
                      className='merchi-product-draft-upload-compact'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FaCloudUploadAlt />
                      Upload image
                    </button>
                    </>
                ) : null}
                {selected?.type === 'image' ? (
                  <div className='merchi-product-draft-field'>
                    <span className='merchi-product-draft-field-label'>Selected image</span>
                    <div className='merchi-product-draft-selected-item'>
                      {selected.src ? (
                        <img src={selected.src} alt='' className='merchi-product-draft-selected-thumb' />
                      ) : (
                        <FaImage />
                      )}
                      <span className='merchi-product-draft-layer-text'>
                        <strong>{layerName(selected)}</strong>
                        <small>Image layer</small>
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : mobileSheetOpen && selected?.type === 'rect' && bodyPanel ? (
              <>
                <h3 className='merchi-product-draft-panel-title'>Base colour</h3>
                {bodyPanel.modes.length ? (
                  <div className='merchi-product-draft-field'>
                    <span className='merchi-product-draft-field-label'>Style</span>
                    <div className='merchi-product-draft-align' role='group' aria-label='Base colour style'>
                      {bodyPanel.modes.map((mode) => {
                        const active = bodyPanel.mode === mode;
                        const label = mode === 'mix' ? 'Swirl' : 'Segmentation';
                        return (
                          <button
                            key={mode}
                            type='button'
                            className={active ? 'is-active is-text' : 'is-text'}
                            aria-pressed={active}
                            onClick={() => applyBodyColourMode(mode)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {bodyPanel.colours.map((colour) => (
                  <ColourPicker
                    key={colour.fieldId}
                    label={colour.name}
                    value={colour.fill}
                    choices={restrictedColourSwatches(
                      textColourSwatches(colour.variation),
                      normaliseAllowedColours(
                        editorPolicyForField(template, colour.fieldId).allowedColours,
                      ),
                    )}
                    onChange={(fill) => setBackgroundColour(colour.fieldId, fill)}
                  />
                ))}
              </>
            ) : mobileSheetOpen && selected?.type === 'rect' ? (
              <>
                <h3 className='merchi-product-draft-panel-title'>Base colour</h3>
                <ColourPicker
                  label='Fill colour'
                  value={selected.fill || '#cccccc'}
                  choices={restrictedColourSwatches(
                    null,
                    normaliseAllowedColours(policyFor(selected).allowedColours),
                  )}
                  onChange={(fill) => patchSelected({ fill })}
                />
              </>
            ) : (
              <>
                <h3 className='merchi-product-draft-panel-title'>Design tools</h3>
                <div className='merchi-product-draft-empty'>
                  <FaMousePointer />
                  <strong>Start your design</strong>
                  <span>
                    {allowAdditionalObjects
                      ? 'Add text or upload an image.'
                      : 'Select a layer to edit it.'}
                  </span>
                </div>
              </>
            )}

            {mobileSheetOpen && selected ? (
              <div className='merchi-product-draft-field'>
                <span className='merchi-product-draft-field-label'>Transform</span>
                <div className='merchi-product-draft-transform'>
                  {selected.type === 'image' ? (
                    <button
                      type='button'
                      className={selected.lockAspectRatio ? 'is-active' : ''}
                      onClick={() => patchSelected({ lockAspectRatio: !selected.lockAspectRatio })}
                      aria-label={selected.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                      aria-pressed={!!selected.lockAspectRatio}
                    >
                      {selected.lockAspectRatio ? <FaLock /> : <FaUnlock />}
                      Ratio
                    </button>
                  ) : null}
                  <button
                    type='button'
                    onClick={() => patchSelected({ scaleX: (selected.scaleX || 1) * -1 })}
                    aria-label='Flip'
                  >
                    <FaExchangeAlt />
                    Flip
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={`merchi-product-draft-layers${layersCollapsed ? ' is-collapsed' : ''}`}>
            <div className='merchi-product-draft-layers-head'>
              <button
                type='button'
                className='merchi-product-draft-layers-toggle'
                aria-expanded={!layersCollapsed}
                aria-controls='merchi-product-draft-layer-list'
                onClick={() => setLayersCollapsed((collapsed) => !collapsed)}
              >
                <strong>Layers ({layers.length})</strong>
              </button>
              <div className='merchi-product-draft-layers-actions'>
                {layerActionButtons}
                <button
                  type='button'
                  className='merchi-product-draft-layer-action'
                  aria-label={layersCollapsed ? 'Expand layers' : 'Collapse layers'}
                  onClick={() => setLayersCollapsed((collapsed) => !collapsed)}
                >
                  {layersCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                </button>
              </div>
            </div>
            {layersCollapsed ? null : (
              <div
                id='merchi-product-draft-layer-list'
                className='merchi-product-draft-layer-list'
                role='listbox'
                aria-label='Layers'
              >
                {layers.length === 0 ? (
                  <div className='merchi-product-draft-layers-empty'>
                    <FaLayerGroup />
                    <span>No layers yet</span>
                  </div>
                ) : (
                  layers.map((obj) => (
                    <div
                      key={obj.id}
                      data-layer-id={obj.id}
                      ref={(node) => {
                        layerRefs.current[obj.id] = node;
                      }}
                      role='option'
                      tabIndex={0}
                      draggable={!isBackgroundFill(obj)}
                      aria-selected={obj.id === selectedId}
                      className={[
                        'merchi-product-draft-layer',
                        obj.id === selectedId ? 'is-active' : '',
                        obj.id === dragLayerId ? 'is-dragging' : '',
                        dropHint?.id === obj.id ? `is-drop-${dropHint.place}` : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => selectObject(obj.id)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        selectObject(obj.id);
                      }}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('.merchi-product-draft-layer-more, .merchi-product-draft-layer-menu')) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', obj.id);
                        setDragLayerId(obj.id);
                      }}
                      onDragOver={(e) => {
                        if (!canDropLayer(obj)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const place: LayerDropPlace = e.clientY < rect.top + rect.height / 2
                          ? 'above'
                          : 'below';
                        if (dropHint?.id !== obj.id || dropHint.place !== place) {
                          setDropHint({ id: obj.id, place });
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                        setDropHint((hint) => (hint?.id === obj.id ? null : hint));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dropHint?.id === obj.id) dropLayer(obj.id, dropHint.place);
                        endLayerDrag();
                      }}
                      onDragEnd={endLayerDrag}
                    >
                      {isBackgroundFill(obj) ? null : (
                        <FaGripVertical
                          className='merchi-product-draft-layer-grip'
                          aria-hidden='true'
                          onPointerDown={(event) => startLayerPointer(event, obj)}
                          onPointerMove={moveLayerPointer}
                          onPointerUp={endLayerPointer}
                          onPointerCancel={endLayerPointer}
                        />
                      )}
                      <span className='merchi-product-draft-layer-icon'>
                        <LayerIcon obj={obj} />
                      </span>
                      <span className='merchi-product-draft-layer-text'>
                        <strong>{layerName(obj)}</strong>
                        <small>{layerKind(obj)}</small>
                      </span>
                      {obj.id === selectedId && !isBackgroundFill(obj) ? (
                        <button
                          type='button'
                          className='merchi-product-draft-layer-more'
                          aria-label='Layer order'
                          aria-expanded={layerMenuOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 88;
                            const top = rect.bottom + menuHeight > window.innerHeight
                              ? Math.max(8, rect.top - menuHeight)
                              : rect.bottom + 4;
                            setLayerMenuPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
                            setLayerMenuOpen((open) => !open);
                          }}
                        >
                          <FaEllipsisH />
                        </button>
                      ) : null}
                      {obj.id === selectedId && layerMenuOpen ? (
                        <div
                          className='merchi-product-draft-layer-menu'
                          role='menu'
                          style={layerMenuPos
                            ? { top: layerMenuPos.top, right: layerMenuPos.right }
                            : undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type='button'
                            role='menuitem'
                            onClick={() => {
                              moveLayer(1);
                              setLayerMenuOpen(false);
                            }}
                            disabled={!layerNeighbour(1)}
                          >
                            <FaArrowUp />
                            Bring forward
                          </button>
                          <button
                            type='button'
                            role='menuitem'
                            onClick={() => {
                              moveLayer(-1);
                              setLayerMenuOpen(false);
                            }}
                            disabled={!layerNeighbour(-1)}
                          >
                            <FaArrowDown />
                            Send backward
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
            {layersCollapsed || layers.length === 0 ? null : (
              <p className='merchi-product-draft-layers-hint'>Drag layers to change their order.</p>
            )}
          </section>

          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='merchi-product-draft-file'
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) addImage(file);
              e.target.value = '';
            }}
          />
        </aside>
      </div>
      {confirmClose ? (
        <div
          className='merchi-product-draft-confirm'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmClose(false);
          }}
        >
          <div
            className='merchi-product-draft-confirm-card'
            role='alertdialog'
            aria-modal='true'
            aria-labelledby='merchi-product-draft-confirm-title'
            aria-describedby='merchi-product-draft-confirm-body'
          >
            <h2 id='merchi-product-draft-confirm-title'>Unsaved changes</h2>
            <p id='merchi-product-draft-confirm-body'>
              Your design changes will be lost if you leave without saving.
            </p>
            <div className='merchi-product-draft-confirm-actions'>
              <button type='button' onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
              <button
                type='button'
                className='is-leave'
                onClick={() => {
                  discardLinkedFields();
                  onClose();
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
