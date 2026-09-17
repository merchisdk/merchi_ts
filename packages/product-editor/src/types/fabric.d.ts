import { Canvas } from 'fabric';

declare module 'fabric/fabric-impl' {
  interface ICanvasOptions {
    enableHistory?: boolean;
  }

  interface Canvas {
    enableHistory(): void;
    undo(): void;
    redo(): void;
    upperCanvasEl: HTMLCanvasElement;
  }
}
