export const setupKeyboardEvents = (
  canvas: fabric.Canvas,
  onObjectRemoved?: (dataUrl: string) => void
) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete') {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.remove(activeObject);
        canvas.renderAll();

        if (onObjectRemoved) {
          const dataUrl = canvas.toDataURL({
            format: 'png',
            quality: 1,
          });
          onObjectRemoved(dataUrl);
        }
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}; 
