/** Colour Picker answers: one hex, or a JSON list when the field repeats. */

export const COLOUR_REPEAT_CAP = 8;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normaliseHex(value: unknown): string | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (!text) return null;
  if (/^[0-9a-f]{6}$/i.test(text)) text = `#${text}`;
  if (!HEX.test(text)) return null;
  if (text.length === 4) {
    text = `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  return text.toUpperCase();
}

export function colourRepeatBounds(field: any): { min: number; max: number } {
  const rawMax = Number(field?.colourRepeatMax);
  const max = Number.isFinite(rawMax) && rawMax > 1
    ? Math.min(COLOUR_REPEAT_CAP, Math.round(rawMax))
    : 1;
  const rawMin = Number(field?.colourRepeatMin);
  const min = Number.isFinite(rawMin) && rawMin > 0
    ? Math.min(max, Math.round(rawMin))
    : 1;
  return { min, max };
}

/** Colours in a repeatable picker value. Null when the value is a single colour. */
export function colourPickerList(value: unknown): string[] | null {
  const raw = String(value ?? '').trim();
  if (!raw.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item) => normaliseHex(item))
      .filter((item): item is string => Boolean(item));
  } catch {
    return null;
  }
}

export function coloursFromPickerValue(value: unknown): string[] {
  const list = colourPickerList(value);
  if (list) return list;
  const one = normaliseHex(value);
  return one ? [one] : [];
}

export function pickerValueFromColours(colours: string[]): string {
  const filled = colours
    .map((colour) => normaliseHex(colour))
    .filter((colour): colour is string => Boolean(colour));
  if (!filled.length) return '';
  return JSON.stringify(filled);
}

export function colourRepeatError(value: unknown, field: any): string | null {
  const { min, max } = colourRepeatBounds(field);
  const name = field?.name || 'Colour';
  if (max <= 1) {
    if (field?.required && !String(value ?? '').trim()) return `${name} is required`;
    return null;
  }
  const colours = coloursFromPickerValue(value);
  if (!colours.length) return field?.required ? `${name} is required` : null;
  if (colours.length < min) {
    return min === 1 ? `${name} is required` : `Choose at least ${min} colours`;
  }
  if (colours.length > max) return `Choose at most ${max} colours`;
  return null;
}
