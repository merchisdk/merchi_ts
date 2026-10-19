export const EMBROIDERY = 16;
export const MIN_EMBROIDERY_DPI = 100;

export interface EmbroideryValue {
  text?: string;
  widthMm?: number;
  heightMm?: number;
  colours?: string[];
  coverage?: number;
  pixelWidth?: number;
  pixelHeight?: number;
}

export function parseEmbroideryValue(value: any): EmbroideryValue | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function embroideryValueJson(value: EmbroideryValue): string {
  return JSON.stringify(value);
}

export function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

export function fitEmbroiderySize({
  width,
  height,
  changed,
  maxWidth,
  maxHeight,
  lock,
  ratio,
}: {
  width?: number;
  height?: number;
  changed?: 'width' | 'height';
  maxWidth?: number | null;
  maxHeight?: number | null;
  lock: boolean;
  ratio?: number | null;
}): { width?: number; height?: number } {
  let nextWidth = width;
  let nextHeight = height;
  if (lock && ratio && ratio > 0) {
    if (changed === 'width' && nextWidth) nextHeight = nextWidth / ratio;
    if (changed === 'height' && nextHeight) nextWidth = nextHeight * ratio;
  }
  if (!(nextWidth && nextHeight && nextWidth > 0 && nextHeight > 0)) {
    return { width: nextWidth, height: nextHeight };
  }
  if (lock) {
    let scale = 1;
    if (maxWidth && nextWidth > maxWidth) scale = Math.min(scale, maxWidth / nextWidth);
    if (maxHeight && nextHeight > maxHeight) scale = Math.min(scale, maxHeight / nextHeight);
    if (scale < 1) {
      nextWidth *= scale;
      nextHeight *= scale;
    }
  } else {
    if (maxWidth && nextWidth > maxWidth) nextWidth = maxWidth;
    if (maxHeight && nextHeight > maxHeight) nextHeight = maxHeight;
  }
  return { width: roundMm(nextWidth), height: roundMm(nextHeight) };
}

export function effectiveDpi(pixels?: number, mm?: number): number | null {
  if (!pixels || !mm || mm <= 0) return null;
  return pixels / (mm / 25.4);
}

export function embroideryQualityWarning(value: EmbroideryValue | null): string | null {
  if (!value) return null;
  const dpiW = effectiveDpi(value.pixelWidth, value.widthMm);
  const dpiH = effectiveDpi(value.pixelHeight, value.heightMm);
  const values = [dpiW, dpiH].filter((item): item is number => item != null);
  if (!values.length) return null;
  const dpi = Math.round(Math.min(...values));
  if (dpi >= MIN_EMBROIDERY_DPI) return null;
  return `Low quality at this size (${dpi} dpi). Upload a larger image, or reduce the size.`;
}

export function embroiderySummary(value: any): string {
  const parsed = parseEmbroideryValue(value);
  if (!parsed) return value ? String(value) : '';
  const parts: string[] = [];
  if (parsed.text) parts.push(String(parsed.text));
  if (parsed.widthMm && parsed.heightMm) {
    parts.push(`${parsed.widthMm} × ${parsed.heightMm} mm`);
  }
  const colours = parsed.colours?.length || 0;
  if (colours) parts.push(colours === 1 ? '1 colour' : `${colours} colours`);
  return parts.join(' · ');
}

export function variationValuePath(formValues: any, fieldId: number): string | null {
  const independent = formValues?.variations || [];
  const top = independent.findIndex(
    (variation: any) => Number(variation?.variationField?.id) === Number(fieldId)
  );
  if (top >= 0) return `variations.${top}.value`;
  const groups = formValues?.variationsGroups || [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const variations = groups[groupIndex]?.variations || [];
    const index = variations.findIndex(
      (variation: any) => Number(variation?.variationField?.id) === Number(fieldId)
    );
    if (index >= 0) return `variationsGroups.${groupIndex}.variations.${index}.value`;
  }
  return null;
}

export function embroideryMillimetres(
  widthPx: number,
  heightPx: number,
  template: any,
): { widthMm: number; heightMm: number } | null {
  const artW = Number(template?.width);
  const artH = Number(template?.height);
  const realW = Number(template?.widthMm);
  const realH = Number(template?.heightMm);
  if (!(artW > 0 && artH > 0 && realW > 0 && realH > 0)) return null;
  if (!(widthPx > 0 && heightPx > 0)) return null;
  return {
    widthMm: roundMm((widthPx / artW) * realW),
    heightMm: roundMm((heightPx / artH) * realH),
  };
}

export function embroideryPixels(
  widthMm: number,
  heightMm: number,
  template: any,
): { width: number; height: number } | null {
  const artW = Number(template?.width);
  const artH = Number(template?.height);
  const realW = Number(template?.widthMm);
  const realH = Number(template?.heightMm);
  if (!(artW > 0 && artH > 0 && realW > 0 && realH > 0)) return null;
  if (!(widthMm > 0 && heightMm > 0)) return null;
  return {
    width: (widthMm / realW) * artW,
    height: (heightMm / realH) * artH,
  };
}
