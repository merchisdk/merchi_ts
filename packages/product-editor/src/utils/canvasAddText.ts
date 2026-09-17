// add text to the canvas
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
export const addText = (
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
    const text = new fabric.IText(defaultText, {
      left: width / 2,
      top: height / 2,
      fontFamily: fontFamily,
      fontSize: fontSize,
      fill: '#000000',
      originX: 'center',
      originY: 'center',
      selectable: true,
      editable: false
    });

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
