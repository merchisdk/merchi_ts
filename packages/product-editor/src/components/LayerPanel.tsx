import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { useProductEditor } from '../context/ProductEditorContext';
import { Close, Drag, TextAlignCenter, Image as ImageIcon, Up, Down } from 'grommet-icons';
import '../styles/LayerPanel.css';

const reorder = (list: any[], startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const LAYER_ITEM_HEIGHT_PX = 45;

const LayerPanel: React.FC = () => {
  const { canvas, toggleLayerPanel, selectedObjectId, selectObject, isMobileView } = useProductEditor();
  const [layers, setLayers] = useState<fabric.Object[]>([]);
  const dragItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragOverIndexVisual, setDragOverIndexVisual] = useState<number | null>(null);

  useEffect(() => {
    if (canvas) {
      const updateLayers = () => {
        const filteredObjects = canvas.getObjects().filter(obj =>
          (obj.type === 'i-text' || obj.type === 'image') && obj.selectable
        );
        setLayers([...filteredObjects].reverse());
      };
      updateLayers();

      const handleCanvasChange = () => updateLayers();
      canvas.on('object:added', handleCanvasChange);
      canvas.on('object:removed', handleCanvasChange);
      canvas.on('stack:changed', handleCanvasChange);
      canvas.on('selection:created', handleCanvasChange);
      canvas.on('selection:updated', handleCanvasChange);
      canvas.on('selection:cleared', handleCanvasChange);

      return () => {
        canvas.off('object:added', handleCanvasChange);
        canvas.off('object:removed', handleCanvasChange);
        canvas.off('stack:changed', handleCanvasChange);
        canvas.off('selection:created', handleCanvasChange);
        canvas.off('selection:updated', handleCanvasChange);
        canvas.off('selection:cleared', handleCanvasChange);
      };
    }
  }, [canvas]);

  const getLayerInfo = (object: fabric.Object): { name: string; icon: JSX.Element } => {
    if (object.type === 'i-text') {
      return {
        name: (object as fabric.IText).text?.substring(0, 20) || 'Text',
        icon: <TextAlignCenter size="medium" />
      };
    }
    if (object.type === 'image') {
      const imageObject = object as fabric.Image;
      const src = imageObject.getSrc();
      return {
        name: (object as any).name || (src ? src.split('/').pop()?.substring(0, 20) : undefined) || 'Image',
        icon: <img src={src} alt="layer thumb" className="layer-thumbnail" />
      };
    }
    return { name: 'Unknown Layer', icon: <></> };
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    if (isMobileView) return;
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setIsDraggingOver(true), 0);
  };

  const handleDragEnterItem = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    if (isMobileView) return;
    e.preventDefault();
    dragOverItemIndex.current = index;
    setDragOverIndexVisual(index);
  };

  const handleDragLeaveList = (e: React.DragEvent<HTMLUListElement>) => {
    if (isMobileView) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      dragOverItemIndex.current = null;
      setDragOverIndexVisual(null);
    }
  };

  const handleDragOverList = (e: React.DragEvent<HTMLUListElement>) => {
    if (isMobileView) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLUListElement>) => {
    if (isMobileView) return;
    e.preventDefault();
    const sourceIndex = dragItemIndex.current;
    const destinationIndex = dragOverItemIndex.current;

    setIsDraggingOver(false);
    setDragOverIndexVisual(null);
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;

    if (sourceIndex === null || destinationIndex === null || sourceIndex === destinationIndex) {
      return;
    }

    const reorderedLayers = reorder(layers, sourceIndex, destinationIndex);

    const objectToMove = layers[sourceIndex];

    setLayers(reorderedLayers);

    if (canvas && objectToMove) {
      const totalObjects = canvas.getObjects().length;
      const fabricTargetIndex = totalObjects - 1 - destinationIndex;
      canvas.moveTo(objectToMove, fabricTargetIndex);
      canvas.requestRenderAll();
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    if (isMobileView) return;
    setIsDraggingOver(false);
    setDragOverIndexVisual(null);
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  const moveLayerUp = (index: number) => {
    if (index <= 0 || !canvas) return;

    const objectToMove = layers[index];
    const objectAbove = layers[index - 1];

    const fabricIndexOfAbove = canvas.getObjects().indexOf(objectAbove);
    if (fabricIndexOfAbove < 0) {
      console.error("Could not find objectAbove in canvas stack for moveLayerUp");
      return;
    }

    const targetFabricIndex = fabricIndexOfAbove;
    canvas.moveTo(objectToMove, targetFabricIndex);
    setLayers(prevLayers => reorder(prevLayers, index, index - 1));
    canvas.requestRenderAll();
  };

  const moveLayerDown = (index: number) => {
    if (index >= layers.length - 1 || !canvas) return;

    const objectToMove = layers[index];
    const objectBelow = layers[index + 1];

    const fabricIndexOfBelow = canvas.getObjects().indexOf(objectBelow);
    if (fabricIndexOfBelow < 0) {
      console.error("Could not find objectBelow in canvas stack for moveLayerDown");
      return;
    }

    const targetFabricIndex = fabricIndexOfBelow;
    canvas.moveTo(objectToMove, targetFabricIndex);
    setLayers(prevLayers => reorder(prevLayers, index, index + 1));
    canvas.requestRenderAll();
  };

  const handleLayerClick = (layer: fabric.Object) => {
    selectObject(layer);
  };

  return (
    <div className={`layer-panel`}>
      <div className="layer-panel-header">
        <h3>Layers</h3>
        <button onClick={toggleLayerPanel} className="close-button" title="Close Panel">
          <Close size="small" />
        </button>
      </div>
      <ul
        className={`layer-list ${isDraggingOver ? 'is-dragging-active' : ''}`}
        onDragOver={handleDragOverList}
        onDrop={handleDrop}
        onDragLeave={handleDragLeaveList}
      >
        {layers.map((layer, index) => {
          const layerInfo = getLayerInfo(layer);
          const layerId = (layer as any).id;
          const isSelected = layerId && layerId === selectedObjectId;
          const isDraggingThisItem = !isMobileView && isDraggingOver && dragItemIndex.current === index;

          let transformStyle = 'translateY(0px)';
          if (!isMobileView && isDraggingOver && dragItemIndex.current !== null && dragOverIndexVisual !== null && !isDraggingThisItem) {
            const draggingFromIndex = dragItemIndex.current;
            const hoveringOverIndex = dragOverIndexVisual;

            if (index > draggingFromIndex && index <= hoveringOverIndex) {
              transformStyle = `translateY(-${LAYER_ITEM_HEIGHT_PX}px)`;
            }
            else if (index < draggingFromIndex && index >= hoveringOverIndex) {
              transformStyle = `translateY(${LAYER_ITEM_HEIGHT_PX}px)`;
            }
          }

          return (
            <li
              key={`layer-${layerId || index}`}
              draggable={!isMobileView}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnterItem(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleLayerClick(layer)}
              className={`layer-item ${isSelected ? 'selected' : ''} ${isDraggingThisItem ? 'is-dragging-item' : ''}`}
              style={{ transform: transformStyle }}
            >
              <span className="layer-icon">{layerInfo.icon}</span>
              <span className="layer-name">{layerInfo.name}</span>

              {isMobileView ? (
                <div className="layer-mobile-controls">
                  <button
                    className="layer-move-button"
                    onClick={(e) => { e.stopPropagation(); moveLayerUp(index); }}
                    disabled={index === 0}
                    title="Move Up"
                  >
                    <Up size="small" />
                  </button>
                  <button
                    className="layer-move-button"
                    onClick={(e) => { e.stopPropagation(); moveLayerDown(index); }}
                    disabled={index === layers.length - 1}
                    title="Move Down"
                  >
                    <Down size="small" />
                  </button>
                </div>
              ) : (
                <span className="layer-drag-indicator">
                  <Drag size="small" />
                </span>
              )}
            </li>
          );
        })}
        {layers.length === 0 && <li className="no-layers">No layers found</li>}
      </ul>
    </div>
  );
};

export default LayerPanel;
