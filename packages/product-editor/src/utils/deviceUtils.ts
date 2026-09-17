export const getDeviceAdjustedDimensions = (defaultWidth = 800, defaultHeight = 600) => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      width: defaultWidth,
      height: defaultHeight
    };
  }

  const isMobile = window.innerWidth < 480;

  // Use default dimensions for desktop
  if (!isMobile) {
    return {
      isMobile: false,
      width: defaultWidth,
      height: defaultHeight
    };
  }

  // Calculate mobile dimensions
  const mobileWidth = Math.min(window.innerWidth * 0.9 - 32, 400);
  const aspectRatio = defaultWidth / defaultHeight;
  const mobileHeight = mobileWidth / aspectRatio;

  return {
    isMobile: true,
    width: mobileWidth,
    height: mobileHeight
  };
}; 
