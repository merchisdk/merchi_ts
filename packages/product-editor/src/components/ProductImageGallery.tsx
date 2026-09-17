import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import ImageNavButton from "./ImageNavButton";
import ImageZoomModal from "./ImageZoomModal";
import { ZoomIn } from 'grommet-icons';
import { useProductEditor } from '../context/ProductEditorContext';
import { useSwipeNavigate } from '../hooks/useSwipeNavigate';

interface ImageGalleryProps {
  fallbackImageUrl?: string;
}

const ProductImageGallery: React.FC<ImageGalleryProps> = ({ fallbackImageUrl = '' }) => {
  const { product } = useProductEditor();
  const { featureImage = null, images = [], name: productName = 'Loading...' } = product;
  const _images = featureImage ? [featureImage, ...images] : images;
  const allImages = _images.map(image => {
    if (!image) return { viewUrl: '/blueman_white.png' };
    return { viewUrl: image.viewUrl };
  });
  const totalImages = allImages.length;
  // image browser related states
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageUrl, setCurrentImageUrl] = useState(
    allImages[currentIndex]?.viewUrl || fallbackImageUrl || '/blueman_white.png'
  );

  useEffect(() => {
    // set current image URL (for normal image mode)
    if (allImages && allImages.length > 0) {
      setCurrentImageUrl(allImages[currentIndex]?.viewUrl || '/blueman_white.png');
    }
  }, [allImages, currentIndex, fallbackImageUrl]);

  const handleNavigation = (newDirection: 'left' | 'right') => {
    if (!allImages || allImages.length <= 1) return;

    setSlideDirection(newDirection === 'left' ? 'left' : 'right');

    let newIndex;
    const actualTotalImages = Math.min(totalImages, allImages.length);

    if (newDirection === 'left') {
      newIndex = currentIndex === 0 ? actualTotalImages - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === actualTotalImages - 1 ? 0 : currentIndex + 1;
    }

    setCurrentIndex(newIndex);
    setCurrentImageUrl(allImages[newIndex]?.viewUrl || '/blueman_white.png');
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    setCurrentImageUrl(allImages[index]?.viewUrl || '/blueman_white.png');
  };

  // Use the swipe hook
  const swipeHandlers = useSwipeNavigate({
    onSwipeLeft: () => handleNavigation('right'),
    onSwipeRight: () => handleNavigation('left'),
  });

  const slideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'left' ? -1000 : 1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: 'left' | 'right') => ({
      zIndex: 0,
      x: direction === 'left' ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <>
      <div className="image-gallery-container relative">
        <div
          className="image-container overflow-hidden"
        >
          <AnimatePresence initial={false} custom={slideDirection}>
            <motion.div
              key={currentIndex}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="image-slide"
              {...swipeHandlers}
            >
              <img
                src={currentImageUrl}
                alt={productName || "Product Image"}
                className={`gallery-image ${isImageLoading ? '' : 'image-loaded'}`}
                onLoad={() => setIsImageLoading(false)}
              />
              {isImageLoading && (
                <div className="loading-indicator">
                  <div className="loading-spinner"></div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={() => setIsZoomModalOpen(true)}
            className="zoom-button"
            type="button"
          >
            <ZoomIn className="zoom-icon" />
          </button>
        </div>
        {allImages.length > 1 && (
          <div className="nav-buttons-container">
            <ImageNavButton
              direction="left"
              onClick={() => handleNavigation('left')}
            />
            <ImageNavButton
              direction="right"
              onClick={() => handleNavigation('right')}
            />
          </div>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="thumbnails-container">
          <div className="thumbnails-row">
            {allImages.slice(0, 5).map((image, index) => {
              const imageSrc = image.viewUrl || "/blueman_white.png";
              const isSelected = index === currentIndex;

              return (
                <button
                  key={index}
                  onClick={() => handleThumbnailClick(index)}
                  className={`thumbnail-button ${isSelected ? 'selected' : ''}`}
                  type="button"
                >
                  <img
                    src={imageSrc}
                    loading="lazy"
                    alt={`Product Image ${index + 1}`}
                    className="thumbnail-image"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <ImageZoomModal
        isOpen={isZoomModalOpen}
        onClose={() => setIsZoomModalOpen(false)}
        imageUrl={currentImageUrl}
        productName={productName}
        totalImages={allImages.length}
        currentIndex={currentIndex}
        allImages={allImages}
      />
    </>
  );
};

export default ProductImageGallery;
