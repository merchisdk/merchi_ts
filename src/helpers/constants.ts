/** Selectable field types whose `value` is option ids (vs. free text/number). */
export const OPTION_FIELD_TYPES = new Set([2, 6, 7, 9, 11]);

/** Colour Extract: image upload + runtime-generated colour options. */
export const COLOUR_EXTRACT = 13;

/** Area: height × width stored as millimetres (`"heightMm,widthMm"`). */
export const AREA = 14;

/** Field types that carry uploaded files on the variation. */
export const FILE_FIELD_TYPES = new Set([3, COLOUR_EXTRACT]);
