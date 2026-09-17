import { fabric } from 'fabric';
import { DraftTemplate } from '../types';

/**
 * Loads a template image onto a canvas with enhanced error handling and fallbacks
 * 
 * @param fabricCanvas The Fabric.js canvas instance
 * @param template The template containing image information
 * @param width The canvas width
 * @param height The canvas height
 * @returns Promise that resolves when the image is loaded
 */
export const loadRegularImagePromise = (
  fabricCanvas: fabric.Canvas,
  template: DraftTemplate,
  width: number,
  height: number,
): Promise<void> => {
  // Get the canvas ID for tracking if it exists
  const canvasId = (fabricCanvas as any).loadingId;
  const trackingEnabled = !!canvasId;

  return new Promise((resolve) => {
    // Check if canvas is still valid when tracking is enabled
    if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
      resolve();
      return;
    }

    // Make sure template has a file with a viewUrl
    if (!template.file || !template.file.viewUrl) {
      console.error('Template has no viewUrl:', template);
      resolve();
      return;
    }

    const imageUrl = template.file.viewUrl;

    // Check if this might be a problematic file format
    const isPossiblyUnsupported = !imageUrl.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);

    // If we have a thumbnailUrl or previewUrl, use that instead for unsupported formats
    let urlToUse = imageUrl;
    if (isPossiblyUnsupported) {

      // Try to use alternative URLs if available
      if (template.file?.thumbnailUrl) {
        urlToUse = template.file.thumbnailUrl;
      } else if (template.file?.previewUrl) {
        urlToUse = template.file.previewUrl;
      }
    }

    // Add error handling for image loading
    fabric.Image.fromURL(
      urlToUse,
      (img: fabric.Image) => {
        // Check if canvas is still valid when tracking is enabled
        if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
          console.warn('Canvas changed after image loaded, aborting');
          resolve();
          return;
        }

        if (!img || !img.width || !img.height) {
          console.error('Failed to load image or image has invalid dimensions:', img);
          // Try loading the image with a different approach - create an HTML image first
          const imgElement = new Image();
          imgElement.crossOrigin = 'anonymous';
          imgElement.onload = () => {
            // Check if canvas is still valid when tracking is enabled
            if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
              console.warn('Canvas changed after alternative image loaded, aborting');
              resolve();
              return;
            }

            const fabricImg = new fabric.Image(imgElement);

            // Continue with the same scaling and positioning logic
            const scale = Math.min(
              width / fabricImg.width!,
              height / fabricImg.height!
            );
            fabricImg.scale(scale);

            fabricImg.set({
              left: (width - fabricImg.width! * scale) / 2,
              top: (height - fabricImg.height! * scale) / 2,
              selectable: false,
              evented: false,
            });

            // Check again before adding to canvas when tracking is enabled
            if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
              console.warn('Canvas changed before adding alternative image, aborting');
              resolve();
              return;
            }

            fabricCanvas.add(fabricImg);
            fabricCanvas.sendToBack(fabricImg);

            // Final check before render when tracking is enabled
            if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
              console.warn('Canvas changed before rendering alternative image, aborting');
              resolve();
              return;
            }

            try {
              fabricCanvas.renderAll();
            } catch (e) {
              console.error('Error rendering canvas with alternative image:', e);
            }

            resolve();
          };

          imgElement.onerror = () => {
            // Check if canvas is still valid when tracking is enabled
            if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
              console.warn('Canvas changed after image load error, aborting');
              resolve();
              return;
            }

            console.error('Alternative loading also failed. Using placeholder image.');
            // Use a placeholder SVG as absolute fallback
            const placeholderURL = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22800%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20600%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1891%20text%20%7Bfill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A40pt%20%7D%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder%22%3E%3Crect%20width%3D%22800%22%20height%3D%22600%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22285%22%20y%3D%22300%22%3EThumbnail%20Unavailable%3C%2Ftext%3E%3Ctext%20x%3D%22205%22%20y%3D%22350%22%3ETemplate%3A%20' + template.name + '%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
            fabric.Image.fromURL(placeholderURL, (placeholderImg) => {
              // Check if canvas is still valid when tracking is enabled
              if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
                console.warn('Canvas changed before adding placeholder image, aborting');
                resolve();
                return;
              }

              placeholderImg.set({
                left: 0,
                top: 0,
                width: width,
                height: height,
                selectable: false,
                evented: false,
              });
              fabricCanvas.add(placeholderImg);

              // Final check before render when tracking is enabled
              if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
                console.warn('Canvas changed before rendering placeholder image, aborting');
                resolve();
                return;
              }

              try {
                fabricCanvas.renderAll();
              } catch (e) {
                console.error('Error rendering canvas with placeholder image:', e);
              }

              resolve();
            });
          };

          imgElement.src = urlToUse;
          return;
        }

        // Scale image to fit canvas while maintaining aspect ratio
        const scale = Math.min(
          width / img.width!,
          height / img.height!
        );
        img.scale(scale);


        // Center the image
        img.set({
          left: (width - img.width! * scale) / 2,
          top: (height - img.height! * scale) / 2,
          selectable: false, // template image is not selectable
          evented: false,    // template image is not responsive to events
          crossOrigin: 'anonymous',
        });

        // Check if canvas is still valid when tracking is enabled
        if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
          console.warn('Canvas changed before adding image, aborting');
          resolve();
          return;
        }

        // Add the image to the canvas
        fabricCanvas.add(img);

        // Send the template image to the back
        fabricCanvas.sendToBack(img);

        // Final check before render when tracking is enabled
        if (trackingEnabled && (fabricCanvas as any).loadingId !== canvasId) {
          console.warn('Canvas changed before rendering, aborting');
          resolve();
          return;
        }

        try {
          fabricCanvas.renderAll();
        } catch (e) {
          console.error('Error rendering canvas:', e);
        }

        resolve();
      },
      { crossOrigin: 'anonymous' }
    );
  });
};
