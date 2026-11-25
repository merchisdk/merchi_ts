import { cssFontFamily, DEFAULT_DRAFT_FONT, loadDraftFonts } from './draftFonts';
import { isBackgroundFill, isFullArtboardFill, renderSwirlCanvas, unclipTextBox } from './draftTemplates';
import { DraftCanvasObject, DraftCanvasState } from './types';

function resolveFileUrl(url: string, apiUrl?: string): string {
  if (!url) return '';
  if (/^(data:|blob:|https?:)/i.test(url)) return url;
  if (!apiUrl) return url;
  try {
    const api = new URL(apiUrl);
    if (url.startsWith('/')) return `${api.origin}${url}`;
    return new URL(url, apiUrl).href;
  } catch {
    return url;
  }
}

export function templateImageSources(template: any, apiUrl?: string): string[] {
  const file = template?.file || {};
  const raw: string[] = [];
  if (apiUrl && file.id) {
    const base = String(apiUrl).replace(/\/?$/, '/');
    raw.push(`${base}public-files/${file.id}/view/`);
  }
  raw.push(
    file.viewUrl,
    file.cachedViewUrl,
    file.downloadUrl,
    file.cachedDownloadUrl,
  );
  return [...new Set(
    raw.filter(Boolean).map((url) => resolveFileUrl(String(url), apiUrl)),
  )];
}

export function templateDownloadHref(template: any, apiUrl?: string): string {
  const file = template?.file;
  if (!file) return '';
  // Presigned S3 download URLs expire. Public storefronts cache the product
  // payload for longer than that lifetime, so a file id always downloads
  // through the API, which signs a fresh URL on each request.
  if (apiUrl && file.id != null && file.id !== '') {
    const base = String(apiUrl).replace(/\/?$/, '/');
    return `${base}public-files/${encodeURIComponent(String(file.id))}/download/`;
  }
  const preferred = file.downloadUrl || file.cachedDownloadUrl;
  if (preferred) return resolveFileUrl(String(preferred), apiUrl);
  return templateImageSources(template, apiUrl)[0] || '';
}

function loadImageElement(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadHtmlImage(
  src: string,
  persistObjectUrl = false,
): Promise<HTMLImageElement> {
  if (!src) throw new Error('Missing image source');
  if (/^(data:|blob:)/i.test(src)) {
    return loadImageElement(src, false);
  }
  try {
    const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = await loadImageElement(objectUrl, false);
    if (persistObjectUrl) {
      (image as HTMLImageElement & { _merchiObjectUrl?: string })._merchiObjectUrl = objectUrl;
    } else {
      URL.revokeObjectURL(objectUrl);
    }
    return image;
  } catch {
    return loadImageElement(src, true);
  }
}

export async function loadHtmlImageFromSources(
  sources: string[],
  persistObjectUrl = false,
): Promise<HTMLImageElement> {
  let lastError: unknown;
  for (const src of sources) {
    try {
      return await loadHtmlImage(src, persistObjectUrl);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load image');
}

export function draftTextStyle(obj: DraftCanvasObject) {
  return {
    text: obj.text || 'Text',
    fontSize: obj.fontSize || 48,
    fill: obj.fill || '#111111',
    fontFamily: cssFontFamily(obj.fontFamily),
    align: obj.align || 'left',
    verticalAlign: 'middle',
    lineHeight: 1,
    wrap: 'none',
  };
}

export function backgroundComposite(
  obj: DraftCanvasObject,
  artWidth: number,
  artHeight: number,
): GlobalCompositeOperation {
  return obj.multiplyFill || isFullArtboardFill(obj, artWidth, artHeight)
    ? 'multiply'
    : 'source-over';
}

export async function exportDraftPngs(
  state: DraftCanvasState,
  templateSources: string[],
  fixedSizeFieldIds: number[],
): Promise<{ draft: string; canvasPreview: string }> {
  const fonts = state.objects
    .filter((obj) => obj.type === 'text')
    .map((obj) => obj.fontFamily || DEFAULT_DRAFT_FONT);
  const [{ default: Konva }, template, artworkImages] = await Promise.all([
    import('konva'),
    templateSources.length
      ? loadHtmlImageFromSources(templateSources).catch(() => undefined)
      : undefined,
    Promise.all(state.objects.map((obj) => {
      if (obj.type !== 'image' || !obj.src) return undefined;
      return loadHtmlImage(obj.src).catch(() => {
        throw new Error('Could not load an artwork image. Check the image and try again.');
      });
    })),
    fonts.length ? loadDraftFonts(fonts) : undefined,
  ]);
  const width = Math.max(1, Math.round(state.width));
  const height = Math.max(1, Math.round(state.height));
  const artboard = new Konva.Group();
  const background = new Konva.Group();
  artboard.add(background);

  try {
    background.add(new Konva.Rect({ width, height, fill: '#ffffff' }));
    if (template) background.add(new Konva.Image({ image: template, width, height }));

    const fills = new Konva.Group();
    const artwork = new Konva.Group();
    artboard.add(fills, artwork);
    state.objects.forEach((obj, index) => {
      const image = artworkImages[index];
      const fixedSize = obj.merchiFieldId != null
        && fixedSizeFieldIds.includes(Number(obj.merchiFieldId));
      const shown = obj.type === 'text' && !fixedSize ? unclipTextBox(obj) : obj;
      const { x, y, width, height, rotation, scaleX, scaleY } = shown;
      const geometry = { x, y, width, height, rotation, scaleX, scaleY };
      if (isBackgroundFill(obj)) {
        const globalCompositeOperation = backgroundComposite(obj, state.width, state.height);
        const pattern = obj.fillStyle === 'swirl' && (obj.fills || []).length > 1
          ? renderSwirlCanvas(width, height, obj.fills || [])
          : null;
        fills.add(pattern
          ? new Konva.Image({ ...geometry, image: pattern, globalCompositeOperation })
          : new Konva.Rect({ ...geometry, fill: obj.fill || '#cccccc', globalCompositeOperation }));
      } else if (obj.type === 'text') {
        artwork.add(new Konva.Text({ ...geometry, ...draftTextStyle(obj) }));
      } else if (image) {
        artwork.add(new Konva.Image({ ...geometry, image }));
      }
    });

    const bounds = { x: 0, y: 0, width, height, mimeType: 'image/png' };
    const canvasPreview = artboard.toDataURL(bounds);
    background.hide();
    const draft = artboard.toDataURL(bounds);
    if (!draft.startsWith('data:image/png;') || !canvasPreview.startsWith('data:image/png;')) {
      throw new Error('Could not render the artwork preview');
    }
    return { draft, canvasPreview };
  } finally {
    artboard.destroy();
  }
}
