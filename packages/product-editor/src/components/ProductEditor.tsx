import React from 'react';
import { useProductEditor } from '../context/ProductEditorContext';
import FloatingToolbar from './FloatingToolbar';
import ProductPreviews from './ProductPreviews';
import Toolbar from './Toolbar';
import LoadingOverlay from './LoadingOverlay';
import TextToolbar from './TextToolbar';
import LayerPanel from './LayerPanel';
import '../styles/ProductEditor.css';

const ProductEditor: React.FC = () => {
  const {
    canvasRef,
    draftTemplates,
    groupIndex,
    handleTemplateChange,
    isMobileView,
    selectedTemplate,
    showPreview,
    inputName,
    isCanvasLoading,
    hookForm,
    selectedTextObject,
    showLayerPanel,
    renderedDraftPreviews,
  } = useProductEditor();

  const disableCanvasEvents = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.floating-toolbar') ||
      (e.target as HTMLElement).closest('.bottom-preview-section') ||
      (e.target as HTMLElement).closest('.mobile-bottom-toolbar')) {
      return;
    }
    e.stopPropagation();
  };

  const getTemplatePreviewImage = (templateId?: number) => {
    if (!templateId) return null;

    const renderedPreview = renderedDraftPreviews?.find(preview => preview.templateId === templateId);
    if (renderedPreview?.canvasPreview) {
      return renderedPreview.canvasPreview;
    }

    return null;
  };

  const register = hookForm?.register;
  return (
    <div className="product-editor">
      {register && (
        <input
          {...register(inputName)}
          type='hidden'
        />
      )}
      {!isCanvasLoading && draftTemplates.length > 0 && (
        <div className="template-buttons">
          {draftTemplates.map(({ template }) => (
            <div
              key={template.id}
              className={`template-button ${selectedTemplate === template.id ? 'selected' : ''}`}
              onClick={() => handleTemplateChange(template)}
            >
              {!isMobileView && (getTemplatePreviewImage(template.id) || (template.file && template.file.viewUrl)) && (
                <img
                  src={getTemplatePreviewImage(template.id) || (template.file?.viewUrl || '')}
                  alt={template.name || `Template ${template.id}`}
                  className="template-thumbnail"
                />
              )}
              <span className="template-name">
                {template.name || `Template ${template.id}`}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="main-editor-layout" style={{ position: 'relative' }}>
        <LoadingOverlay isLoading={isCanvasLoading} className="canvas-loading" />
        <div
          className={`editor-container ${isMobileView && showPreview ? 'has-bottom-padding' : ''}`}
        >
          {selectedTextObject && <TextToolbar />}
          <div className="canvas-area" onClick={disableCanvasEvents}>
            <canvas ref={canvasRef} />
          </div>
          {!isMobileView && !isCanvasLoading && <FloatingToolbar />}
          {showLayerPanel && <LayerPanel />}
        </div>

        {showPreview && <ProductPreviews />}
      </div>

      {isMobileView && !isCanvasLoading && (
        <div className="mobile-bottom-toolbar">
          <Toolbar />
        </div>
      )}
    </div>
  );
};

export default ProductEditor;
