import { fabric } from 'fabric';
import { readPsd } from 'ag-psd';
import { generateUniqueId } from './job';
import { SavedCanvasObject } from '../types';

// Extended Canvas interface with our custom properties
interface ExtendedCanvas extends fabric.Canvas {
  designBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  psdUrl?: string;
  anythingABC?: string;
}

/**
 * Extracts layers from a PSD file and renders them to a PNG
 * 
 * @param psdUrl URL to the PSD file
 * @returns Promise that resolves to a PNG data URL
 */
export const extractPsdBaseLayer = async (psdUrl: string): Promise<{ dataUrl: string, designBounds?: { left: number, top: number, right: number, bottom: number } }> => {
  try {

    // Fetch the PSD file
    const response = await fetch(psdUrl, {
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
      // TODO handle different file types
      console.warn('Warning: File does not have PSD signature. Got:', signature);
      // Continue anyway - the server might be returning a different format
    }

    try {
      // Use ag-psd to read the PSD file
      const psd = readPsd(
        arrayBuffer,
        {
          skipCompositeImageData: false,
          skipLayerImageData: false,
          skipThumbnail: false
        }
      );

      // Create a canvas to draw the layers
      const canvas = document.createElement('canvas');
      canvas.width = psd.width;
      canvas.height = psd.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Variable to store Design layer bounds, if found
      let designBounds: {
        left: number,
        top: number,
        right: number,
        bottom: number
      } | undefined;

      // If there are no layers or children, try to use the document itself
      if (!psd.children || psd.children.length === 0) {
        if (psd.imageData) {
          // If we have imageData on the main document, use it
          const imageData = new ImageData(
            new Uint8ClampedArray(psd.imageData.data),
            psd.width,
            psd.height
          );
          ctx.putImageData(imageData, 0, 0);
        } else {
          throw new Error('No layers or composite image data found in PSD');
        }
      } else {
        // Categorize and sort layers to handle special layers appropriately
        let layers = [...psd.children];
        let designLayer = null;
        let maskLayer = null;
        let contentLayers: any[] = [];

        // First pass - identify special layers and regular content layers
        for (const layer of layers) {
          if (layer.name === 'Design') {
            designLayer = layer;
            // Store design layer bounds for future reference
            if (typeof layer.left === 'number' &&
              typeof layer.top === 'number' &&
              typeof layer.right === 'number' &&
              typeof layer.bottom === 'number') {
              designBounds = {
                left: layer.left,
                top: layer.top,
                right: layer.right,
                bottom: layer.bottom
              };
            }
          } else if (layer.name === 'Mask') {
            maskLayer = layer;
          } else {
            contentLayers.push(layer);
          }
        }

        // Function to render a single layer
        const renderLayer = (layer: any, ctx: CanvasRenderingContext2D) => {
          // Check if the layer has a canvas
          if (layer.canvas &&
            typeof layer.left === 'number' &&
            typeof layer.top === 'number') {

            // Apply layer blending and opacity
            ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;

            // Draw this layer onto the main canvas at its position
            ctx.drawImage(
              layer.canvas,
              layer.left,
              layer.top
            );

            // Reset alpha
            ctx.globalAlpha = 1;
          } else if (layer.imageData &&
            typeof layer.left === 'number' &&
            typeof layer.top === 'number') {

            // Create a temporary canvas for this layer
            const layerCanvas = document.createElement('canvas');
            const width = layer.right - layer.left;
            const height = layer.bottom - layer.top;
            layerCanvas.width = width;
            layerCanvas.height = height;
            const layerCtx = layerCanvas.getContext('2d');

            if (layerCtx && layer.imageData) {
              // Create an ImageData object from the PSD image data
              const imageData = new ImageData(
                new Uint8ClampedArray(layer.imageData.data),
                width,
                height
              );

              // Put the layer's image data on this canvas
              layerCtx.putImageData(imageData, 0, 0);

              // Apply layer blending and opacity
              ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;

              // Draw this layer onto the main canvas at its position
              ctx.drawImage(
                layerCanvas,
                layer.left,
                layer.top
              );

              // Reset alpha
              ctx.globalAlpha = 1;
            }
          } else {
            console.warn(`Layer "${layer.name}" has no canvas or imageData`);
          }
        };

        // Function to recursively process layers and their children
        const processLayer = (layer: any, ctx: CanvasRenderingContext2D) => {
          // Skip hidden layers
          if (layer.hidden) {
            return;
          }

          // If this is a group layer with children, process its children
          if (layer.children && layer.children.length > 0) {
            // Process children
            const children = [...layer.children];
            children.forEach(child => processLayer(child, ctx));
            return;
          }

          // Render the actual layer
          renderLayer(layer, ctx);
        };

        // Render in the correct order:
        // 1. First render the "Design" layer (margins/boundaries)
        if (designLayer) {
          processLayer(designLayer, ctx);
        }

        // 2. Then render all content layers
        for (const layer of contentLayers) {
          processLayer(layer, ctx);
        }

        // 3. Finally render the "Mask" layer on top to hide overflow
        if (maskLayer) {
          processLayer(maskLayer, ctx);
        }
      }

      const dataUrl = canvas.toDataURL('image/png');

      // Return both the data URL and the design bounds if found
      return { dataUrl, designBounds };
    } catch (parseError) {
      // Try an alternative fallback approach - direct image extraction
      // Create a blob from the buffer and create an object URL
      const blob = new Blob([arrayBuffer], {
        type: response.headers.get('content-type') || 'application/octet-stream'
      });
      const objectUrl = URL.createObjectURL(blob);

      // Try loading as a regular image if the server actually returned an image
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(objectUrl);
          resolve({ dataUrl });
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not parse PSD or load as image'));
        };

        img.src = objectUrl;
      });
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Loads a PSD file onto a fabric.js canvas
 * 
 * @param canvas fabric.js Canvas instance
 * @param psdUrl URL to the PSD file
 * @param width Canvas width
 * @param height Canvas height
 * @returns Promise that resolves when the image is added to the canvas
 */
export const loadPsdOntoCanvas = async (
  canvas: ExtendedCanvas,
  psdUrl: string,
  variations: any[],
  savedObjects: SavedCanvasObject[],
  width: number,
  height: number
): Promise<void> => {
  try {
    // Store the canvas reference in a variable for checking
    const canvasRef = canvas;

    // Store the current psdUrl on the canvas to help track which operation is active
    canvasRef.psdUrl = psdUrl;

    // Get the rendered PSD and design bounds if available
    const { dataUrl, designBounds } = await extractPsdBaseLayer(psdUrl);

    return new Promise((resolve, reject) => {
      // Check if the canvas is still the same one that requested this operation
      if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
        console.warn('Canvas changed or disposed during PSD processing, aborting.');
        resolve();
        return;
      }

      fabric.Image.fromURL(dataUrl, (img) => {
        // Check again if the canvas is still valid
        if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
          console.warn('Canvas changed or disposed during image loading, aborting.');
          resolve();
          return;
        }

        if (!img || !img.width || !img.height) {
          reject(new Error('Failed to create fabric image from PSD'));
          return;
        }

        // Scale image to fit canvas
        const scale = Math.min(
          width / img.width,
          height / img.height
        );

        // Center the image - important for design bounds calculation
        const imgLeft = (width - img.width * scale) / 2;
        const imgTop = (height - img.height * scale) / 2;

        // Set image scale and position
        img.scaleX = scale;
        img.scaleY = scale;
        img.left = imgLeft;
        img.top = imgTop;
        img.selectable = false;
        img.evented = false;

        // Add image to canvas - check canvas validity first
        if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
          console.warn('Canvas changed or disposed before adding image, aborting.');
          resolve();
          return;
        }

        canvasRef.add(img);

        // If we have design bounds, store them for reference
        if (designBounds) {
          // Calculate scaled design bounds
          const scaledDesignBounds = {
            left: imgLeft + (designBounds.left * scale),
            top: imgTop + (designBounds.top * scale),
            width: (designBounds.right - designBounds.left) * scale,
            height: (designBounds.bottom - designBounds.top) * scale,
            right: imgLeft + (designBounds.right * scale),
            bottom: imgTop + (designBounds.bottom * scale)
          };

          // Check canvas validity before continuing
          if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
            console.warn('Canvas changed or disposed before adding design bounds, aborting.');
            resolve();
            return;
          }

          // Store on the canvas for future reference
          canvasRef.designBounds = scaledDesignBounds;

          // Add a visual indicator of the design area
          const boundaryRect = new fabric.Rect(({
            left: scaledDesignBounds.left,
            top: scaledDesignBounds.top,
            width: scaledDesignBounds.width,
            height: scaledDesignBounds.height,
            fill: 'transparent',
            stroke: 'rgba(255, 0, 0, 0.5)',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            id: 'design-boundary-rect'
          } as any));
          
          // Check canvas validity before adding rect
          if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
            console.warn('Canvas changed or disposed before adding boundary rect, aborting.');
            resolve();
            return;
          }

          canvasRef.add(boundaryRect);

          // Create a clip path for the text based on design bounds
          const clipPath = new fabric.Rect({
            left: scaledDesignBounds.left,
            top: scaledDesignBounds.top,
            width: scaledDesignBounds.width,
            height: scaledDesignBounds.height,
            absolutePositioned: true
          });

          // Convert variations into canvas objects which obay the design bounds here
          if (variations && variations.length > 0) {
            // Process each variation to create appropriate canvas objects
            variations.forEach(variation => {
              if (!variation) {
                return; // Skip invalid variations
              }

              // Get common positioning within design bounds
              const objectLeft = scaledDesignBounds.left + scaledDesignBounds.width / 2;
              const objectTop = scaledDesignBounds.top + scaledDesignBounds.height / 2;

              // Extract the field type and value from the variation
              const { canvasObjectType, file, fieldId, fontFamily, fontSize } = variation;
              const value = variation.value;
              
              // Check if this variation exists in savedObjects
              const savedObject = savedObjects.find(obj => obj.fieldId === fieldId);
              
              // Create canvas 
              let canvasObject;

              // Handle text variations
              if (canvasObjectType === 'text') {
                // Create the text object with either saved or defaults
                if (savedObject) {
                  // Create text with default first
                  canvasObject = new fabric.IText(value?.toString() || 'Text', {
                    ...savedObject,
                    left: savedObject.left || objectLeft,
                    top: savedObject.top || objectTop,
                    fontFamily: savedObject.fontFamily || fontFamily,
                    fontSize: savedObject.fontSize || fontSize,
                    fill: savedObject.fill || '#000000',
                    originX: savedObject.originX || 'center',
                    originY: savedObject.originY ||'center',
                    selectable: true,
                    editable: true,
                    text: value?.toString(), // Always use the current variation value for text
                    scaleX: savedObject.scaleX || 1,
                    scaleY: savedObject.scaleY || 1,
                    angle: savedObject.angle || 0,
                  });
                } else {
                  // Create with default properties
                  canvasObject = new fabric.IText(value?.toString() || 'Text', {
                    left: objectLeft,
                    top: objectTop,
                    fontFamily,
                    fontSize,
                    fill: '#000000',
                    originX: 'center',
                    originY: 'center',
                    selectable: true,
                    editable: false,
                    text: value?.toString(),
                  });
                }
                
                // Store fieldId as a custom property
                (canvasObject as any).fieldId = fieldId;
                // Store uniqueId if it exists in the saved object
                (canvasObject as any).uniqueId = savedObject?.uniqueId || generateUniqueId();

                // Apply the clip path to the text
                // Omit clip path for now to restore movability
                canvasObject.clipPath = clipPath;

                canvasRef.add(canvasObject);
              }
              // Handle image variations
              else if (canvasObjectType === "image") {
                // Get the file ID for comparison with saved objects
                const fileId = file?.id;
                // Find by both fieldId and fileId for images
                const savedImageObject = fileId ? 
                  savedObjects.find(obj => obj.fieldId === fieldId && obj.fileId === fileId) : 
                  savedObject;

                if (file && file.viewUrl) {
                  fabric.Image.fromURL(file.viewUrl, (img) => {
                    if (!img) return;

                    // Default scaling to fit design bounds
                    const maxWidth = scaledDesignBounds.width * 0.8;
                    const maxHeight = scaledDesignBounds.height * 0.8;
                    const defaultScale = Math.min(
                      maxWidth / img.width!,
                      maxHeight / img.height!,
                      1
                    );
                    
                    if (savedImageObject) {
                      // Apply saved properties
                      img.set({
                        ...savedImageObject,
                        left: savedImageObject.left || objectLeft,
                        top: savedImageObject.top || objectTop,
                        scaleX: savedImageObject.scaleX || defaultScale,
                        scaleY: savedImageObject.scaleY || defaultScale,
                        angle: savedImageObject.angle || 0,
                        originX: savedImageObject.originX || 'center',
                        originY: savedImageObject.originY || 'center',
                        cornerSize: 8,
                        borderColor: '#303DBF',
                        cornerColor: '#303DBF',
                        cornerStrokeColor: '#303DBF',
                        transparentCorners: false,
                        selectable: true,
                        crossOrigin: 'anonymous',
                      });
                      
                      // Store uniqueId if it exists
                      (img as any).uniqueId = savedImageObject?.uniqueId || generateUniqueId();

                    } else {
                      // Apply default properties
                      img.scale(defaultScale);
                      img.set({
                        left: objectLeft,
                        top: objectTop,
                        originX: 'center',
                        originY: 'center',
                        cornerSize: 8,
                        borderColor: '#303DBF',
                        cornerColor: '#303DBF',
                        cornerStrokeColor: '#303DBF',
                        transparentCorners: false,
                        selectable: true,
                        crossOrigin: 'anonymous',
                      });
                    }
                    
                    // Store fieldId and fileId as custom properties
                    (img as any).fieldId = fieldId;
                    if (fileId) {
                      (img as any).fileId = fileId;
                    }
                    (img as any).uniqueId = generateUniqueId();

                    // Apply clip path
                    const imageClipPath = new fabric.Rect({
                      left: scaledDesignBounds.left,
                      top: scaledDesignBounds.top,
                      width: scaledDesignBounds.width,
                      height: scaledDesignBounds.height,
                      absolutePositioned: true
                    });
                    img.clipPath = imageClipPath;

                    // Check canvas validity before adding
                    if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
                      return;
                    }
                    canvasRef.add(img);
                    canvasRef.renderAll();
                  }, { crossOrigin: 'anonymous' });
                }
              }
            });
          }

          // Check canvas validity before adding text
          if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
            console.warn('Canvas changed or disposed before adding test text, aborting.');
            resolve();
            return;
          }
        }

        // Final check before renderAll
        if (!canvasRef || canvasRef.psdUrl !== psdUrl) {
          console.warn('Canvas changed or disposed before final render, aborting.');
          resolve();
          return;
        }

        // Try to render the canvas, with error handling
        try {
          if (canvasRef && canvasRef.renderAll) {
            canvasRef.renderAll();
          }
        } catch (e) {
          console.error('Error rendering canvas:', e);
        }

        resolve();
      }, { crossOrigin: 'anonymous' });
    });
  } catch (error) {
    console.error('Error loading PSD onto canvas:', error);
    throw error;
  }
}; 
