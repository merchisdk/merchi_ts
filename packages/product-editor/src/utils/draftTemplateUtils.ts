import { DraftPreview, DraftTemplateData, RenderedDraftPreview, DraftPreviewLayer } from '../types';

/**
 * Compares two arrays of draft templates to determine if they've changed significantly
 * This helps prevent unnecessary re-renders and infinite loops
 * 
 * @param oldTemplates The previous draft templates array
 * @param newTemplates The new draft templates array
 * @returns True if templates have changed, false if they're effectively the same
 */
export function haveDraftTemplatesChanged(
  oldTemplates: Array<{ template: any; variationObjects: any[] }>,
  newTemplates: Array<{ template: any; variationObjects: any[] }>
): boolean {
  // Quick length check
  if (!oldTemplates || !newTemplates) return true;
  if (oldTemplates.length !== newTemplates.length) return true;
  
  // Check if template IDs are the same and in the same order
  const oldIds = oldTemplates.map(dt => dt.template.id).join(',');
  const newIds = newTemplates.map(dt => dt.template.id).join(',');
  
  if (oldIds !== newIds) return true;

  // Deep check each template for significant changes
  for (let i = 0; i < oldTemplates.length; i++) {
    const oldTemplate = oldTemplates[i];
    const newTemplate = newTemplates[i];
    
    // Check for template property changes
    if (oldTemplate.template.id !== newTemplate.template.id) return true;
    if (oldTemplate.template.name !== newTemplate.template.name) return true;
    if (oldTemplate.template.width !== newTemplate.template.width) return true;
    if (oldTemplate.template.height !== newTemplate.template.height) return true;
    
    // Check variation objects count
    if (oldTemplate.variationObjects.length !== newTemplate.variationObjects.length) return true;
    
    // We could do more detailed checking of variation objects here,
    // but for performance we'll assume if counts are the same and template properties 
    // are the same, the variations probably haven't changed enough to warrant a full re-render
  }
  
  // Templates are effectively the same
  return false;
}

export function mapPreviewsWithRendered(
  draftTemplates: DraftTemplateData[],
  draftPreviews: DraftPreview[],
  renderedDraftPreviews: RenderedDraftPreview[]
): { draftPreview: DraftPreview; draftPreviewLayers: { layerName: string | undefined; renderedLayer: RenderedDraftPreview | null }[] }[] {
  return draftPreviews.map((draftPreview: DraftPreview) => {
    // Map each draftTemplate to its associated layers and rendered layers
    const draftPreviewLayers = draftTemplates.flatMap((dTD: DraftTemplateData) => {
      const layers = dTD?.template?.draftPreviewLayers || [];
      return layers
        .filter((dPL: DraftPreviewLayer) => dPL?.draftPreview?.id === draftPreview.id)
        .map(layer => {
          const renderedLayer = renderedDraftPreviews.find(rDR => rDR?.templateId === dTD?.template?.id);
          return { layerName: layer?.layerName, renderedLayer: renderedLayer || null };
        });
    });

    return {
      draftPreview,
      draftPreviewLayers,
    };
  });
}
