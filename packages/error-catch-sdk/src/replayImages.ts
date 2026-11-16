const PUBLIC_IMAGE = "img[data-replay-public-image]";
const MAX_DIMENSION = 480;
const MAX_IMAGE_CHARS = 48 * 1024;
const MAX_SNAPSHOT_IMAGE_CHARS = 300 * 1024;

export function isPublicReplayImage(node: EventTarget | null, privateSelector: string): node is HTMLImageElement {
  return node instanceof HTMLImageElement && node.matches(PUBLIC_IMAGE) &&
    !node.closest(privateSelector) && /^https?:\/\//.test(node.currentSrc);
}

/** Encode already-loaded catalog images without changing the live DOM or fetching resources. */
export function createReplayImageReader(findNode: (id: number) => Node | null, privateSelector: string) {
  const cache = new WeakMap<HTMLImageElement, { src: string; data: string }>();

  return () => {
    let remaining = MAX_SNAPSHOT_IMAGE_CHARS;
    return (id: number): string | undefined => {
      const image = findNode(id);
      if (remaining <= 0 || !isPublicReplayImage(image, privateSelector) ||
          !image.complete || !image.naturalWidth || !image.naturalHeight) return;
      const src = image.currentSrc;
      const cached = cache.get(image);
      let data = cached?.src === src ? cached.data : undefined;
      if (data === undefined) {
        data = "";
        const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = image.ownerDocument.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        try {
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            let encoded = canvas.toDataURL("image/webp", 0.72);
            if (!encoded.startsWith("data:image/webp;base64,")) encoded = canvas.toDataURL("image/jpeg", 0.72);
            if (/^data:image\/(?:webp|jpeg);base64,/.test(encoded) && encoded.length <= MAX_IMAGE_CHARS) {
              data = encoded;
            }
          }
        } catch {
          // Images inaccessible to canvas can still display normally on the storefront.
        }
        cache.set(image, { src, data });
      }
      if (!data || data.length > remaining) return;
      remaining -= data.length;
      return data;
    };
  };
}
