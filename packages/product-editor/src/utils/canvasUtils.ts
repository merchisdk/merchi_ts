import { fabric } from 'fabric';

/**
 * Adds an editable text object to the canvas
 * @param canvas - The Fabric.js canvas instance
 * @param width - The width of the canvas
 * @param height - The height of the canvas
 * @param defaultText - Optional default text (defaults to "Text")
 * @param fontSize - Optional font size (defaults to 24)
 * @param fontFamily - Optional font family (defaults to Arial)
 */
export const addTextToCanvas = (
  canvas: fabric.Canvas,
  width: number,
  height: number,
  defaultText: string = 'Text',
  fontSize: number = 24,
  fontFamily: string = 'Nunito'
) => {
  if (!canvas) return null;

  try {
    // Safe check if canvas is still valid
    if (!canvas.getElement() || !canvas.getElement().parentNode) {
      return null;
    }

    // Create a new text object with minimal options
    const text = new fabric.IText(
      defaultText,
      {
        left: width / 2,
        top: height / 2,
        fontFamily: fontFamily,
        fontSize: fontSize,
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        selectable: true,
        editable: false
      }
    );

    // Add the text to the canvas
    canvas.add(text);

    // Ensure the text is rendered
    canvas.renderAll();

    // Make the text active - this is critical
    const setActiveTextObject = () => {
      try {
        // Check if canvas is still valid
        if (canvas && canvas.getElement() && canvas.getElement().parentNode) {
          canvas.setActiveObject(text);
          canvas.renderAll();
        }
      } catch (err) {
        console.error('Error setting active text object:', err);
      }
    };

    // Initial selection
    setActiveTextObject();

    // Delayed selection to ensure text becomes active
    setTimeout(setActiveTextObject, 50);

    return text;
  } catch (error) {
    console.error('Error adding text to canvas:', error);
    return null;
  }
};

/**
 * Renders the entire canvas as an image without displaying grid elements
 * 
 * @param canvas - The Fabric.js canvas instance
 * @param options - Optional rendering options
 * @returns A promise that resolves to the dataURL of the canvas without grid
 */
export const renderCanvasWithoutGrid = (
  canvas: fabric.Canvas,
  options?: {
    format?: string;
    quality?: number;
    multiplier?: number;
    backgroundColor?: string | null;
  }
): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!canvas) {
      console.error('Canvas is null or undefined');
      resolve(null);
      return;
    }

    try {
      // Get all objects on the canvas
      const objects = canvas.getObjects();

      // Store original visibility of each object
      const originalVisibilities = objects.map(obj => ({
        object: obj,
        visible: obj.visible
      }));

      // Hide grid elements - typically grid elements might have a specific ID or class
      // You may need to adjust this logic based on how grid elements are identified
      objects.forEach(obj => {
        // Hide objects that represent grid elements
        // This assumes grid elements have a property like 'type' or 'id' that identifies them
        if (
          (obj as any).id?.includes('grid') ||
          (obj as any).type === 'grid' ||
          (obj as any).isGridElement ||
          // Add more comprehensive grid detection
          (obj as any).data?.isGrid ||
          (obj as any).name?.includes('grid') ||
          (obj as any).className?.includes('grid') ||
          // Check for common grid-related properties
          (obj as any).strokeDashArray || // Dashed lines are often used for grids
          // Check for line objects with evenly spaced positions (typical grid pattern)
          ((obj as any).type === 'line' && ((obj as any).x1 === (obj as any).x2 || (obj as any).y1 === (obj as any).y2)) ||
          // Check for objects tagged with grid-related classes
          (obj as any).classes?.includes('grid') ||
          // Check for objects with certain grid styling
          ((obj as any).stroke &&
            ((obj as any).strokeWidth === 0.5 || (obj as any).strokeWidth === 1) &&
            ((obj as any).stroke === '#ddd' || (obj as any).stroke === '#eee' || (obj as any).stroke === 'rgba(0,0,0,0.1)'))
        ) {
          obj.visible = false;
        }
      });

      // Save the original selection state
      const originalSelectionBorder = canvas.selectionBorderColor;
      const originalSelectionColor = canvas.selectionColor;
      const originalActiveObject = canvas.getActiveObject();

      // Temporarily disable selection indicators
      canvas.selectionBorderColor = 'transparent';
      canvas.selectionColor = 'transparent';
      canvas.discardActiveObject();

      // Apply any background color if specified
      const originalBackgroundColor = canvas.backgroundColor;
      if (options?.backgroundColor !== undefined) {
        canvas.backgroundColor = options.backgroundColor || 'transparent';
      }

      // Render the canvas
      canvas.renderAll();

      // Get rendering options
      const format = options?.format || 'png';
      const quality = options?.quality || 1;
      const multiplier = options?.multiplier || 1;

      // Create a data URL from the canvas
      try {
        const dataUrl = canvas.toDataURL({
          format: format,
          quality: quality,
          multiplier: multiplier
        });

        // Restore the original state
        objects.forEach((obj, index) => {
          obj.visible = originalVisibilities[index].visible;
        });

        // Restore selection state
        canvas.selectionBorderColor = originalSelectionBorder;
        canvas.selectionColor = originalSelectionColor;
        if (originalActiveObject) {
          canvas.setActiveObject(originalActiveObject);
        }

        // Restore background color
        canvas.backgroundColor = originalBackgroundColor;

        // Render with original state
        canvas.renderAll();

        resolve(dataUrl);
      } catch (error) {
        console.error('Error generating data URL:', error);
        resolve(null);
      }
    } catch (error) {
      console.error('Error rendering canvas without grid:', error);
      resolve(null);
    }
  });
};

/**
 * Renders an image containing only what's visible inside a clipPath on the canvas
 * 
 * @param canvas - The Fabric.js canvas instance
 * @param options - Optional rendering options
 * @returns A promise that resolves to the dataURL of the contents inside the clipPath, or null if no clipped object is found
 */
export const renderClippedImage = (
  canvas: fabric.Canvas,
  options?: {
    format?: string;
    quality?: number;
    multiplier?: number;
    backgroundColor?: string;
  }
): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!canvas) {
      console.error('Canvas is null or undefined');
      resolve(null);
      return;
    }

    try {
      // Find objects with clipPath
      const objects = canvas.getObjects();
      let targetObject: fabric.Object | null = null;

      targetObject = objects.find((obj: any) => obj.id === 'design-boundary-rect') || null;

      if (!targetObject) {
        console.warn('No boundary object found');
        resolve(null);
        return;
      }

      // Get bounds of the object with clipPath
      const objBounds = targetObject.getBoundingRect();

      // Create a new canvas element
      const dpr = window.devicePixelRatio || 1;

      const tempCanvasEl = document.createElement('canvas');
      tempCanvasEl.width = objBounds.width * dpr;
      tempCanvasEl.height = objBounds.height * dpr;

      tempCanvasEl.style.width = `${objBounds.width}px`;
      tempCanvasEl.style.height = `${objBounds.height}px`;


      // Explicitly set alpha to true to support transparency
      const tempCtx = tempCanvasEl.getContext('2d', { alpha: true });
      tempCtx && tempCtx.scale(dpr, dpr);

      if (!tempCtx) {
        console.error('Could not get canvas context');
        resolve(null);
        return;
      }

      // Clear the canvas to ensure transparency
      tempCtx.clearRect(0, 0, tempCanvasEl.width, tempCanvasEl.height);

      // Set background color if provided, otherwise keep transparent
      if (options?.backgroundColor) {
        tempCtx.fillStyle = options.backgroundColor;
        tempCtx.fillRect(0, 0, tempCanvasEl.width, tempCanvasEl.height);
      }

      // Save current canvas state
      const originalZoom = canvas.getZoom();
      const originalViewportTransform = canvas.viewportTransform ? [...canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];

      // Save the original background color of the canvas
      const originalBackgroundColor = canvas.backgroundColor;

      // Temporarily set canvas background to transparent
      canvas.backgroundColor = 'transparent';

      // Store original object positions
      const originalPositions = objects.map(obj => ({
        object: obj,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY
      }));

      // Temporarily modify the canvas view to focus on our object
      canvas.setZoom(1);
      canvas.setViewportTransform([1, 0, 0, 1, -objBounds.left, -objBounds.top]);

      // Temporarily hide all objects except our target and its clipped content
      const originalVisibilities = objects.map(obj => ({ object: obj, visible: obj.visible }));
      objects.forEach(obj => {
        if (!(obj as any).fieldId) {
          obj.visible = false;
        }
      });

      // Temporarily disable selection borders at canvas level
      const originalSelectionBorder = canvas.selectionBorderColor;
      const originalSelectionColor = canvas.selectionColor;
      canvas.selectionBorderColor = 'transparent';
      canvas.selectionColor = 'transparent';

      // Temporarily disable selection borders at object level
      const originalObjectStates = objects.map(obj => ({
        object: obj,
        borderColor: obj.borderColor,
        cornerColor: obj.cornerColor,
        cornerStrokeColor: obj.cornerStrokeColor,
        transparentCorners: obj.transparentCorners,
        hasControls: obj.hasControls,
        hasBorders: obj.hasBorders
      }));

      objects.forEach(obj => {
        obj.borderColor = 'transparent';
        obj.cornerColor = 'transparent';
        obj.cornerStrokeColor = 'transparent';
        obj.transparentCorners = true;
        obj.hasControls = false;
        obj.hasBorders = false;
      });

      // Render just the isolated object
      canvas.renderAll();

      // Draw the current canvas view to our temp canvas
      tempCtx.drawImage(
        canvas.getElement(),
        0, 0, objBounds.width * dpr, objBounds.height * dpr,
        0, 0, objBounds.width, objBounds.height
      );

      // Restore the original object positions
      originalPositions.forEach(item => {
        item.object.left = item.left;
        item.object.top = item.top;
        item.object.scaleX = item.scaleX;
        item.object.scaleY = item.scaleY;
        item.object.setCoords();
      });

      // Restore the original canvas state
      canvas.setZoom(originalZoom);
      canvas.setViewportTransform(originalViewportTransform);
      canvas.backgroundColor = originalBackgroundColor;
      originalVisibilities.forEach(item => {
        item.object.visible = item.visible;
      });

      // Restore object-level selection borders
      originalObjectStates.forEach(state => {
        state.object.borderColor = state.borderColor;
        state.object.cornerColor = state.cornerColor;
        state.object.cornerStrokeColor = state.cornerStrokeColor;
        state.object.transparentCorners = state.transparentCorners;
        state.object.hasControls = state.hasControls;
        state.object.hasBorders = state.hasBorders;
      });

      // Restore canvas-level selection borders
      canvas.selectionBorderColor = originalSelectionBorder;
      canvas.selectionColor = originalSelectionColor;
      canvas.renderAll();

      // Get the data URL from the temp canvas
      const format = options?.format || 'png';
      const quality = options?.quality || 1;

      // Create a new canvas for final rendering with proper transparency
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = tempCanvasEl.width;
      finalCanvas.height = tempCanvasEl.height;
      const finalCtx = finalCanvas.getContext('2d', { alpha: true });

      finalCtx && finalCtx.scale(1, 1);

      if (!finalCtx) {
        console.error('Could not get final canvas context');
        resolve(null);
        return;
      }

      // Clear the final canvas to ensure transparency
      finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Draw the temp canvas content to the final canvas
      finalCtx.drawImage(tempCanvasEl, 0, 0);

      // Try to get the data URL from the final canvas
      try {
        // Ensure PNG format for transparency support
        const dataUrl = finalCanvas.toDataURL(`image/${format === 'jpg' ? 'png' : format}`, quality);
        resolve(dataUrl);
      } catch (error) {
        console.error('Error getting data URL:', error);
        resolve(null);
      }

    } catch (error) {
      console.error('Error rendering clipped image:', error);
      resolve(null);
    }
  });
};
