/**
 * Type definitions for psd.js
 * https://github.com/meltingice/psd.js
 */

declare module 'psd.js' {
  export interface PsdHeader {
    width: number;
    height: number;
    channels: number;
    depth: number;
    mode: number;
  }

  export interface PsdImage {
    width: () => number;
    height: () => number;
    toPng: () => HTMLImageElement;
    toBase64: () => string;
    saveAsPng: (output: string) => void;
  }

  export interface PsdLayer {
    name: string;
    visible: boolean;
    opacity: number;
    width: number;
    height: number;
    top: number;
    left: number;
    toPng: () => HTMLImageElement;
  }

  export interface PsdFile {
    header: PsdHeader;
    image: PsdImage;
    layers: PsdLayer[];
    tree: () => any;
  }

  export function fromURL(url: string): Promise<PsdFile>;
  export function fromBuffer(buffer: ArrayBuffer): Promise<PsdFile>;
  export function fromFile(file: File): Promise<PsdFile>;

  // Default export
  const PSD: {
    fromURL: typeof fromURL;
    fromBuffer: typeof fromBuffer;
    fromFile: typeof fromFile;
  };
  
  export default PSD;
}
