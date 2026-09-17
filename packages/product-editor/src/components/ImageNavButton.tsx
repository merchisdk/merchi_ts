import React from 'react';
import { FormPrevious, FormNext } from "grommet-icons";

interface ImageNavButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
}

const ImageNavButton = ({ direction, onClick }: ImageNavButtonProps) => (
  <button
    onClick={onClick}
    className={`nav-button ${direction}`}
    aria-label={direction === 'left' ? 'Previous image' : 'Next image'}
    type="button"
  >
    {direction === 'left'
      ? <FormPrevious className="nav-button-icon" color="#6b7280" />
      : <FormNext className="nav-button-icon" color="#6b7280" />
    }
  </button>
);

export default ImageNavButton; 
