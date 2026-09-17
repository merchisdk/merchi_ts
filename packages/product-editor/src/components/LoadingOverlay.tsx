import React from 'react';
import '../styles/LoadingOverlay.css';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = "Loading Canvas...",
  className = ""
}) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className={`loading-overlay ${className}`}>
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingOverlay; 
