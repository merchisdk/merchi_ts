import { DraftTemplateData, DraftPreview, DraftPreviewLayer } from '../types';

/**
 * Gets all unique draft previews from the draft templates
 * Loops through each template's draftPreviewLayers to collect associated previews
 * 
 * @param draftTemplates Array of draft templates with their variation data
 * @returns Array of unique draft previews
 */
export function setNewDraftPreviews(draftTemplates: DraftTemplateData[]): DraftPreview[] {
  // Create a map to track which previews we've already included by ID
  const includedPreviewIds = new Set<number>();
  const draftPreviews: DraftPreview[] = [];

  // Loop through each draft template
  draftTemplates.forEach((draftTemplateData) => {
    const { template } = draftTemplateData;
    
    // Skip if the template doesn't have preview layers
    if (!template.draftPreviewLayers || template.draftPreviewLayers.length === 0) {
      return;
    }
    
    // Look through each preview layer to find associated previews
    template.draftPreviewLayers.forEach((layer: DraftPreviewLayer) => {
      // If the layer has a preview and we haven't already included it
      if (layer.draftPreview && layer.draftPreview.id) {
        const previewId = layer.draftPreview.id;
        
        if (!includedPreviewIds.has(previewId)) {
          // Add to our tracking set
          includedPreviewIds.add(previewId);
          
          // Add the preview to our result array
          draftPreviews.push(layer.draftPreview);
        }
      }
    });
  });

  // Return the unique list of previews
  return draftPreviews;
}
