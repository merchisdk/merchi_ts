import { cssFontFamily } from './draftFonts';
import {
  bboxToPixels,
  isFullArtboardFill,
  paintBodyFillTexture,
  regionsForRole,
  variationCanvasContent,
} from './draftTemplates';
import { DEFAULT_ARTBOARD, type DraftCanvasObject, type DraftCanvasState } from './types';

export interface PrintFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintDrawContext {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  textAlign: CanvasTextAlign | string;
  textBaseline: CanvasTextBaseline | string;
}

/** Artwork that belongs on a print material. Rects supply the background colour, not extra shapes. */
export function printObjects(state?: DraftCanvasState | null): DraftCanvasObject[] {
  const objects = state?.objects || [];
  const art = objects.filter((obj) => obj.type !== 'rect' && obj.type !== 'image');
  const images = objects.filter((obj) => obj.type === 'image');
  return [...art, ...images];
}

export function printImageSources(state?: DraftCanvasState | null): string[] {
  return printObjects(state)
    .map((obj) => obj.src)
    .filter((src): src is string => Boolean(src));
}

export function printAreaFrame(template: any, regionIndex = 0): PrintFrame {
  const width = Number(template?.width) || DEFAULT_ARTBOARD.width;
  const height = Number(template?.height) || DEFAULT_ARTBOARD.height;
  const regions = regionsForRole(template?.customisationMap, 'print_area');
  const bbox = regions[regionIndex] || regions[0];
  if (bbox) {
    const frame = bboxToPixels(bbox, width, height);
    if (frame.width > 0 && frame.height > 0) return frame;
  }
  return { x: 0, y: 0, width, height };
}

export function textureSize(area: PrintFrame, maxEdge = 1024): {
  width: number;
  height: number;
} {
  const width = Math.max(1, area.width);
  const height = Math.max(1, area.height);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

export function bodyColourFromDesign(
  state: DraftCanvasState | null | undefined,
  variations?: any[],
): string {
  const width = Number(state?.width) || DEFAULT_ARTBOARD.width;
  const height = Number(state?.height) || DEFAULT_ARTBOARD.height;
  const rects = (state?.objects || []).filter((obj) => obj.type === 'rect' && obj.fill);
  const full = rects.find((obj) => isFullArtboardFill(obj, width, height));
  if (full?.fill) return full.fill;
  const painted = rects[rects.length - 1];
  if (painted?.fill) return painted.fill;
  for (const variation of variations || []) {
    const content = variationCanvasContent(variation);
    if (content.kind === 'rect' && content.fill) return content.fill;
  }
  return '#f4f4f5';
}

export function drawPrintTexture(
  ctx: PrintDrawContext,
  state: DraftCanvasState | null | undefined,
  area: PrintFrame,
  images: Map<string, unknown>,
  destWidth: number,
  destHeight: number,
  background?: string,
): void {
  ctx.clearRect(0, 0, destWidth, destHeight);
  ctx.fillStyle = background || bodyColourFromDesign(state);
  ctx.fillRect(0, 0, destWidth, destHeight);
  const pattern = paintBodyFillTexture(state);
  if (pattern) {
    ctx.save();
    ctx.scale(destWidth / Math.max(area.width, 1), destHeight / Math.max(area.height, 1));
    ctx.translate(-area.x, -area.y);
    ctx.drawImage(pattern, 0, 0, pattern.width, pattern.height);
    ctx.restore();
  }
  ctx.save();
  ctx.scale(destWidth / Math.max(area.width, 1), destHeight / Math.max(area.height, 1));
  ctx.translate(-area.x, -area.y);
  for (const obj of printObjects(state)) {
    drawObject(ctx, obj, images);
  }
  ctx.restore();
}

function drawObject(
  ctx: PrintDrawContext,
  obj: DraftCanvasObject,
  images: Map<string, unknown>,
): void {
  ctx.save();
  ctx.translate(obj.x || 0, obj.y || 0);
  ctx.rotate(((obj.rotation || 0) * Math.PI) / 180);
  ctx.scale(obj.scaleX || 1, obj.scaleY || 1);
  if (obj.type === 'text') {
    const size = obj.fontSize || 48;
    const align = obj.align === 'center' || obj.align === 'right' ? obj.align : 'left';
    ctx.font = `${size}px ${cssFontFamily(obj.fontFamily)}`;
    ctx.fillStyle = obj.fill || '#111111';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const x = align === 'center' ? (obj.width || 0) / 2 : align === 'right' ? (obj.width || 0) : 0;
    ctx.fillText(obj.text || '', x, (obj.height || size) / 2);
  } else if (obj.type === 'image' && obj.src && images.has(obj.src)) {
    ctx.drawImage(images.get(obj.src), 0, 0, obj.width || 0, obj.height || 0);
  }
  ctx.restore();
}
