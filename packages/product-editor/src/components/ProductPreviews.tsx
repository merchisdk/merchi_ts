import React, { useEffect, useState, useRef } from 'react';
import ImageZoomModal from './ImageZoomModal';
import '../styles/ProductEditor.css';
import '../styles/BottomPreviewDisplay.css';
import { useProductEditor } from '../context/ProductEditorContext';
import { mapPreviewsWithRendered } from '../utils/draftTemplateUtils';
import { renderDraftPreviewsWithLayers } from '../utils/psdRenderUtils';

interface BottomPreviewDisplayProps { }

const ProductPreviews: React.FC<BottomPreviewDisplayProps> = () => {
  const {
    draftTemplates,
    draftPreviews,
    loadingPreviews,
    renderedDraftPreviews,
  } = useProductEditor();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const [renderedPreviews, setRenderedPreviews] = useState<{ draftPreviewId: number | undefined; pngDataUrl: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs instead of state to track processed data without causing re-renders
  const processedPreviewIdsRef = useRef<Set<number | undefined>>(new Set());
  // Track which template versions we've already processed
  const processedTemplateVersionsRef = useRef<Map<number, string>>(new Map());

  // For debugging
  const renderCountRef = useRef(0);
  // Track if this is first mount
  const isFirstMountRef = useRef(true);

  // When mappedPreviews or renderedDraftPreviews changes, update our rendered PNGs
  useEffect(() => {
    // Skip first render to avoid processing before renderedDraftPreviews are available
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    renderCountRef.current++;

    const processPreviewsWithLayers = async () => {

      // Skip if we're already processing or if we don't have previews
      if (isProcessing || !draftPreviews || draftPreviews.length === 0) {
        return;
      }

      // Map previews with their rendered layers
      const mappedPreviews = mapPreviewsWithRendered(draftTemplates, draftPreviews, renderedDraftPreviews);

      // Skip if there are no mappedPreviews to process
      if (!mappedPreviews || mappedPreviews.length === 0) {
        return;
      }

      // Check if renderedDraftPreviews have changed compared to what we've processed before
      let changedTemplateIds = new Set<number>();
      renderedDraftPreviews.forEach(rdp => {
        const templateId = rdp.templateId;
        const templateVersion = rdp.draft; // Use the image data URL as a version identifier
        const previousVersion = processedTemplateVersionsRef.current.get(templateId);

        if (previousVersion !== templateVersion) {
          changedTemplateIds.add(templateId);
          // Update the stored version
          processedTemplateVersionsRef.current.set(templateId, templateVersion);
        }
      });

      // Only process previews that haven't been processed yet or have changed
      const previewsToProcess = mappedPreviews.filter(mp => {
        const previewId = mp.draftPreview.id;

        // Always process if we haven't processed this preview yet
        if (!processedPreviewIdsRef.current.has(previewId)) {
          return true;
        }

        // If no templates have changed, skip reprocessing
        if (changedTemplateIds.size === 0) {
          return false;
        }

        // Check if this preview uses any templates that have changed
        const shouldProcess = mp.draftPreviewLayers.some(layer =>
          layer.renderedLayer && changedTemplateIds.has(layer.renderedLayer.templateId));

        return shouldProcess;
      });

      // Skip if there's nothing new to process
      if (previewsToProcess.length === 0) {
        return;
      }

      setIsProcessing(true);

      try {
        // Process previews with our new function
        const processedResults = await renderDraftPreviewsWithLayers(previewsToProcess);

        // Update our rendered previews state
        setRenderedPreviews(prevRendered => {
          const newRendered = [...prevRendered];

          processedResults.forEach(result => {
            const existingIndex = newRendered.findIndex(
              r => r.draftPreviewId === result.draftPreviewId
            );

            if (existingIndex !== -1) {
              // Update existing preview
              newRendered[existingIndex] = result;
            } else {
              // Add new preview
              newRendered.push(result);
            }
          });

          return newRendered;
        });

        // Update our processed IDs ref (not state)
        processedResults.forEach(result => {
          if (result.draftPreviewId !== undefined) {
            processedPreviewIdsRef.current.add(result.draftPreviewId);
          }
        });
      } catch (error) {
        console.error('Failed to process previews with layers:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processPreviewsWithLayers();
  }, [draftTemplates, draftPreviews, renderedDraftPreviews, isProcessing]);

  // One-time initialization to handle initial rendering of previews 
  // when component mounts and renderedDraftPreviews are available
  useEffect(() => {
    if (draftPreviews?.length > 0 && renderedDraftPreviews?.length > 0 && renderedPreviews.length === 0) {
      const mappedPreviews = mapPreviewsWithRendered(draftTemplates, draftPreviews, renderedDraftPreviews);

      if (mappedPreviews?.length > 0) {
        (async () => {
          setIsProcessing(true);
          try {
            const processedResults = await renderDraftPreviewsWithLayers(mappedPreviews);

            // Store initial results
            setRenderedPreviews(processedResults);

            // Mark these previews as processed
            processedResults.forEach(result => {
              if (result.draftPreviewId !== undefined) {
                processedPreviewIdsRef.current.add(result.draftPreviewId);
              }
            });

            // Store initial template versions
            renderedDraftPreviews.forEach(rdp => {
              processedTemplateVersionsRef.current.set(rdp.templateId, rdp.draft);
            });

          } catch (error) {
            console.error('[Initialization] Error processing previews:', error);
          } finally {
            setIsProcessing(false);
          }
        })();
      }
    }
  }, [draftPreviews, renderedDraftPreviews, draftTemplates, renderedPreviews.length]);

  const openModal = (index: number) => {
    setSelectedPreviewIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Determine the URL to display for each preview
  const previewUrlsForDisplay = draftPreviews.length > 0
    ? draftPreviews.map(preview => {
      // If we have a rendered PNG for this preview, use it
      const renderedPreview = renderedPreviews.find(rp => rp.draftPreviewId === preview.id);
      return renderedPreview?.pngDataUrl || '';
    })
    : renderedDraftPreviews.map(preview => {
      // If we have a rendered PNG for this preview, use it
      return preview.canvasPreview;
    });

  const previews = draftPreviews?.length > 0 ? draftPreviews : renderedDraftPreviews;
  return (
    <>
      {!isModalOpen && (
        <div className="bottom-preview-section">
          <div className="preview-images">
            {previews.map((preview: any, index) => loadingPreviews || isProcessing ? (
              <div key={`loading-${preview.id || index}`} className='preview-image-box'>
                <div className="preview-image-box-loading-spinner" />
              </div>
            ) : (
              <div
                key={preview.id || `preview-${index}`}
                className="preview-image-box"
                onClick={() => openModal(index)}
                style={{
                  backgroundImage: `url(${previewUrlsForDisplay[index] || preview.file?.viewUrl || ''})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center center'
                }}
                title={`Preview ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <ImageZoomModal
        isOpen={isModalOpen}
        onClose={closeModal}
        imageUrl={previewUrlsForDisplay[selectedPreviewIndex] || (previews[selectedPreviewIndex] as any)?.file?.viewUrl || ''}
        productName="Preview"
        totalImages={previews.length}
        currentIndex={selectedPreviewIndex}
        allImages={previews.map((preview: any, index) => ({
          ...preview,
          key: preview.id || `modal-preview-${index}`
        }))}
      />
    </>
  );
};

export default ProductPreviews; 
