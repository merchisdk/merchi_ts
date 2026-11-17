'use client';
import * as React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { DraftCanvasHandle, DraftCanvasObject, DraftCanvasState } from '../../utils/types';
import { cssFontFamily, DEFAULT_DRAFT_FONT, loadDraftFonts } from '../../utils/draftFonts';
import { captureStageArtboard, exportDraftPngs } from '../../utils/draftExport';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { fitInside, isBackgroundFill, isFullArtboardFill, printAreaGuides, unclipTextBox } from '../../utils/draftTemplates';
import { useHtmlImage } from './useHtmlImage';

interface Props {
  state: DraftCanvasState;
  templateSrc?: string | string[] | null;
  template?: any;
  selectedId: string | null;
  editingTextId?: string | null;
  onSelect: (id: string | null) => void;
  onChange: (state: DraftCanvasState) => void;
  onEditText: (id: string) => void;
  onTextChange?: (text: string) => void;
  onFinishEdit?: () => void;
  fixedSizeFieldIds?: number[];
}

function fitView(width: number, height: number, artW: number, artH: number) {
  const pad = 20;
  const scale = Math.min(
    (width - pad * 2) / Math.max(artW, 1),
    (height - pad * 2) / Math.max(artH, 1),
    1.5,
  );
  return {
    x: (width - artW * scale) / 2,
    y: (height - artH * scale) / 2,
    scale: Math.max(0.1, scale),
  };
}

const CanvasImage = React.forwardRef(function CanvasImage(
  {
    obj,
    listening,
    onSelect,
    onChange,
  }: {
    obj: DraftCanvasObject;
    listening: boolean;
    onSelect: () => void;
    onChange: (patch: Partial<DraftCanvasObject>) => void;
  },
  ref: any,
) {
  const image = useHtmlImage(obj.src);
  React.useEffect(() => {
    if (!image || !obj.lockAspectRatio) return;
    const next = fitInside(
      { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      true,
    );
    const sameRatio = Math.abs(
      (obj.width / Math.max(obj.height, 1))
      - (next.width / Math.max(next.height, 1))
    ) < 0.03;
    if (sameRatio) return;
    onChange(next);
  }, [image, obj.lockAspectRatio, obj.src]);
  if (!image) return null;
  return (
    <KonvaImage
      ref={ref}
      id={obj.id}
      image={image}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      scaleX={obj.scaleX}
      scaleY={obj.scaleY}
      draggable={listening}
      listening={listening}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        if (obj.lockAspectRatio) {
          node.scaleX(sx < 0 ? -1 : 1);
          node.scaleY(1);
          onChange({
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(16, node.width() * Math.abs(sx)),
            height: Math.max(16, node.height() * Math.abs(sy)),
            scaleX: sx < 0 ? -1 : 1,
            scaleY: 1,
          });
          return;
        }
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: sx,
          scaleY: sy,
        });
      }}
    />
  );
});

/** Caret index in the text, from a point in the text box's own coordinates. */
function caretIndexForPointer(
  text: string,
  fontSize: number,
  fontFamily: string | undefined,
  align: string,
  boxWidth: number,
  boxHeight: number,
  pointer: { x: number; y: number },
): number {
  const value = text || '';
  const lines = value.split('\n');
  const size = Math.max(12, fontSize || 48);
  const top = Math.max(0, (boxHeight - lines.length * size) / 2);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return value.length;
  ctx.font = `${size}px ${cssFontFamily(fontFamily)}`;
  const lineIndex = Math.max(
    0,
    Math.min(lines.length - 1, Math.floor((pointer.y - top) / size)),
  );
  const line = lines[lineIndex];
  const lineWidth = ctx.measureText(line).width;
  const startX = align === 'center'
    ? (boxWidth - lineWidth) / 2
    : align === 'right'
      ? boxWidth - lineWidth
      : 0;
  const x = pointer.x - startX;
  let charIndex = line.length;
  for (let i = 1; i <= line.length; i += 1) {
    const width = ctx.measureText(line.slice(0, i)).width;
    if (width >= x) {
      const previous = ctx.measureText(line.slice(0, i - 1)).width;
      charIndex = x - previous < width - x ? i - 1 : i;
      break;
    }
  }
  let index = charIndex;
  for (let i = 0; i < lineIndex; i += 1) index += lines[i].length + 1;
  return index;
}

const DraftCanvas = React.forwardRef<DraftCanvasHandle, Props>(function DraftCanvas({
  state,
  templateSrc,
  template,
  selectedId,
  editingTextId = null,
  onSelect,
  onChange,
  onEditText,
  onTextChange,
  onFinishEdit,
  fixedSizeFieldIds,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const whiteRectRef = useRef<any>(null);
  const templateNodeRef = useRef<any>(null);
  const guideRefs = useRef<any[]>([]);
  const nodeRefs = useRef<Record<string, any>>({});
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 320, height: 360 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [fontEpoch, setFontEpoch] = useState(0);
  const fontKey = state.objects
    .filter((obj) => obj.type === 'text')
    .map((obj) => obj.fontFamily || DEFAULT_DRAFT_FONT)
    .join('\n');
  const pinchRef = useRef({ dist: 0, scale: 1, x: 0, y: 0 });
  const [pinching, setPinching] = useState(false);
  const templateImage = useHtmlImage(templateSrc);
  const guides = useMemo(() => printAreaGuides(template), [template]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setFontEpoch((epoch) => epoch + 1);
    };
    const families = state.objects
      .filter((obj) => obj.type === 'text')
      .map((obj) => obj.fontFamily || DEFAULT_DRAFT_FONT);
    loadDraftFonts(families).then(refresh);
    document.fonts?.addEventListener?.('loadingdone', refresh);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', refresh);
    };
  }, [fontKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const apply = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setSize(next);
      setView(fitView(next.width, next.height, state.width, state.height));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.width, state.height]);

  React.useImperativeHandle(ref, () => ({
    async exportPngs() {
      const fallback = () => exportDraftPngs(state, templateSrc);
      const stage = stageRef.current;
      const hasTemplate = Array.isArray(templateSrc)
        ? templateSrc.length > 0
        : Boolean(templateSrc);
      if (!stage?.toDataURL || (hasTemplate && !templateNodeRef.current)) {
        return fallback();
      }

      const hide = (nodes: any[]) => nodes.forEach((node) => {
        try { node.visible(false); } catch { /* ignore */ }
      });
      const show = (nodes: any[]) => nodes.forEach((node) => {
        try { node.visible(true); } catch { /* ignore */ }
      });
      const chrome = [trRef.current, ...guideRefs.current].filter(Boolean);
      const hiddenText = Object.values(nodeRefs.current).filter(
        (node) => node && typeof node.opacity === 'function' && node.opacity() < 1,
      );
      const artOnly = [whiteRectRef.current, templateNodeRef.current].filter(Boolean);

      try {
        hide(chrome);
        hiddenText.forEach((node) => node.opacity(1));
        stage.draw();
        const canvasPreview = captureStageArtboard(stage, view, state);
        hide(artOnly);
        stage.draw();
        const draft = captureStageArtboard(stage, view, state);
        show([...artOnly, ...chrome]);
        hiddenText.forEach((node) => node.opacity(0));
        stage.draw();
        if (draft && canvasPreview) return { draft, canvasPreview };
      } catch {
        show([...artOnly, ...chrome]);
        hiddenText.forEach((node) => node.opacity(0));
        try { stage.draw(); } catch { /* ignore */ }
      }
      return fallback();
    },
  }), [state, templateSrc, view]);

  useEffect(() => {
    const transformer = trRef.current;
    if (!transformer) return undefined;
    const attach = () => {
      const node = selectedId && selectedId !== editingTextId
        ? nodeRefs.current[selectedId]
        : null;
      try {
        const onStage = Boolean(
          node && typeof node.getStage === 'function' && node.getStage()
        );
        transformer.nodes(onStage ? [node] : []);
        transformer.getLayer()?.batchDraw();
      } catch {
        transformer.nodes([]);
      }
    };
    attach();
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, editingTextId, state.objects]);

  function patchObject(id: string, patch: Partial<DraftCanvasObject>) {
    onChange({
      ...state,
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)),
    });
  }

  function handleWheel(e: any) {
    if (e.evt?.cancelable) e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.06;
    const oldScale = view.scale;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clamped = Math.min(4, Math.max(0.15, newScale));
    const mousePointTo = {
      x: (pointer.x - view.x) / oldScale,
      y: (pointer.y - view.y) / oldScale,
    };
    setView({
      scale: clamped,
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  }

  function handleTouchMove(e: any) {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    if (e.evt?.cancelable) e.evt.preventDefault();
    const dist = Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
    if (!pinchRef.current.dist) {
      pinchRef.current = { dist, scale: view.scale, x: view.x, y: view.y };
      setPinching(true);
      return;
    }
    const ratio = dist / pinchRef.current.dist;
    setView({
      x: pinchRef.current.x,
      y: pinchRef.current.y,
      scale: Math.min(4, Math.max(0.15, pinchRef.current.scale * ratio)),
    });
  }

  function handleTouchEnd() {
    pinchRef.current.dist = 0;
    setPinching(false);
  }

  const editing = state.objects.find(
    (obj) => obj.id === editingTextId && obj.type === 'text',
  ) || null;

  function placeEditor() {
    const area = editorRef.current;
    const node = editing ? nodeRefs.current[editing.id] : null;
    if (!area || !node || typeof node.getAbsoluteTransform !== 'function') return;
    const matrix = node.getAbsoluteTransform().getMatrix();
    const fontSize = editing?.fontSize || 48;
    const lines = String(editing?.text || '').split('\n');
    const padTop = Math.max(0, (node.height() - lines.length * fontSize) / 2);
    area.style.fontSize = `${fontSize}px`;
    area.style.width = `${node.width()}px`;
    const extra = Math.max(0, area.scrollWidth - node.width());
    const shift = editing?.align === 'center' ? -extra / 2 : editing?.align === 'right' ? -extra : 0;
    const x = matrix[4] + shift * matrix[0];
    const y = matrix[5] + shift * matrix[1];
    area.style.transform = `matrix(${matrix[0]}, ${matrix[1]}, ${matrix[2]}, ${matrix[3]}, ${x}, ${y})`;
    area.style.width = `${node.width() + extra}px`;
    area.style.height = `${node.height()}px`;
    area.style.paddingTop = `${padTop}px`;
  }

  function startTextEdit(obj: DraftCanvasObject, event: any) {
    if (obj.type !== 'text') return;
    const pointer = event.target.getRelativePointerPosition?.();
    caretRef.current = pointer
      ? caretIndexForPointer(
        obj.text || '',
        obj.fontSize || 48,
        obj.fontFamily,
        obj.align || 'left',
        event.target.width(),
        event.target.height(),
        pointer,
      )
      : (obj.text || '').length;
    onEditText(obj.id);
  }

  useLayoutEffect(() => {
    placeEditor();
  });

  useLayoutEffect(() => {
    if (!editing) return;
    const area = editorRef.current;
    if (!area) return;
    const index = caretRef.current ?? area.value.length;
    caretRef.current = null;
    area.focus();
    area.setSelectionRange(index, index);
  }, [editingTextId]);

  const fitScale = fitView(size.width, size.height, state.width, state.height).scale;

  function zoomBy(factor: number) {
    const clamped = Math.min(4, Math.max(0.15, view.scale * factor));
    const centre = { x: size.width / 2, y: size.height / 2 };
    const pointTo = {
      x: (centre.x - view.x) / view.scale,
      y: (centre.y - view.y) / view.scale,
    };
    setView({
      scale: clamped,
      x: centre.x - pointTo.x * clamped,
      y: centre.y - pointTo.y * clamped,
    });
  }

  return (
    <div ref={containerRef} className='merchi-product-draft-canvas'>
      <div className='merchi-product-draft-zoom' role='group' aria-label='Zoom'>
        <button type='button' onClick={() => zoomBy(1 / 1.2)} aria-label='Zoom out'>
          <FaMinus />
        </button>
        <span aria-live='polite'>{Math.round((view.scale / fitScale) * 100)}%</span>
        <button type='button' onClick={() => zoomBy(1.2)} aria-label='Zoom in'>
          <FaPlus />
        </button>
        <span className='merchi-product-draft-zoom-divider' aria-hidden='true' />
        <button
          type='button'
          onClick={() => setView(fitView(size.width, size.height, state.width, state.height))}
        >
          Fit
        </button>
      </div>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
        onTap={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
            <Rect
              ref={whiteRectRef}
              width={state.width}
              height={state.height}
              fill='#ffffff'
              shadowBlur={8}
              shadowOpacity={0.12}
              onClick={() => onSelect(null)}
              onTap={() => onSelect(null)}
            />
            {templateImage ? (
              <KonvaImage
                ref={templateNodeRef}
                image={templateImage}
                width={state.width}
                height={state.height}
                listening={false}
              />
            ) : null}
            {state.objects.filter(isBackgroundFill).map((obj) => (
              <Rect
                key={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                rotation={obj.rotation}
                scaleX={obj.scaleX}
                scaleY={obj.scaleY}
                fill={obj.fill || '#cccccc'}
                globalCompositeOperation={
                  isFullArtboardFill(obj, state.width, state.height)
                    ? 'multiply'
                    : 'source-over'
                }
                listening={false}
              />
            ))}
            {guides.map((guide, index) => (
              <Line
                key={`guide-${index}`}
                ref={(node) => {
                  if (node) guideRefs.current[index] = node;
                  else delete guideRefs.current[index];
                }}
                points={[
                  guide.x,
                  guide.y,
                  guide.x + guide.width,
                  guide.y,
                  guide.x + guide.width,
                  guide.y + guide.height,
                  guide.x,
                  guide.y + guide.height,
                  guide.x,
                  guide.y,
                ]}
                stroke='#2563eb'
                dash={[12, 8]}
                strokeWidth={2}
                listening={false}
              />
            ))}
            {state.objects.filter((obj) => !isBackgroundFill(obj)).map((obj) => {
              const common = {
                ref: (node: any) => {
                  if (node) nodeRefs.current[obj.id] = node;
                  else delete nodeRefs.current[obj.id];
                },
                id: obj.id,
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
                rotation: obj.rotation,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                draggable: !pinching && obj.id !== editingTextId,
                onClick: () => onSelect(obj.id),
                onTap: () => onSelect(obj.id),
                onDblClick: (event: any) => startTextEdit(obj, event),
                onDblTap: (event: any) => startTextEdit(obj, event),
                onDragEnd: (e: any) => {
                  const node = e.target;
                  if (obj.type === 'text') {
                    patchObject(obj.id, {
                      x: node.x(),
                      y: node.y(),
                      width: node.width(),
                      height: node.height(),
                    });
                    return;
                  }
                  patchObject(obj.id, { x: node.x(), y: node.y() });
                },
                onTransformEnd: (e: any) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  if (obj.type === 'text') {
                    patchObject(obj.id, {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(16, node.width()),
                      height: Math.max(16, node.height()),
                      rotation: node.rotation(),
                      scaleX: sx,
                      scaleY: sy,
                    });
                    return;
                  }
                  patchObject(obj.id, {
                    x: node.x(),
                    y: node.y(),
                    rotation: node.rotation(),
                    scaleX: sx,
                    scaleY: sy,
                  });
                },
              };
              if (obj.type === 'text') {
                const fixedSize = obj.merchiFieldId != null
                  && (fixedSizeFieldIds || []).some((id) => Number(id) === Number(obj.merchiFieldId));
                const shown = fontEpoch > 0 && !fixedSize ? unclipTextBox(obj) : obj;
                return (
                  <Text
                    key={obj.id}
                    {...common}
                    x={shown.x}
                    y={shown.y}
                    width={shown.width}
                    height={shown.height}
                    text={obj.text || 'Text'}
                    fontSize={obj.fontSize || 48}
                    fill={obj.fill || '#111111'}
                    fontFamily={cssFontFamily(obj.fontFamily)}
                    align={obj.align || 'left'}
                    verticalAlign='middle'
                    lineHeight={1}
                    wrap='none'
                    opacity={obj.id === editingTextId ? 0 : 1}
                  />
                );
              }
              return (
                <CanvasImage
                  key={obj.id}
                  ref={(node: any) => {
                    if (node) nodeRefs.current[obj.id] = node;
                    else delete nodeRefs.current[obj.id];
                  }}
                  obj={obj}
                  listening={!pinching}
                  onSelect={() => onSelect(obj.id)}
                  onChange={(patch) => patchObject(obj.id, patch)}
                />
              );
            })}
            <Transformer
              ref={trRef}
              rotateEnabled
              borderStroke='#3b82f6'
              anchorStroke='#3b82f6'
              anchorFill='#ffffff'
              rotateAnchorOffset={28}
              keepRatio={
                (state.objects.find((obj) => obj.id === selectedId)?.type === 'text')
                || Boolean(state.objects.find((obj) => obj.id === selectedId)?.lockAspectRatio)
              }
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
              boundBoxFunc={(_oldBox, newBox) => {
                if (newBox.width < 16 || newBox.height < 16) return _oldBox;
                return newBox;
              }}
              anchorSize={22}
              borderStrokeWidth={2}
              padding={4}
            />
          </Group>
        </Layer>
      </Stage>
      {editing ? (
        <textarea
          ref={editorRef}
          className='merchi-product-draft-text-editor'
          value={editing.text || ''}
          aria-label='Edit text on canvas'
          style={{
            fontFamily: cssFontFamily(editing.fontFamily),
            color: editing.fill || '#111111',
            textAlign: (editing.align as React.CSSProperties['textAlign']) || 'left',
            lineHeight: 1,
          }}
          onChange={(event) => onTextChange?.(event.target.value)}
          onBlur={() => onFinishEdit?.()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onMouseDown={(event) => event.stopPropagation()}
        />
      ) : null}
    </div>
  );
});

export default DraftCanvas;
