import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Close, FormPrevious, FormNext } from "grommet-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeNavigate } from "../hooks/useSwipeNavigate";

const MODAL_BODY_CLASS = 'has-preview-modal-open';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  productName: string;
  totalImages: number;
  currentIndex: number;
  allImages: any[];
}

const ImageZoomModal = ({
  isOpen,
  onClose,
  imageUrl,
  productName,
  totalImages,
  currentIndex,
  allImages
}: ImageZoomModalProps) => {
  const [modalImageIndex, setModalImageIndex] = useState(currentIndex);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add(MODAL_BODY_CLASS);
      document.documentElement.classList.add(MODAL_BODY_CLASS);
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove(MODAL_BODY_CLASS);
      document.documentElement.classList.remove(MODAL_BODY_CLASS);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove(MODAL_BODY_CLASS);
      document.documentElement.classList.remove(MODAL_BODY_CLASS);
    };
  }, [isOpen]);

  useEffect(() => {
    setModalImageIndex(currentIndex);
    setCurrentImageUrl(imageUrl);
    setSlideDirection('right');
  }, [currentIndex, imageUrl, isOpen]);

  const handlePrevious = () => {
    setSlideDirection('left');
    setModalImageIndex((prev) => {
      const newIndex = (prev - 1 + totalImages) % totalImages;
      setCurrentImageUrl(allImages[newIndex].viewUrl);
      return newIndex;
    });
  };

  const handleNext = () => {
    setSlideDirection('right');
    setModalImageIndex((prev) => {
      const newIndex = (prev + 1) % totalImages;
      setCurrentImageUrl(allImages[newIndex].viewUrl);
      return newIndex;
    });
  };

  const swipeHandlers = useSwipeNavigate({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrevious,
  });

  const slideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    },
    exit: (direction: 'left' | 'right') => ({
      zIndex: 0,
      x: direction === 'left' ? 1000 : -1000,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.05 }
      }
    })
  };

  if (!isOpen) return null;

  // Render the modal directly at the document body level
  return createPortal(
    <div className="zoom-modal">
      <div className="zoom-modal-container">
        <button
          onClick={onClose}
          className="close-button"
          type="button"
        >
          <Close width={36} height={36} color="white" />
        </button>

        {totalImages > 1 && (
          <button
            onClick={handlePrevious}
            className="nav-button-zoom left"
            type="button"
          >
            <FormPrevious width={42} height={42} color="white" />
          </button>
        )}

        <div
          className="zoom-image-container"
          {...swipeHandlers}
        >
          <AnimatePresence initial={false} custom={slideDirection}>
            <motion.img
              key={modalImageIndex}
              src={currentImageUrl}
              alt={productName}
              className="zoom-image"
              loading="lazy"
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            />
          </AnimatePresence>
        </div>

        {totalImages > 1 && (
          <button
            onClick={handleNext}
            className="nav-button-zoom right"
            type="button"
          >
            <FormNext width={42} height={42} color="white" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImageZoomModal; 
