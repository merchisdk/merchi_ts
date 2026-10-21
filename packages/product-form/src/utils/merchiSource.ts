export function cleanTagIds(raw: string[]): number[] {
  return raw.map(id => id.trim())
    .filter(id => /^\d+$/.test(id))
    .map(id => Number(id));
}

export function getMerchiSourceJobTags(): { id: number }[] {
  let merchiSource: string | null;
  try {
    // Accessing the storage property itself can throw in restricted browsers.
    merchiSource = typeof localStorage === 'undefined' || localStorage === null
      ? null
      : localStorage.getItem('merchi_source');
  } catch {
    // Optional attribution must not prevent the product form from rendering.
    return [];
  }
  return merchiSource ? cleanTagIds(merchiSource.split(',')).map(id => ({ id })) : [];
}
