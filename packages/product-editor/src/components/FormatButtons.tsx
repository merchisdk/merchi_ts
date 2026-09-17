import React from 'react';
import { useProductEditor } from '../context/ProductEditorContext';

export const FormatButtons: React.FC = () => {
  const { selectedTextObject, updateSelectedText } = useProductEditor();
  if (!selectedTextObject || !updateSelectedText) return null;

  const isBold = selectedTextObject.fontWeight === 'bold';
  const isUnderlined = selectedTextObject.underline === true;

  return (
    <>
      <button
        type="button"
        className={`toolbar-button bold-button ${isBold ? 'active' : ''}`}
        onClick={() => updateSelectedText({ fontWeight: isBold ? 'normal' : 'bold' })}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`toolbar-button underline-button ${isUnderlined ? 'active' : ''}`}
        onClick={() => updateSelectedText({ underline: !isUnderlined })}
        title="Underline"
      >
        <strong><u>U</u></strong>
      </button>
    </>
  );
}; 
