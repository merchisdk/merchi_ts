import { JobJson } from '../types/job';
import { VariationJson, VariationsGroupJson } from '../types/variation';

const FORM_ONLY_VARIATION_KEYS = ['id', 'variationArrayFieldId', 'json', 'groupId'];

function cleanVariation(variation: VariationJson): VariationJson {
  const copy: Record<string, unknown> = { ...(variation as Record<string, unknown>) };
  for (const key of FORM_ONLY_VARIATION_KEYS) {
    delete copy[key];
  }
  return copy as VariationJson;
}

/** Return a deep-ish copy of the job with variations/groups cleaned for the API:
 * form-only fields removed, zero-quantity groups dropped, and each remaining
 * group's quantity defaulted to 0 when missing. Does not mutate the input
 * (unlike merchi_product_form's in-place cleaner). */
export function serializeJob(job: JobJson): JobJson {
  const out: JobJson = { ...job };
  if (Array.isArray(job.variations)) {
    out.variations = job.variations.map(cleanVariation);
  }
  if (Array.isArray(job.variationsGroups)) {
    out.variationsGroups = nonEmptyGroups(
      job.variationsGroups.map((group) => {
        const cleaned: VariationsGroupJson = {
          ...group,
          quantity: group.quantity ?? 0,
        };
        if (Array.isArray(group.variations)) {
          cleaned.variations = group.variations.map(cleanVariation);
        }
        return cleaned;
      }),
    );
  }
  return out;
}

/** Keep only groups whose quantity is greater than zero. */
export function nonEmptyGroups(
  groups: VariationsGroupJson[],
): VariationsGroupJson[] {
  return groups.filter((g) => (g.quantity ?? 0) > 0);
}
