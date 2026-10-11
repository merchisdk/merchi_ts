export function clampVariationColumns(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(4, Math.max(1, Math.round(parsed)));
}

/** Null or 0 means the field takes the full width of the list. */
export function variationLayoutSpan(
  layoutSpan: number | null | undefined,
  columns: number,
): number {
  const count = clampVariationColumns(columns);
  if (layoutSpan == null || layoutSpan <= 0) return count;
  return Math.min(Math.round(layoutSpan), count);
}
