  import { DraftTemplate, SavedCanvasObject } from "../types";
  import { loadRegularImagePromise } from "./imageUtils";
  import { loadPsdOntoCanvas } from "./psdConverter";
  
  // Simplify loadTemplateImage to just load the template without variations
  export const renderEditorOrPreview = async (
    fabricCanvas: fabric.Canvas,
    template: DraftTemplate,
    variations: any[],
    savedObjects: SavedCanvasObject[],
    width: number,
    height: number,
  ): Promise<void> => {
    // Check if we have a valid image URL
    if (!template.file?.viewUrl) {
      return Promise.resolve();
    }

    const file = template.file;

    const imageUrl = file.viewUrl;

    // Check if this might be a PSD file
    const isPsd = imageUrl.toLowerCase().endsWith('.psd')
    || (file.mimetype && file.mimetype.includes('photoshop'));

    // If it's a PSD file, use our specialized function to process it
    if (isPsd) {
      // First, check if the canvas is still valid
      try {
        // Process the PSD file
        await loadPsdOntoCanvas(fabricCanvas, imageUrl, variations, savedObjects, width, height);
        return Promise.resolve();
      } catch (error) {
        // If PSD processing fails, fall back to our regular image loading
        await loadRegularImagePromise(fabricCanvas, template, width, height);
        return Promise.resolve();
      }
    }

    // For non-PSD files, use the regular image loading approach
    await loadRegularImagePromise(fabricCanvas, template, width, height);
    return Promise.resolve();
  };
