import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fabric } from 'fabric';
import { Product, Job, DraftTemplate, DraftTemplateData, DraftPreview, SavedCanvasObject, RenderedDraftPreview } from '../types';
import { drawGrid } from '../utils/grid';
import { initDraftTemplates } from '../utils/job';
import { renderEditorOrPreview } from '../utils/renderUtils';
import { setupKeyboardEvents } from '../utils/keyboard';
import { haveDraftTemplatesChanged } from '../utils/draftTemplateUtils';
import { setNewDraftPreviews } from '../utils/previewUtils';
import { debounce } from 'lodash';
import { renderClippedImage, renderCanvasWithoutGrid } from '../utils/canvasUtils';
import { FontOption, defaultFontOptions } from '../config/fontConfig';
import { defaultPalette } from '../config/colorConfig';
import { v4 as uuidv4 } from 'uuid';
import { UseFormReturn } from 'react-hook-form';
import { getDeviceAdjustedDimensions } from '../utils/deviceUtils';


interface ProductEditorContextType {
  // States
  canvas: fabric.Canvas | null;
  draftPreviews: DraftPreview[];
  draftTemplates: DraftTemplateData[]; // Updated to use the new type
  isCanvasLoading: boolean;
  isMobileView: boolean;
  loadingPreviews: boolean;
  renderedDraftPreviews: RenderedDraftPreview[];
  savedObjects: SavedCanvasObject[];
  selectedTemplate: number | null;
  selectedTextObject: fabric.IText | null;
  showGrid: boolean;
  showPreview: boolean;

  // State Setters
  setCanvas: (canvas: fabric.Canvas) => void;
  setSelectedTemplate: (templateId: number) => void;
  setShowGrid: (show: boolean) => void;

  // Functions
  handleCancel: () => void;
  handleSave: () => void;
  handleTemplateChange: (draftTemplate: DraftTemplate) => void;
  recordVariationFieldObjectsOnCanvas: () => void;
  togglePreview: () => void;
  updateSelectedText: (props: Partial<fabric.IText>) => void;
  fontOptions: FontOption[];
  colorPalette: (string | null)[][];
  showLayerPanel: boolean;
  toggleLayerPanel: () => void;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  selectObject: (obj: fabric.Object | null) => void;
  deleteObject: (obj: fabric.Object) => void;

  // Props
  canvasRef: React.RefObject<HTMLCanvasElement>;
  groupIndex: number;
  height: number;
  inputName: string;
  job: Job;
  product: Product;
  width: number;
  hookForm: UseFormReturn<any> | null;
}

const ProductEditorContext = createContext<ProductEditorContextType | undefined>(undefined);

interface ProductEditorProviderProps {
  children: React.ReactNode;
  groupIndex?: number;
  product: Product;
  width?: number;
  height?: number;
  job: Job;
  onSave: () => void;
  onCancel: () => void;
  hookForm?: UseFormReturn<any> | null; // Type the form methods prop
  fontOptions?: FontOption[];
  colorPalette?: (string | null)[][];
}

export const ProductEditorProvider: React.FC<ProductEditorProviderProps> = ({
  children,
  groupIndex = 0,
  product,
  width: initialWidth = 800, // Rename prop
  height: initialHeight = 600, // Rename prop
  job,
  onSave,
  onCancel,
  hookForm = null, // Initialize with null
  fontOptions = defaultFontOptions,
  colorPalette = defaultPalette,
}) => {

  const inputName = `ownDrafts[0].images[${groupIndex || 0}]`;

  // Create refs to store the latest values to prevent excessive re-renders
  const allVariationsRef = useRef<any[]>([]);
  const productRef = useRef(product);

  // Update product ref when it changes
  useEffect(() => {
    productRef.current = product;
  }, [product]);

  // Determine dimensions and mobile status once at initialization
  const deviceSettings = useMemo(() =>
    getDeviceAdjustedDimensions(initialWidth, initialHeight),
    [initialWidth, initialHeight]
  );

  // Use dimensions from device settings
  const canvasWidth = deviceSettings.width;
  const canvasHeight = deviceSettings.height;
  const isMobileView = deviceSettings.isMobile;

  const [
    draftTemplates,
    setDraftTemplates
  ] = useState<DraftTemplateData[]>([]);
  const [draftPreviews, setDraftPreviews] = useState<DraftPreview[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(
    draftTemplates?.[0]?.template?.id || null
  );
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [selectedTextObject, setSelectedTextObject] = useState<fabric.IText | null>(null);

  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Add a new state to track saved objects
  const [savedObjects, setSavedObjects] = useState<SavedCanvasObject[]>([]);

  // Add this ref to track initial mounting
  const initialMountRef = useRef(false);

  // Initialize savedObjects from localStorage on component mount
  useEffect(() => {
    // Only reset on initial mount
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      // Reset savedObjects on page reload instead of loading from localStorage
      setSavedObjects([]);
    }
  }, [product]);

  // Function to record the current state of variation field objects
  const recordVariationFieldObjectsOnCanvas = useCallback(() => {
    if (!canvas || selectedTemplate === null) return;
    // Create a fresh array instead of appending to existing
    const updatedSavedObjects: SavedCanvasObject[] = [];
    let hasChanges = false;

    // Get all objects from the canvas
    const objects = canvas.getObjects();

    // Filter for objects that have a fieldId property (variation field objects)
    objects.forEach((obj: any) => {
      // Get fieldId from either direct property or from variationField

      const { fieldId } = obj;

      if (fieldId) {
        // Also save a serialized version for the savedObjects state
        const updatedObject = {
          ...obj,
        };

        if (obj instanceof fabric.Image) {
          Object.assign(updatedObject, {
            width: obj.width,
            height: obj.height,
            src: obj.getSrc(),
          });
        }

        updatedSavedObjects.push(updatedObject);
        hasChanges = true;
      }
    });

    // Only update state if we found objects with fieldIds
    if (hasChanges) {
      // Update the savedObjects state with the new complete array
      setSavedObjects(updatedSavedObjects);
    }
  }, [canvas, selectedTemplate]); // Remove savedObjects from the dependencies

  // Function to toggle preview visibility
  const togglePreview = () => {
    setShowPreview(prev => !prev);
  };

  // Function to toggle layer panel visibility
  const toggleLayerPanel = () => {
    setShowLayerPanel(prev => !prev);
  };

  // Function to update selected text object properties
  const updateSelectedText = (props: Partial<fabric.IText>) => {
    if (selectedTextObject && canvas && selectedTemplate !== null) {
      selectedTextObject.set(props);
      canvas.requestRenderAll();

      // Record the state changes after updating text properties
      // This ensures color changes and other styling updates are saved
      setTimeout(() => {
        if (canvas && selectedTemplate !== null) {
          recordVariationFieldObjectsOnCanvas();
        }
      }, 50);
    } else {
      console.warn('Cannot update text - missing canvas, text object, or template');
    }
  };

  const handleSave = () => {
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      onSave();
    }
  };

  // Handle template change with improved state tracking
  const handleTemplateChange = async (draftTemplate: DraftTemplate) => {
    if (!canvas) return;

    // Record the current state of variation field objects
    recordVariationFieldObjectsOnCanvas();

    // Check if this is already the selected template - prevent reloading the same template
    if (draftTemplate.id && selectedTemplate === draftTemplate.id) {
      return;
    }

    // Update the selected template
    if (draftTemplate.id) {
      setSelectedTemplate(draftTemplate.id);
    }

    // Create a clean canvas reference for tracking
    const currentCanvas = canvas;

    // Create a new canvas before disposing the old one
    if (canvasRef.current) {
      // Dispose the old canvas properly
      try {
        currentCanvas.dispose();

        // Remove any lingering canvas containers to prevent duplicates
        if (canvasRef.current.parentElement) {
          const containers = canvasRef.current.parentElement.querySelectorAll('.canvas-container');
          if (containers.length > 1) {
            // Keep only the first container
            for (let i = 1; i < containers.length; i++) {
              containers[i].remove();
            }
          }
        }
      } catch (e) {
        console.error('Error during canvas cleanup:', e);
      }

      const newCanvas = new fabric.Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        // not to bring the selected object to the top visually
        preserveObjectStacking: true
      });

      // Now load the template image and add variations
      const templateData = draftTemplates.find(dt => dt.template.id === draftTemplate.id);

      await renderEditorOrPreview(
        newCanvas,
        (templateData as any).template,
        (templateData as any).variationObjects,
        savedObjects,
        canvasHeight,
        canvasWidth,
      );

      // Update the state with the new canvas
      setCanvas(newCanvas);

      // Since selectedTemplate was just updated, we need a slight delay to ensure
      // grid is drawn and loading is set to false
      setTimeout(() => {
        // Draw grid if needed
        if (showGrid) {
          try {
            if (newCanvas.getElement() && newCanvas.getElement().parentNode) {
              drawGrid(newCanvas, canvasWidth, canvasHeight, 20, '#a0a0a0', showGrid);
            }
          } catch (e) {
            console.error('Error drawing grid after template change:', e);
          }
        }
        setIsCanvasLoading(false);
      }, 50);

      // Re-setup keyboard events for the new canvas
      setupKeyboardEvents(newCanvas, (dataUrl: any) => {
        if (document.activeElement === newCanvas.upperCanvasEl) {
          onSave && onSave();
        }
      });
    }
  };

  // Add cleanup event handlers that properly use the callback function
  const createEventHandler = useCallback((callback: Function) => {
    return () => {
      if (callback) callback();
    };
  }, []);

  // Replace the direct watch with a debounced version
  const debouncedWatch = useMemo(() => {
    return debounce(async (watchValues: { variationsGroups?: any; variations?: any }) => {
      // Start loading
      setIsCanvasLoading(true);

      // Record the current state of variation field objects before changes
      if (canvas) {
        recordVariationFieldObjectsOnCanvas();
      }

      // Extract the variations from the watch values
      const variationsGroups = watchValues.variationsGroups;
      const variations = watchValues.variations;

      // Process the latest variations to update allVariationsRef
      const newAllVariations = variationsGroups?.[groupIndex]?.variations
        ? [...variationsGroups[groupIndex].variations]
        : variations || [];

      // Store in ref to avoid triggering effects
      allVariationsRef.current = newAllVariations;

      const newDraftTemplates = initDraftTemplates(newAllVariations, productRef.current);

      // Check if the currently selected template ID still exists in the new list
      const currentSelectedIdStillExists = newDraftTemplates.some(
        dt => dt.template.id === selectedTemplate);

      // Store the canvas instance for this effect run
      let fabricCanvasInstance = canvas;

      // Only update if they've actually changed
      if (haveDraftTemplatesChanged(draftTemplates, newDraftTemplates)) {
        setDraftTemplates(newDraftTemplates);
        setDraftPreviews(setNewDraftPreviews(newDraftTemplates));
      }

      // Determine the template to load
      let templateToLoad: DraftTemplate | undefined = newDraftTemplates[0]?.template;

      if (currentSelectedIdStillExists && selectedTemplate) {
        const previouslySelected = newDraftTemplates.find(dt => dt.template.id === selectedTemplate);
        templateToLoad = previouslySelected?.template || templateToLoad;
      }

      setSelectedTemplate(templateToLoad?.id || null);

      // Handle canvas setup
      if (fabricCanvasInstance) {
        // if we have a canvas we need to clear all the old templates
        fabricCanvasInstance.clear();
        fabricCanvasInstance.setBackgroundColor(
          '#ffffff',
          () => fabricCanvasInstance?.renderAll()
        );
      } else if (canvasRef.current) {
        fabricCanvasInstance = new fabric.Canvas(canvasRef.current, {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: '#ffffff',
          preserveObjectStacking: true
        });

        // Update state immediately to ensure it's available for event handlers
        setCanvas(fabricCanvasInstance);
      } else {
        console.error('No canvas ref available');
        setIsCanvasLoading(false);
        return;
      }

      if (templateToLoad && templateToLoad.id) {
        const templateData = newDraftTemplates.find(
          dt => dt.template.id === (templateToLoad as any).id);

        // Render the template onto the canvas
        await renderEditorOrPreview(
          fabricCanvasInstance,
          templateData?.template || {},
          templateData?.variationObjects || [],
          savedObjects,
          canvasHeight,
          canvasWidth,
        );

        if (fabricCanvasInstance.getElement() && fabricCanvasInstance.getElement().parentNode) {
          drawGrid(fabricCanvasInstance, canvasWidth, canvasHeight, 20, '#a0a0a0', showGrid);
        }

        setIsCanvasLoading(false);
      } else {
        setIsCanvasLoading(false);
      }
    }, 500);
  }, [
    groupIndex,
    draftTemplates,
    canvasRef,
    showGrid,
    canvasWidth,
    canvasHeight,
    savedObjects,
    canvas,
    selectedTemplate,
    recordVariationFieldObjectsOnCanvas,
    setSelectedTemplate
  ]);

  // Set up the debounced watch subscription
  useEffect(() => {
    if (!hookForm) return;

    // Subscribe to form changes
    const subscription = hookForm.watch((value: any) => {
      debouncedWatch({
        variationsGroups: value.variationsGroups,
        variations: value.variations,
      });
    });

    // Clean up subscription
    return () => subscription.unsubscribe();
  }, [hookForm, debouncedWatch]);

  // This effect is used to trigger the debounced watch when the selected template is not set
  // This helps with things like add group.
  useEffect(() => {
    if (!selectedTemplate) {
      debouncedWatch({
        variationsGroups: job.variationsGroups,
        variations: job.variations,
      });
    }
  }, [groupIndex]);


  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [renderedDraftPreviews, setRenderedDraftPreviews] = useState<RenderedDraftPreview[]>([]);

  // Extract event handler setup to a separate function to avoid recreating in debounced watch
  const setupEventHandlers = (fabricCanvasInstance: fabric.Canvas, selectedTemplate: number | null) => {
    if (!fabricCanvasInstance) return () => { };

    // Add a flag to prevent recursive calls
    let isRendering = false;

    // Define the record changes function with canvas and template closure
    const recordChanges = () => {
      // Use the passed instance and template ID instead of state variables
      if (fabricCanvasInstance) {
        const objects = fabricCanvasInstance.getObjects();

        const updatedSavedObjects: SavedCanvasObject[] = [];
        let hasChanges = false;

        objects.forEach((obj: any) => {
          const { fieldId } = obj;
          if (fieldId) {
            const updatedObject = {
              ...obj,
            };

            if (obj instanceof fabric.Image) {
              Object.assign(updatedObject, {
                width: obj.width,
                height: obj.height,
                src: obj.getSrc(),
              });
            }

            updatedSavedObjects.push(updatedObject);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          setSavedObjects(updatedSavedObjects);
        }
      } else {
        console.warn('Cannot record changes - missing canvas or templateId');
      }
    };

    // Create a bound version for event handling
    const boundRecordChanges = createEventHandler(recordChanges);

    // Add Text Toolbar Event Listener
    const handleSelection = (e: fabric.IEvent) => {
      const activeObject = fabricCanvasInstance.getActiveObject();
      // Check if the active object is an IText instance

      // Ensure the selected object has an ID
      if (activeObject && !(activeObject as any).id) {
        (activeObject as any).id = uuidv4();
      }
      setSelectedObjectId((activeObject as any)?.id || null);

      if (activeObject instanceof fabric.IText) {
        setSelectedTextObject(activeObject);
      } else {
        setSelectedTextObject(null);
      }
    };

    const handleSelectionCleared = (e: fabric.IEvent) => {
      setSelectedObjectId(null); // Clear selection in context
      setSelectedTextObject(null);
    };

    const updateRenderedDraftPreviews = async () => {
      const templateId = selectedTemplate;
      const renderedImage = await renderClippedImage(fabricCanvasInstance, { format: 'png' });
      const fullCanvasImage = await renderCanvasWithoutGrid(fabricCanvasInstance, { format: 'png' });
      const activeTemplateIds = draftTemplates.map(dt => dt.template.id);

      if (renderedImage && templateId) {
        const previews = [...renderedDraftPreviews.filter(rdp => activeTemplateIds.includes(rdp.templateId))];
        const existingPreviewIndex = previews.findIndex(preview => preview.templateId === templateId);
        if (existingPreviewIndex !== -1) {
          // Update existing preview
          previews[existingPreviewIndex] = {
            templateId,
            draft: renderedImage,
            canvasPreview: fullCanvasImage || '',
          };
        } else {
          // Add new preview
          previews.push({
            templateId,
            draft: renderedImage,
            canvasPreview: fullCanvasImage || '',
          });
        }

        // Save the rendered draft previews and previews to local storage
        const productDraftTemplate = localStorage.getItem(`productDraftTemplate-${product.id}`);
        const storedData = productDraftTemplate ? JSON.parse(productDraftTemplate) : [];
        storedData[groupIndex] = {
          groupIndex,
          productId: product.id,
          templateData: [...previews],
          previews: [...previews],
        }
        localStorage.setItem(`productDraftTemplate-${product.id}`, JSON.stringify(storedData));
        setRenderedDraftPreviews(previews);

        setLoadingPreviews(false);
      }
    };

    // Add after:render event listener to call renderClippedImage
    const handleAfterRender = async () => {
      // Prevent recursive calls
      if (isRendering) return;

      try {
        isRendering = true;
        setLoadingPreviews(true);
        await updateRenderedDraftPreviews();
      } catch (error) {
        console.error('Error rendering clipped image after render:', error);
      } finally {
        isRendering = false;
      }
    };

    // Add unique ID to objects if they don't have one
    const ensureObjectIds = (canvasInstance: fabric.Canvas) => {
      canvasInstance.getObjects().forEach(obj => {
        if (!(obj as any).id) {
          (obj as any).id = uuidv4();
        }
      });
    };
    // Ensure initial objects have IDs
    if (fabricCanvasInstance) {
      ensureObjectIds(fabricCanvasInstance);
    }

    // Attach listeners
    fabricCanvasInstance?.on('selection:created', handleSelection);
    fabricCanvasInstance?.on('selection:updated', handleSelection);
    fabricCanvasInstance?.on('selection:cleared', handleSelectionCleared);
    // Also update IDs when new objects are added
    fabricCanvasInstance?.on('object:added', (e) => {
      if (e.target && !(e.target as any).id) {
        (e.target as any).id = uuidv4();
      }
    });

    // setup keyboard events
    const cleanupKeyboardEvents = setupKeyboardEvents(fabricCanvasInstance, () => {
      if (document.activeElement === fabricCanvasInstance.upperCanvasEl) {
        onSave && onSave();
      }
    });

    fabricCanvasInstance.on('selection:created', handleSelection);
    fabricCanvasInstance.on('selection:updated', handleSelection);
    fabricCanvasInstance.on('selection:cleared', handleSelectionCleared);
    fabricCanvasInstance.on('after:render', handleAfterRender);

    // Add event listeners for object modifications
    fabricCanvasInstance.on('object:modified', boundRecordChanges);
    fabricCanvasInstance.on('object:moved', boundRecordChanges);
    fabricCanvasInstance.on('object:scaled', boundRecordChanges);
    fabricCanvasInstance.on('object:rotated', boundRecordChanges);
    fabricCanvasInstance.on('text:changed', boundRecordChanges);

    // Add handlers for more specific events that might be triggered by color changes
    fabricCanvasInstance.on('object:changed', boundRecordChanges);
    fabricCanvasInstance.on('canvas:updated', boundRecordChanges);

    // Return cleanup function
    return () => {
      fabricCanvasInstance.off('selection:created', handleSelection);
      fabricCanvasInstance.off('selection:updated', handleSelection);
      fabricCanvasInstance.off('selection:cleared', handleSelectionCleared);
      fabricCanvasInstance.off('after:render', handleAfterRender);

      fabricCanvasInstance.off('object:modified', boundRecordChanges);
      fabricCanvasInstance.off('object:moved', boundRecordChanges);
      fabricCanvasInstance.off('object:scaled', boundRecordChanges);
      fabricCanvasInstance.off('object:rotated', boundRecordChanges);
      fabricCanvasInstance.off('text:changed', boundRecordChanges);
      fabricCanvasInstance.off('object:changed', boundRecordChanges);
      fabricCanvasInstance.off('canvas:updated', boundRecordChanges);

      cleanupKeyboardEvents();
    };
  };

  // Move setupEventHandlers call to a useEffect hook
  useEffect(() => {
    if (canvas) {
      try {
        if (canvas.getElement() && canvas.getElement().parentNode) {
          drawGrid(canvas, canvasWidth, canvasHeight, 20, '#a0a0a0', showGrid);
          canvas.renderAll();
        }
      } catch (error) {
        console.error('Error drawing/clearing grid:', error);
      }

      // Setup event handlers
      const cleanupEventHandlers = setupEventHandlers(canvas, selectedTemplate);
      return () => {
        cleanupEventHandlers();
      };
    }
  }, [canvas, selectedTemplate, showGrid, canvasWidth, canvasHeight]);

  const selectObject = (obj: fabric.Object | null) => {
    if (canvas) {
      if (obj) {
        if (!(obj as any).id) {
          (obj as any).id = uuidv4();
        }
        canvas.setActiveObject(obj);
        setSelectedObjectId((obj as any).id);
      } else {
        canvas.discardActiveObject();
        setSelectedObjectId(null);
      }
      canvas.requestRenderAll();
    }
  };

  const deleteObject = useCallback((obj: fabric.Object) => {
    if (!canvas || !obj) return;

    try {
      setIsCanvasLoading(true);

      // remove the object from the canvas
      canvas.remove(obj);
      canvas.renderAll();

      const fieldId = (obj as any)?.fieldId;
      const fileId = (obj as any)?.fileId;

      if (fieldId) {
        const currentTemplateId = selectedTemplate;

        // update draftTemplates
        const updatedDraftTemplates = draftTemplates.map(dt => {
          if (dt.template.id === currentTemplateId) {
            return {
              ...dt,
              variationObjects: dt.variationObjects.filter((vo: any) => vo.fieldId !== fieldId)
            };
          }
          return dt;
        });
        setDraftTemplates(updatedDraftTemplates);

        // update the form state
        if (hookForm) {
          const hasVariationsGroups = 'variationsGroups' in hookForm.getValues();
          const variationsField = hasVariationsGroups ?
            `variationsGroups.${groupIndex}.variations` : 'variations';
          const values = hookForm.getValues(variationsField) || [];

          const updatedValues = values.map((variation: any) => {
            if (variation?.variationField?.id === fieldId) {
              // file type variation and has fileId
              // only delete the specific file
              if (variation.variationFiles?.length > 0 && fileId) {
                const updatedFiles = variation.variationFiles.filter((file: any) => file.id !== fileId);
                return {
                  ...variation,
                  value: updatedFiles.length === 0 ? null : variation.value,
                  variationFiles: updatedFiles
                };
              }
              // non file type or no fileId
              // clear the whole field
              else if (!fileId) {
                return {
                  ...variation,
                  value: null,
                  variationFiles: variation.variationFiles ? [] : undefined
                };
              }
            }
            return variation;
          });

          hookForm.setValue(variationsField, updatedValues);
        }
      }

      // clear the selection state
      setSelectedObjectId(null);
      setSelectedTextObject(null);
      setIsCanvasLoading(false);

      onSave && onSave();
    } catch (error) {
      console.error('Error in deleteObject:', error);
      setIsCanvasLoading(false);
    }
  }, [canvas, draftTemplates, selectedTemplate, hookForm, groupIndex, onSave]);

  return (
    <ProductEditorContext.Provider
      value={{
        // States
        canvas,
        draftPreviews,
        draftTemplates,
        isCanvasLoading,
        isMobileView,
        loadingPreviews,
        renderedDraftPreviews,
        savedObjects,
        selectedTemplate,
        selectedTextObject,
        showGrid,
        showPreview,

        // State Setters
        setCanvas,
        setSelectedTemplate,
        setShowGrid,

        // Functions
        handleCancel: () => onCancel(),
        handleSave,
        handleTemplateChange,
        recordVariationFieldObjectsOnCanvas,
        togglePreview,
        updateSelectedText,
        fontOptions,
        colorPalette,
        showLayerPanel,
        toggleLayerPanel,
        selectedObjectId,
        setSelectedObjectId,
        selectObject,
        deleteObject,

        // Props
        canvasRef,
        groupIndex,
        height: canvasHeight,
        inputName,
        job,
        product,
        width: canvasWidth,
        hookForm,
      }}
    >
      {children}
    </ProductEditorContext.Provider>
  );
};

export const useProductEditor = () => {
  const context = useContext(ProductEditorContext);
  if (context === undefined) {
    throw new Error('useProductEditor must be used within a ProductEditorProvider');
  }
  return context;
};
