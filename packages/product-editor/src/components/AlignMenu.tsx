import React, { useState, useRef, useEffect } from 'react';
import { TextAlignLeft, TextAlignCenter, TextAlignRight } from 'grommet-icons';
import { useProductEditor } from '../context/ProductEditorContext';
import '../styles/TextToolbar.css';

export const AlignMenu: React.FC = () => {
  const { selectedTextObject, updateSelectedText } = useProductEditor();
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!selectedTextObject || !updateSelectedText) return null;


  const handleAlign = (align: 'left' | 'center' | 'right') => {
    updateSelectedText({ textAlign: align });
    setShowMenu(false);
  };

  return (
    <div className="align-group" ref={ref}>
      <button
        type="button"
        className="toolbar-button align-trigger"
        onClick={() => setShowMenu(prev => !prev)}
        title="Text Align"
      >
        {selectedTextObject.textAlign === 'center' ? <TextAlignCenter /> :
          selectedTextObject.textAlign === 'right' ? <TextAlignRight /> : <TextAlignLeft />}
      </button>
      {showMenu && (
        <div className="align-popover">
          <button type="button" className={`toolbar-button ${selectedTextObject.textAlign === 'left' ? 'active' : ''}`} onClick={() => handleAlign('left')}><TextAlignLeft /></button>
          <button type="button" className={`toolbar-button ${selectedTextObject.textAlign === 'center' ? 'active' : ''}`} onClick={() => handleAlign('center')}><TextAlignCenter /></button>
          <button type="button" className={`toolbar-button ${selectedTextObject.textAlign === 'right' ? 'active' : ''}`} onClick={() => handleAlign('right')}><TextAlignRight /></button>
        </div>
      )}
    </div>
  );
}; 
