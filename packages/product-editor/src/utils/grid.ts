import { fabric } from 'fabric';

/**
 * @param fabricCanvas 
 * @param width 
 * @param height
 * @param gridSize 
 * @param lineColor 
 * @param enabled 
 */
export const drawGrid = (
  fabricCanvas: fabric.Canvas,
  width: number,
  height: number,
  gridSize = 20,
  lineColor = '#e0e0e0',
  enabled = true
) => {
  // First, make sure fabricCanvas is not null
  if (!fabricCanvas) {
    console.warn('drawGrid: fabricCanvas is null or undefined');
    return;
  }

  // Make sure the canvas element exists and is valid
  try {
    // This will throw an error if the canvas element is no longer in the DOM
    if (!fabricCanvas.getElement() || !fabricCanvas.getElement().parentNode) {
      console.warn('drawGrid: Canvas element is not in the DOM');
      return;
    }
  } catch (e) {
    console.warn('drawGrid: Error checking canvas element:', e);
    return;
  }

  // remove all existing grid lines
  const gridLines = fabricCanvas.getObjects().filter(obj => obj.data?.isGrid);
  gridLines.forEach(line => fabricCanvas.remove(line));

  if (!enabled) return;

  // draw vertical lines
  for (let i = 0; i <= width; i += gridSize) {
    const line = new fabric.Line([i, 0, i, height], {
      stroke: lineColor,
      strokeWidth: 0.5,
      opacity: 0.3,
      selectable: false,
      evented: false,
      data: { isGrid: true }
    });
    fabricCanvas.add(line);
  }

  // draw horizontal lines
  for (let i = 0; i <= height; i += gridSize) {
    const line = new fabric.Line([0, i, width, i], {
      stroke: lineColor,
      strokeWidth: 0.5,
      opacity: 0.3,
      selectable: false,
      evented: false,
      data: { isGrid: true }
    });
    fabricCanvas.add(line);
  }

  try {
    fabricCanvas.renderAll();
  } catch (e) {
    console.error('drawGrid: Error rendering grid:', e);
  }
};

/**
 * save the grid state on the canvas
 * @param fabricCanvas 
 */
export const saveGridState = (fabricCanvas: fabric.Canvas) => {
  if (!fabricCanvas) {
    console.warn('saveGridState: fabricCanvas is null or undefined');
    return [];
  }

  try {
    const objs = fabricCanvas.getObjects().filter(obj => obj);
    return objs;
  } catch (e) {
    console.warn('saveGridState: Error getting grid objects:', e);
    return [];
  }
};

/**
 * bring grid lines to front of the canvas
 * @param fabricCanvas 
 * @param gridLines 
 */
export const bringGridToFront = (fabricCanvas: fabric.Canvas, gridLines: fabric.Object[]) => {
  if (!fabricCanvas) {
    console.warn('bringGridToFront: fabricCanvas is null or undefined');
    return;
  }

  if (gridLines && gridLines.length > 0) {
    try {
      gridLines.forEach(line => fabricCanvas.bringToFront(line));
    } catch (e) {
      console.warn('bringGridToFront: Error bringing grid to front:', e);
    }
  }
};

/**
 * send grid lines to back of the canvas
 * @param fabricCanvas 
 * @param gridLines 
 */
export const sendGridToBack = (fabricCanvas: fabric.Canvas, gridLines: fabric.Object[]) => {
  if (!fabricCanvas) {
    console.warn('sendGridToBack: fabricCanvas is null or undefined');
    return;
  }

  if (gridLines && gridLines.length > 0) {
    try {
      gridLines.forEach(line => fabricCanvas.sendToBack(line));
    } catch (e) {
      console.warn('sendGridToBack: Error sending grid to back:', e);
    }
  }
};

/**
 * clear all objects except the grid on the canvas
 * @param fabricCanvas
 */
export const clearCanvasExceptGrid = (fabricCanvas: fabric.Canvas) => {
  if (!fabricCanvas) {
    console.warn('clearCanvasExceptGrid: fabricCanvas is null or undefined');
    return;
  }

  try {
    fabricCanvas.getObjects().forEach(obj => {
      if (!obj.data?.isGrid) {
        fabricCanvas.remove(obj);
      }
    });
  } catch (e) {
    console.warn('clearCanvasExceptGrid: Error clearing canvas:', e);
  }
}; 
