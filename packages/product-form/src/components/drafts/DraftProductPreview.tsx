'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { ensureDraftFonts } from '../../utils/draftFonts';
import {
  bodyColourFromDesign,
  drawPrintTexture,
  printAreaFrame,
  printImageSources,
  textureSize,
} from '../../utils/printTexture';
import type { DraftCanvasState } from '../../utils/types';

export interface PreviewSurfaceBinding {
  materialName: string;
  role?: string;
  regionIndex?: number;
  templateId?: number | null;
}

interface Props {
  modelUrl: string;
  surfaces: PreviewSurfaceBinding[];
  templates: any[];
  states: Record<string, DraftCanvasState | undefined>;
  variations?: any[];
  activeTemplateId?: number | null;
}

interface TextureEntry {
  canvas: HTMLCanvasElement;
  texture: { dispose: () => void; needsUpdate: boolean };
}

export default function DraftProductPreview({
  modelUrl,
  surfaces,
  templates,
  states,
  variations,
  activeTemplateId,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const redrawRef = useRef<() => void>(() => {});
  const [error, setError] = React.useState<string | null>(null);
  const latest = useRef({
    surfaces, templates, states, variations, activeTemplateId,
  });
  latest.current = { surfaces, templates, states, variations, activeTemplateId };

  const signature = useMemo(() => JSON.stringify({
    surfaces,
    states,
    activeTemplateId,
    variations: (variations || []).map((variation) => variation?.value),
  }), [surfaces, states, activeTemplateId, variations]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !modelUrl) return undefined;
    let cancelled = false;
    let dispose = () => {};
    setError(null);
    ensureDraftFonts();
    mountPreview(host, modelUrl, () => latest.current).then((view) => {
      if (cancelled) {
        view.dispose();
        return;
      }
      dispose = view.dispose;
      redrawRef.current = view.redraw;
      view.redraw();
    }).catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Could not show the product');
      }
    });
    return () => {
      cancelled = true;
      redrawRef.current = () => {};
      dispose();
    };
  }, [modelUrl]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => redrawRef.current());
    return () => cancelAnimationFrame(frame);
  }, [signature, templates]);

  return (
    <div className='merchi-product-draft-preview3d' ref={hostRef}>
      {error ? <p className='merchi-product-draft-canvas-fallback'>{error}</p> : null}
    </div>
  );
}

function activeState(props: {
  states: Record<string, DraftCanvasState | undefined>;
  activeTemplateId?: number | null;
}): DraftCanvasState | null {
  const id = props.activeTemplateId;
  if (id != null) {
    return props.states[id] || props.states[String(id)] || null;
  }
  const first = Object.values(props.states)[0];
  return first || null;
}

async function mountPreview(
  host: HTMLDivElement,
  url: string,
  getProps: () => Omit<Props, 'modelUrl'>,
) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

  let disposed = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#09090b');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2, 3, 4);
  scene.add(key);

  const textures = new Map<string, TextureEntry>();
  const images = new Map<string, HTMLImageElement>();
  const pending = new Set<string>();
  let materials = new Map<string, any[]>();
  let frameId = 0;

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  function frame() {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  }
  frame();

  function surfaceNamed(name: string) {
    return (getProps().surfaces || []).find((surface) => surface.materialName === name);
  }

  function ensureTexture(name: string, width: number, height: number) {
    const current = textures.get(name);
    if (current && current.canvas.width === width && current.canvas.height === height) {
      return current;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    if (current) current.texture.dispose();
    const entry = { canvas, texture };
    textures.set(name, entry);
    return entry;
  }

  function redraw() {
    if (disposed) return;
    const props = getProps();
    const colour = bodyColourFromDesign(activeState(props), props.variations);
    materials.forEach((mats, name) => {
      if (surfaceNamed(name)?.role !== 'body') return;
      mats.forEach((mat) => {
        if (mat.color) mat.color.set(colour);
        mat.needsUpdate = true;
      });
    });
    (props.surfaces || []).forEach((surface) => {
      if (surface.role !== 'print' || surface.templateId == null) return;
      const template = (props.templates || []).find(
        (item) => Number(item?.id) === Number(surface.templateId),
      );
      const canvasState = template
        ? props.states?.[template.id] || props.states?.[String(template.id)]
        : null;
      const mats = materials.get(surface.materialName) || [];
      if (!template || !canvasState || !mats.length) return;
      const area = printAreaFrame(template, surface.regionIndex || 0);
      const size = textureSize(area);
      const entry = ensureTexture(surface.materialName, size.width, size.height);
      const ctx = entry.canvas.getContext('2d');
      if (!ctx) return;
      drawPrintTexture(
        ctx,
        canvasState,
        area,
        images,
        size.width,
        size.height,
        bodyColourFromDesign(canvasState, props.variations),
      );
      entry.texture.needsUpdate = true;
      mats.forEach((mat) => {
        mat.map = entry.texture;
        if (mat.color) mat.color.set('#ffffff');
        mat.needsUpdate = true;
      });
      printImageSources(canvasState).forEach((src) => {
        if (images.has(src) || pending.has(src)) return;
        pending.add(src);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          images.set(src, img);
          pending.delete(src);
          redraw();
        };
        img.onerror = () => pending.delete(src);
        img.src = src;
      });
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    controls.dispose();
    textures.forEach((entry) => entry.texture.dispose());
    renderer.dispose();
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load the 3D model');
    const buffer = await response.arrayBuffer();
    if (disposed) return { redraw, dispose };
    const gltf = await new Promise<any>((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', resolve, reject);
    });
    if (disposed) return { redraw, dispose };
    scene.add(gltf.scene);
    await nameMaterials(gltf);
    materials = collectMaterials(gltf.scene);
    fitCamera(THREE, gltf.scene, camera, controls);
    resize();
    return { redraw, dispose };
  } catch (err) {
    dispose();
    throw err;
  }
}

async function nameMaterials(gltf: any) {
  const defs = gltf.parser?.json?.materials || [];
  await Promise.all(defs.map(async (def: { name?: string }, index: number) => {
    try {
      const material = await gltf.parser.getDependency('material', index);
      material.name = def?.name || `material_${index}`;
    } catch {
      /* A missing material dependency should not block the rest of the model. */
    }
  }));
}

function collectMaterials(root: any) {
  const map = new Map<string, any[]>();
  root.traverse((obj: any) => {
    if (!obj.isMesh || !obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    list.forEach((mat: any) => {
      if (!mat?.name) return;
      const bucket = map.get(mat.name) || [];
      if (!bucket.includes(mat)) bucket.push(mat);
      map.set(mat.name, bucket);
    });
  });
  return map;
}

function fitCamera(THREE: any, root: any, camera: any, controls: any) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.001) * 0.5;
  const distance = radius / Math.sin((camera.fov * Math.PI) / 360);
  camera.position.set(
    center.x + distance * 0.35,
    center.y + distance * 0.2,
    center.z + distance,
  );
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}
