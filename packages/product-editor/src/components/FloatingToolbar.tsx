import React, { useState, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import '../styles/FloatingToolbar.css';
const FloatingToolbar: React.FC = () => {
  const [position, setPosition] = useState({ x: 15, y: 15 });
  const [isDragging, setIsDragging] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!toolbarRef.current) return;
    // Prevent dragging if clicking on buttons inside the toolbar
    if ((e.target as HTMLElement).closest('.toolbar-button')) {
      return;
    }
    setIsDragging(true);
    const rect = toolbarRef.current.getBoundingClientRect();
    offset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    if (toolbarRef.current) {
      toolbarRef.current.style.cursor = 'grabbing';
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !toolbarRef.current) return;
    let newX = e.clientX - offset.current.x;
    let newY = e.clientY - offset.current.y;

    const parent = toolbarRef.current.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();

      newX = Math.max(parentRect.left, Math.min(newX, parentRect.right - toolbarRect.width));
      newY = Math.max(parentRect.top, Math.min(newY, parentRect.bottom - toolbarRect.height));
      newX -= parentRect.left;
      newY -= parentRect.top;
    }
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (toolbarRef.current) {
      toolbarRef.current.style.cursor = 'grab';
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={toolbarRef}
      className="floating-toolbar"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <Toolbar />
    </div>
  );
};

export default FloatingToolbar; 
