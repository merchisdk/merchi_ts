import React from 'react';
import { Apps, View, Trash, Layer } from 'grommet-icons';
import { useProductEditor } from '../context/ProductEditorContext';
import { addTextToCanvas } from '../utils/canvasUtils';
import '../styles/Toolbar.css';

export default function Toolbar() {
  const {
    canvas,
    width,
    setShowGrid,
    showGrid,
    height,
    showPreview,
    togglePreview,
    showLayerPanel,
    toggleLayerPanel,
    deleteObject,
    selectedObjectId,
    renderedDraftPreviews
  } = useProductEditor();

  // Add handleAddText function before the return statement
  const handleAddText = () => {
    if (!canvas) return;
    addTextToCanvas(canvas, width, height);
  };

  const toggleGrid = () => setShowGrid(!showGrid);

  // Handle delete button click
  const handleDelete = () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      deleteObject(activeObject);
    }
  };

  // Check if previews are available
  const hasPreview = renderedDraftPreviews && renderedDraftPreviews.length > 0;

  return (
    <>
      {/* Grid toggle button */}
      <div className="grid-toggle">
        <div
          className={`toolbar-button ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
        >
          <Apps width={24} height={24} />
          <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
        </div>
      </div>

      {/* Preview toggle button */}
      <div className="preview-toggle">
        <div
          className={`toolbar-button ${showPreview && hasPreview ? 'active' : ''} ${!hasPreview ? 'disabled' : ''}`}
          onClick={hasPreview ? togglePreview : undefined}
        >
          <View width={24} height={24} />
          <span>{hasPreview && showPreview ? 'Hide Preview' : 'Show Preview'}</span>
        </div>
      </div>

      {/* Layer button */}
      <div
        className={`toolbar-button ${showLayerPanel ? 'active' : ''}`}
        onClick={toggleLayerPanel}
      >
        <Layer width={24} height={24} />
        <span>Layer</span>
      </div>

      {/* Delete button */}
      <div
        className={`toolbar-button ${!selectedObjectId ? 'disabled' : ''}`}
        onClick={handleDelete}
      >
        <Trash width={24} height={24} />
        <span>Delete</span>
      </div>
    </>
  );
}
