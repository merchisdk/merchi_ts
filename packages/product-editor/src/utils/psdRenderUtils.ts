import { readPsd } from 'ag-psd';
import { MappedPreview } from '../types';

/**
 * Find a layer by name within a PSD layer structure
 * 
 * @param layers The array of PSD layers to search through
 * @param name The name of the layer to find
 * @returns The found layer or null if not found
 */
function findLayerByName(layers: any[] | undefined, name: string): any | null {
  if (!layers) return null;

  for (const layer of layers) {
    if (layer.name === name) {
      return layer;
    }

    if (layer.children) {
      const found = findLayerByName(layer.children, name);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Load an image from a URL
 * 
 * @param url URL of the image to load
 * @returns Promise that resolves to an HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image from URL: ${url}, error: ${e}`));

    img.src = url;
  });
}

/**
 * Validates if a data URL represents a valid image
 * 
 * @param dataUrl The data URL to validate
 * @returns Promise that resolves to true if valid, false otherwise
 */
async function isValidImageDataUrl(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      console.warn('Invalid data URL format');
      resolve(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Check if the image has actual dimensions
      if (img.width > 0 && img.height > 0) {
        resolve(true);
      } else {
        console.warn('Image loaded but has zero dimensions');
        resolve(false);
      }
    };
    img.onerror = () => {
      console.warn('Failed to load image from data URL');
      resolve(false);
    };
    img.src = dataUrl;
  });
}

/**
 * Creates a fallback preview image with debugging information
 * 
 * @param width Width of the image
 * @param height Height of the image
 * @param draftPreviewId ID of the draft preview
 * @param error Optional error message
 * @returns PNG data URL
 */
function createFallbackImage(width: number, height: number, draftPreviewId: number | undefined, error?: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(width || 300, 300);
  canvas.height = Math.max(height || 200, 200);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    // Even more basic fallback if context fails
    const basicCanvas = document.createElement('canvas');
    basicCanvas.width = 300;
    basicCanvas.height = 200;
    const basicCtx = basicCanvas.getContext('2d');
    if (basicCtx) {
      basicCtx.fillStyle = '#ffcccc';
      basicCtx.fillRect(0, 0, 300, 200);
      basicCtx.fillStyle = '#990000';
      basicCtx.font = '16px Arial';
      basicCtx.textAlign = 'center';
      basicCtx.fillText('Preview failed', 150, 100);
      return basicCanvas.toDataURL('image/png');
    }
    return '';
  }

  // Background
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw a grid pattern
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  const gridSize = 20;

  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Preview text
  ctx.fillStyle = '#666666';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Preview', canvas.width / 2, canvas.height / 2 - 15);

  // Preview ID
  if (draftPreviewId !== undefined) {
    ctx.font = '16px Arial';
    ctx.fillText(`ID: ${draftPreviewId}`, canvas.width / 2, canvas.height / 2 + 15);
  }

  // Error message if provided
  if (error) {
    ctx.fillStyle = '#cc0000';
    ctx.font = '14px Arial';
    ctx.fillText(error, canvas.width / 2, canvas.height / 2 + 40);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Converts a data URL to a canvas element
 * 
 * @param dataUrl The data URL to convert
 * @returns Promise that resolves to a Canvas element
 */
async function dataUrlToCanvas(dataUrl: string): Promise<HTMLImageElement> {
  // First load the data URL as an image
  return await loadImage(dataUrl);
}

/**
 * Process mapped previews, replacing layers in PSD files with rendered layers
 * and converting the results to PNG images
 * 
 * @param mappedPreviews Array of mapped previews with draftPreview and draftPreviewLayers
 * @returns Promise that resolves to an array of processed previews with PNG data URLs
 */
export async function renderDraftPreviewsWithLayers(
  mappedPreviews: MappedPreview[]
): Promise<Array<{ draftPreviewId: number | undefined; pngDataUrl: string }>> {
  const results: Array<{ draftPreviewId: number | undefined; pngDataUrl: string }> = [];

  // Process each preview one by one
  for (const mappedPreview of mappedPreviews) {
    const { draftPreview, draftPreviewLayers } = mappedPreview;

    // Skip if there's no file to process
    if (!draftPreview?.file?.viewUrl) {
      console.warn('Skipping preview without a file URL', draftPreview?.id);
      continue;
    }

    // Check if there are any actual rendered layers we need to use
    const hasRenderedLayers = draftPreviewLayers.some(layer => layer.renderedLayer !== null);

    // Only try the simple approach if it's not a PSD file
    let simplePngDataUrl: string | null = null;

    // If we need to do layer replacement, proceed with PSD processing
    try {
      // Fetch the PSD file
      const response = await fetch(draftPreview.file.viewUrl, {
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Accept': '*/*',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PSD file: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Check if we actually got a PSD file (PSD files start with '8BPS')
      const firstBytes = new Uint8Array(arrayBuffer, 0, 4);
      const signature =
        String.fromCharCode(firstBytes[0]) +
        String.fromCharCode(firstBytes[1]) +
        String.fromCharCode(firstBytes[2]) +
        String.fromCharCode(firstBytes[3]);

      if (signature !== '8BPS') {
        // Use the simple approach result if we have it
        if (simplePngDataUrl) {
          results.push({
            draftPreviewId: draftPreview.id,
            pngDataUrl: simplePngDataUrl
          });
          continue;
        }
        throw new Error('Not a PSD file and simple approach failed');
      }

      // Read the PSD file
      const psd = readPsd(arrayBuffer, {
        skipCompositeImageData: false,
        skipLayerImageData: false,
        skipThumbnail: false
      });

      // Create a canvas to draw the composite image
      const canvas = document.createElement('canvas');
      canvas.width = psd.width || 500;  // Default size if missing
      canvas.height = psd.height || 400;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas 2d context');
      }

      // Draw a background to ensure we have something visible
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // First draw the composite image as a base
      if (psd.imageData) {
        const imageData = new ImageData(
          new Uint8ClampedArray(psd.imageData.data),
          psd.width,
          psd.height
        );
        ctx.putImageData(imageData, 0, 0);
      }

      // Now draw base layers that aren't being replaced
      if (psd.children && psd.children.length > 0) {
        for (const layer of psd.children) {
          // Skip if this layer is hidden or matches one of our replaceable layers
          const shouldReplace = draftPreviewLayers.some(dpl =>
            dpl.layerName === layer.name && dpl.renderedLayer !== null
          );

          if (!shouldReplace && !layer.hidden && layer.canvas) {
            // Draw the original layer
            ctx.drawImage(layer.canvas, layer.left || 0, layer.top || 0);
            ctx.globalAlpha = 1;
          }
        }
      }

      // Now process and draw each replacement layer
      if (hasRenderedLayers) {
        for (const draftPreviewLayer of draftPreviewLayers) {
          // Skip if no layer name or no rendered layer
          if (!draftPreviewLayer.layerName || !draftPreviewLayer.renderedLayer) {
            continue;
          }

          // Find the corresponding layer in the PSD
          const psdLayer = findLayerByName(psd.children, draftPreviewLayer.layerName);

          if (!psdLayer) {
            console.warn(`Layer "${draftPreviewLayer.layerName}" not found in PSD`);
            continue;
          }

          // Load the rendered image
          try {
            // Validate the rendered layer image URL
            if (!draftPreviewLayer.renderedLayer.draft ||
              !draftPreviewLayer.renderedLayer.draft.startsWith('data:image/')) {
              throw new Error('Invalid image URL format');
            }

            // Convert the data URL to a canvas element instead of an image
            const layerCanvas = await dataUrlToCanvas(draftPreviewLayer.renderedLayer.draft);

            // Validate the canvas dimensions
            if (layerCanvas.width <= 0 || layerCanvas.height <= 0) {
              console.error('Canvas has invalid dimensions');
              throw new Error('Invalid canvas dimensions');
            }

            // Use the position and dimensions of the original PSD layer
            const left = psdLayer.left || 0;
            const top = psdLayer.top || 0;
            const width = (psdLayer.right || 0) - (psdLayer.left || 0);
            const height = (psdLayer.bottom || 0) - (psdLayer.top || 0);

            if (width <= 0 || height <= 0) {
              console.warn(`Invalid layer dimensions: ${width}x${height}, skipping`);
              continue;
            }

            // Calculate how to fit the canvas within the layer bounds
            const aspectRatio = layerCanvas.width / layerCanvas.height;
            const targetAspectRatio = width / height;

            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

            if (aspectRatio > targetAspectRatio) {
              // Canvas is wider than target area
              drawWidth = width;
              drawHeight = width / aspectRatio;
              offsetY = (height - drawHeight) / 2;
            } else {
              // Canvas is taller than target area
              drawHeight = height;
              drawWidth = height * aspectRatio;
              offsetX = (width - drawWidth) / 2;
            }

            // Draw the rendered layer canvas
            // ctx.globalAlpha = psdLayer.opacity !== undefined ? psdLayer.opacity / 255 : 1;
            ctx.restore();
            ctx.drawImage(layerCanvas, left + offsetX, top + offsetY, drawWidth, drawHeight);
            ctx.globalAlpha = 1;

            ctx.save();


          

          } catch (error) {
            console.error(`Failed to load rendered layer image for "${draftPreviewLayer.layerName}"`, error);

            // If we fail to load the replacement, draw the original layer as fallback
            if (psdLayer.canvas) {
              ctx.globalAlpha = psdLayer.opacity !== undefined ? psdLayer.opacity / 255 : 1;
              ctx.drawImage(psdLayer.canvas, psdLayer.left || 0, psdLayer.top || 0);
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      // Verify that something was drawn
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasVisiblePixels = false;

      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) {
          hasVisiblePixels = true;
          break;
        }
      }

      if (!hasVisiblePixels) {
        console.warn('WARNING: Canvas appears to be completely transparent!');

        // Use the simple approach result if available
        if (simplePngDataUrl) {
          results.push({
            draftPreviewId: draftPreview.id,
            pngDataUrl: simplePngDataUrl
          });
          continue;
        }

        // As a last resort, draw a visible placeholder
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(150, 150, 150, 1)';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Preview', canvas.width / 2, canvas.height / 2);
      }

      // Convert the canvas to a PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png');

      // Validate the PNG data URL
      const isValid = await isValidImageDataUrl(pngDataUrl);
      if (!isValid) {
        console.warn('Generated PNG data URL is not valid!');

        // Use the simple approach as fallback if available
        if (simplePngDataUrl) {
          results.push({
            draftPreviewId: draftPreview.id,
            pngDataUrl: simplePngDataUrl
          });
        } else {
          // Create a debug fallback image with error information
          const fallbackPng = createFallbackImage(500, 400, draftPreview.id, 'Invalid PNG data');
          results.push({
            draftPreviewId: draftPreview.id,
            pngDataUrl: fallbackPng
          });
        }
      } else {
        // Add the result to our array
        results.push({
          draftPreviewId: draftPreview.id,
          pngDataUrl
        });
      }

    } catch (error) {
      console.error('Failed to process PSD file for draft preview:', error);

      // Use the simple approach as fallback if available
      if (simplePngDataUrl) {
        results.push({
          draftPreviewId: draftPreview.id,
          pngDataUrl: simplePngDataUrl
        });
      } else {
        // Create a debug fallback image with error information
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const fallbackPng = createFallbackImage(500, 400, draftPreview.id, errorMessage);
        results.push({
          draftPreviewId: draftPreview.id,
          pngDataUrl: fallbackPng
        });
      }
    }
  }
  return results;
}
