declare module "three" {
  export const WebGLRenderer: any;
  export const Scene: any;
  export const PerspectiveCamera: any;
  export const AmbientLight: any;
  export const DirectionalLight: any;
  export const Color: any;
  export const CanvasTexture: any;
  export const Box3: any;
  export const Vector3: any;
  export const SRGBColorSpace: string;
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    parse(
      data: ArrayBuffer,
      path: string,
      onLoad: (gltf: any) => void,
      onError?: (error: unknown) => void,
    ): void;
  }
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(camera: unknown, domElement?: HTMLElement);
    enableDamping: boolean;
    target: { copy: (value: unknown) => void };
    update(): void;
    dispose(): void;
  }
}
