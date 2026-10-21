function cleanIds(raw: any[]) {
  return raw.map(id => id.trim())            // Trim each ID entry to remove whitespace
    .filter(id => /^\d+$/.test(id))  // Use a regular expression to ensure the ID is entirely numeric.
    .map(id => Number(id));          // Convert the remaining, valid ID entries into numbers
}

export function getMerchiSourceJobTagEntities(): any[] {
  let merchiSource: string | null;
  try {
    merchiSource = typeof localStorage === 'undefined' || localStorage === null
      ? null
      : localStorage.getItem('merchi_source');
  } catch {
    // Optional attribution must not interrupt checkout when storage is blocked.
    return [];
  }
  return merchiSource ? cleanIds(merchiSource.split(',')).map(id => ({ id })) : [];
}

export function clearMerchiSource() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.removeItem('merchi_source');
    }
  } catch {
    // Checkout can still complete when attribution storage is unavailable.
  }
}
