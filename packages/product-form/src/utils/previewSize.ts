/** Size variants share one solid. The preview scales glTF Y to the selected template. */

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

function millimetresIn(text?: string | null): number | null {
  if (!text) return null;
  const mm = text.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
  if (mm) return roundMm(Number(mm[1]));
  const cm = text.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
  if (cm) return roundMm(Number(cm[1]) * 10);
  const mixed = text.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(?:inches|inch|in)\b/i);
  if (mixed) return roundMm((Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])) * 25.4);
  const fraction = text.match(/(\d+)\s*\/\s*(\d+)\s*(?:inches|inch|in)\b/i);
  if (fraction && Number(fraction[2]) !== 0) {
    return roundMm((Number(fraction[1]) / Number(fraction[2])) * 25.4);
  }
  const inch = text.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in)\b/i);
  if (inch) return roundMm(Number(inch[1]) * 25.4);
  return null;
}

export function templateMillimetres(template: any): number | null {
  const options = template?.selectedByVariationFieldOptions || [];
  for (const option of options) {
    const explicit = String(option?.value || '').match(/(\d+(?:\.\d+)?)\s*mm\b/i);
    if (explicit) return roundMm(Number(explicit[1]));
  }
  const named = String(template?.name || '').match(/(\d+(?:\.\d+)?)\s*mm\b/i);
  if (named) return roundMm(Number(named[1]));
  for (const option of options) {
    const parsed = millimetresIn(option?.value);
    if (parsed) return parsed;
  }
  return millimetresIn(template?.name);
}

function faceRole(name: string): 'front' | 'back' | 'other' {
  const parts = name.toLowerCase().split(/[^a-z]+/);
  if (parts.some((part) => ['back', 'backs', 'inside', 'insides', 'rear', 'rears', 'reverse', 'reverses'].includes(part))) {
    return 'back';
  }
  if (parts.some((part) => ['front', 'fronts', 'outside', 'outsides'].includes(part))) return 'front';
  return 'other';
}

function bareName(name: string): string {
  return name
    .replace(/\d+(?:\.\d+)?\s*mm\b/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*cm\b/gi, ' ')
    .replace(/\d+\s+\d+\s*\/\s*\d+\s*(?:inches|inch|in)\b/gi, ' ')
    .replace(/\d+\s*\/\s*\d+\s*(?:inches|inch|in)\b/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:inches|inch|in)\b/gi, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
}

export function faceKey(name?: string): string {
  const role = faceRole(name || '');
  if (role !== 'other') return role;
  const stem = bareName(name || '').toLowerCase().replace(/\s+/g, '_') || 'face';
  return `other:${stem}`;
}

function materialName(key: string, names: string[]): string {
  if (key === 'front') return names.some((name) => /\boutsides?\b/i.test(name)) ? 'Print_outside' : 'Print_front';
  if (key === 'back') return names.some((name) => /\binsides?\b/i.test(name)) ? 'Print_inside' : 'Print_back';
  const stem = key.replace(/^other:/, '') || 'face';
  return `Print_${stem}`;
}

function sizeGroups(catalog: any[]): Map<number, any[]> | null {
  const groups = new Map<number, any[]>();
  (catalog || []).forEach((template) => {
    const millimetres = templateMillimetres(template);
    if (millimetres == null) return;
    const group = groups.get(millimetres) || [];
    group.push(template);
    groups.set(millimetres, group);
  });
  if (groups.size < 2) return null;
  const signatures = [...groups.values()].map((group) => (
    [...new Set(group.map((template) => faceKey(template?.name)))].sort().join('|')
  ));
  if (new Set(signatures).size !== 1) return null;
  return groups;
}

function sharedMaterialNames(groups: Map<number, any[]>): Set<string> {
  const names = new Set<string>();
  const reference = Math.max(...groups.keys());
  const faces = new Set((groups.get(reference) || []).map((template) => faceKey(template?.name)));
  faces.forEach((key) => {
    const labelled = [...groups.values()].flat().filter((template) => faceKey(template?.name) === key);
    names.add(materialName(key, labelled.map((template) => template?.name || '')));
  });
  return names;
}

function usesSharedMaterials(
  catalog: any[],
  surfaces: { materialName?: string; role?: string }[],
): boolean {
  const groups = sizeGroups(catalog);
  if (!groups) return false;
  const printNames = (surfaces || [])
    .filter((surface) => surface.role === 'print' && surface.materialName)
    .map((surface) => surface.materialName as string);
  const expected = sharedMaterialNames(groups);
  return printNames.length > 0 && printNames.every((name) => expected.has(name));
}

export function previewScaleY(
  catalog: any[],
  activeTemplateId: number | null | undefined,
  surfaces: { materialName?: string; role?: string }[],
): number {
  const groups = sizeGroups(catalog);
  if (!groups || !usesSharedMaterials(catalog, surfaces)) return 1;
  const active = (catalog || []).find((template) => Number(template?.id) === Number(activeTemplateId));
  const selected = active ? templateMillimetres(active) : null;
  if (selected == null) return 1;
  const reference = Math.max(...groups.keys());
  return reference > 0 ? selected / reference : 1;
}

export function templateForSurface(
  surface: { templateId?: number | null; role?: string; materialName?: string },
  visible: any[],
  catalog: any[],
  activeTemplateId: number | null | undefined,
  surfaces: { materialName?: string; role?: string }[],
): any | null {
  const boundId = Number(surface.templateId);
  const inVisible = (visible || []).find((template) => Number(template?.id) === boundId);
  if (!usesSharedMaterials(catalog, surfaces)) return inVisible || null;
  const bound = (catalog || []).find((template) => Number(template?.id) === boundId) || inVisible;
  if (!bound) return null;
  const key = faceKey(bound?.name);
  const active = (catalog || []).find((template) => Number(template?.id) === Number(activeTemplateId));
  const activeMm = active ? templateMillimetres(active) : null;
  const sameSize = (visible || []).find((template) => (
    faceKey(template?.name) === key && templateMillimetres(template) === activeMm
  ));
  if (sameSize) return sameSize;
  return (visible || []).find((template) => faceKey(template?.name) === key) || inVisible || null;
}
