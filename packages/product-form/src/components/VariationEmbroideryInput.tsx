'use client';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { FaTimes } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import DropzoneInput from './DropzoneInput';
import InputHiddenStatic from './InputHiddenStatic';
import VariationError from './VariationError';
import VariationLabel from './VariationLabel';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';
import {
  EmbroideryValue,
  embroideryHex,
  embroideryQualityWarning,
  embroideryValueJson,
  fitEmbroiderySize,
  parseEmbroideryValue,
} from '../utils/embroidery';

function hexChannels(value: string): [number, number, number] {
  const hex = embroideryHex(value).slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function EmbroideryColourPreview({
  src,
  sourceColours,
  threadColours,
}: {
  src: string;
  sourceColours: string[];
  threadColours: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const sourceKey = sourceColours.join('|');
  const threadKey = threadColours.join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src || !sourceColours.length || !threadColours.length) return;
    let cancelled = false;
    setFailed(false);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      const maxEdge = 220;
      const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      try {
        const frame = context.getImageData(0, 0, width, height);
        const pixels = frame.data;
        const sources = sourceColours.map(hexChannels);
        const threads = threadColours.map(hexChannels);
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 16) continue;
          let nearest = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (let colourIndex = 0; colourIndex < sources.length; colourIndex += 1) {
            const channel = sources[colourIndex];
            const distance =
              (pixels[index] - channel[0]) ** 2 +
              (pixels[index + 1] - channel[1]) ** 2 +
              (pixels[index + 2] - channel[2]) ** 2;
            if (distance < nearestDistance) {
              nearest = colourIndex;
              nearestDistance = distance;
            }
          }
          const thread = threads[nearest] || threads[threads.length - 1];
          pixels[index] = thread[0];
          pixels[index + 1] = thread[1];
          pixels[index + 2] = thread[2];
          pixels[index + 3] = 255;
        }
        context.putImageData(frame, 0, 0);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    image.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, sourceKey, threadKey, sourceColours, threadColours]);

  if (failed) {
    return <p className='merchi-embroidery-preview-note'>Colour preview unavailable</p>;
  }
  return <canvas ref={canvasRef} aria-label='Embroidery colour preview' />;
}

interface Props {
  disabled?: boolean;
  name: string;
  variation: any;
}

function sizeText(value: number | undefined): string {
  return value != null && Number(value) > 0 ? String(value) : '';
}

function VariationEmbroideryInput({ disabled, name, variation }: Props) {
  const {
    apiUrl,
    classNameFileUploadContainer,
    classNameFilePreviewContainer,
    classNameFilePreviewIconWrapper,
    control,
    getQuote,
    hookForm,
  } = useMerchiFormContext();
  const { setValue, watch } = hookForm;
  const variationField = variation.variationField || {};
  const fileMode = variationField.embroideryInputMode !== 'text';
  const ratioLocked = variationField.aspectRatioLock == null
    ? true
    : Boolean(variationField.aspectRatioLock);
  const maxWidth = Number(variationField.widthFieldMax) > 0
    ? Number(variationField.widthFieldMax)
    : null;
  const maxHeight = Number(variationField.heightFieldMax) > 0
    ? Number(variationField.heightFieldMax)
    : null;
  const maxColours = Number(variationField.maxColours) > 0
    ? Number(variationField.maxColours)
    : 4;
  const saved = parseEmbroideryValue(watch(`${name}.value`)) || {};
  const [wording, setWording] = useState(saved.text || '');
  const [width, setWidth] = useState(sizeText(saved.widthMm));
  const [height, setHeight] = useState(sizeText(saved.heightMm));
  const [colours, setColours] = useState<string[]>(
    saved.colours?.length ? saved.colours : ['#111111']
  );
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const editingAxis = useRef<'width' | 'height' | null>(null);
  const editVersion = useRef(0);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const fileColourKey = useRef<string | null>(null);
  widthRef.current = width;
  heightRef.current = height;
  const filesName = `${name}.variationFiles`;
  const { append, fields, remove } = useFieldArray({
    control,
    keyName: 'fileId',
    name: filesName,
  });
  const file = fields[0] as any;
  const artworkUrl = file?.viewUrl || file?.cachedViewUrl || '';
  const seenFileId = useRef<string | null>(null);
  useEffect(() => {
    const id = file?.id ? String(file.id) : null;
    if (seenFileId.current && id && seenFileId.current !== id) {
      fileColourKey.current = null;
    } else if (!seenFileId.current && id && saved.sourceColours?.length) {
      fileColourKey.current = id;
    }
    seenFileId.current = id;
  }, [file?.id, saved.sourceColours?.length]);
  const threadColours = (saved.colours?.length ? saved.colours : saved.sourceColours || [])
    .map(embroideryHex);
  const sourceColours = (saved.sourceColours?.length ? saved.sourceColours : threadColours)
    .map(embroideryHex);
  const draft: EmbroideryValue = {
    ...saved,
    text: fileMode ? saved.text : wording,
    widthMm: Number(width) || undefined,
    heightMm: Number(height) || undefined,
    colours: fileMode ? saved.colours : colours.slice(0, maxColours),
  };
  const warning = fileMode ? embroideryQualityWarning(draft) : null;
  const watchedValue = watch(`${name}.value`);

  useEffect(() => {
    const parsed = parseEmbroideryValue(watchedValue);
    if (!parsed) return;
    if (
      editingAxis.current !== 'width' &&
      parsed.widthMm &&
      String(parsed.widthMm) !== width
    ) {
      setWidth(String(parsed.widthMm));
    }
    if (
      editingAxis.current !== 'height' &&
      parsed.heightMm &&
      String(parsed.heightMm) !== height
    ) {
      setHeight(String(parsed.heightMm));
    }
    // Draft resizes write the form value. Don't depend on local size or this
    // would fight the inputs while they are being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValue]);

  const writeValue = (next: EmbroideryValue, quote = true) => {
    setValue(`${name}.value`, embroideryValueJson(next), { shouldDirty: true });
    if (quote) Promise.resolve().then(() => getQuote());
  };

  const measure = async (next: EmbroideryValue, fileId?: string) => {
    const fieldId = variationField.id;
    if (!fieldId) return;
    const current = ++requestId.current;
    const version = editVersion.current;
    setMeasuring(true);
    setError(null);
    try {
      const base = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
      const response = await fetch(
        `${base}variation-fields/${fieldId}/estimate-embroidery/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: next.text || '',
            widthMm: next.widthMm,
            heightMm: next.heightMm,
            colours: next.colours,
            fileId,
          }),
        }
      );
      if (!response.ok) throw new Error(`Measure failed (${response.status})`);
      const data = await response.json();
      if (current !== requestId.current || version !== editVersion.current) return;
      const editing = editingAxis.current;
      const measuredWidth = data.widthMm || data.measuredWidthMm;
      const measuredHeight = data.heightMm || data.measuredHeightMm;
      const extracted = (data.colours || []).map(embroideryHex);
      const keepThreads = Boolean(
        fileId &&
        next.sourceColours?.length &&
        fileColourKey.current === String(fileId)
      );
      if (!keepThreads && extracted.length && fileId) {
        fileColourKey.current = String(fileId);
      }
      const merged: EmbroideryValue = {
        ...next,
        sourceColours: keepThreads ? next.sourceColours : (extracted.length ? extracted : next.sourceColours),
        colours: keepThreads ? next.colours : (extracted.length ? extracted : next.colours),
        coverage: data.coverage,
        pixelWidth: data.pixelWidth || next.pixelWidth,
        pixelHeight: data.pixelHeight || next.pixelHeight,
        widthMm: editing === 'width' ? next.widthMm : (measuredWidth || next.widthMm),
        heightMm: editing === 'height' ? next.heightMm : (measuredHeight || next.heightMm),
      };
      if (editing !== 'width' && measuredWidth) setWidth(String(measuredWidth));
      if (editing !== 'height' && measuredHeight) setHeight(String(measuredHeight));
      writeValue(merged);
    } catch (err: any) {
      if (current === requestId.current) {
        setError(err?.message || 'Unable to measure this embroidery.');
      }
    } finally {
      if (current === requestId.current) setMeasuring(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = {
        ...draft,
        text: fileMode ? undefined : wording,
        colours: fileMode ? draft.colours : colours,
      };
      if (fileMode && !file?.id && !next.widthMm) return;
      if (!fileMode && !wording.trim()) return;
      measure(next, file?.id);
    }, 350);
    return () => window.clearTimeout(handle);
    // Re-measure when the design or size changes. `draft` is derived each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wording, width, height, colours.join('|'), file?.id, fileMode]);

  const sizeRatio = () => {
    const pixelWidth = Number(saved.pixelWidth);
    const pixelHeight = Number(saved.pixelHeight);
    if (pixelWidth > 0 && pixelHeight > 0) return pixelWidth / pixelHeight;
    const configured = Number(variationField.aspectRatio);
    if (configured > 0) return configured;
    const currentWidth = Number(width);
    const currentHeight = Number(height);
    if (currentWidth > 0 && currentHeight > 0) return currentWidth / currentHeight;
    return null;
  };

  const updateSize = (axis: 'width' | 'height', raw: string) => {
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    editVersion.current += 1;
    editingAxis.current = axis;
    if (axis === 'width') {
      widthRef.current = raw;
      setWidth(raw);
    } else {
      heightRef.current = raw;
      setHeight(raw);
    }
    const typed = Number(raw);
    const ratio = sizeRatio();
    let widthMm = axis === 'width'
      ? (Number.isFinite(typed) && typed > 0 ? typed : undefined)
      : (Number(widthRef.current) || undefined);
    let heightMm = axis === 'height'
      ? (Number.isFinite(typed) && typed > 0 ? typed : undefined)
      : (Number(heightRef.current) || undefined);
    if (ratioLocked && ratio && typed > 0) {
      if (axis === 'width') {
        heightMm = Math.round((typed / ratio) * 10) / 10;
        heightRef.current = String(heightMm);
        setHeight(heightRef.current);
      } else {
        widthMm = Math.round((typed * ratio) * 10) / 10;
        widthRef.current = String(widthMm);
        setWidth(widthRef.current);
      }
    }
    writeValue({
      ...draft,
      widthMm,
      heightMm,
    }, false);
  };

  const commitSize = (axis: 'width' | 'height') => {
    editVersion.current += 1;
    editingAxis.current = null;
    const fitted = fitEmbroiderySize({
      width: Number(widthRef.current) || undefined,
      height: Number(heightRef.current) || undefined,
      changed: axis,
      maxWidth,
      maxHeight,
      lock: ratioLocked,
      ratio: sizeRatio(),
    });
    const nextWidth = fitted.width ? String(fitted.width) : '';
    const nextHeight = fitted.height ? String(fitted.height) : '';
    widthRef.current = nextWidth;
    heightRef.current = nextHeight;
    setWidth(nextWidth);
    setHeight(nextHeight);
    writeValue({
      ...draft,
      widthMm: fitted.width,
      heightMm: fitted.height,
    });
  };

  const writeThreads = (nextThreads: string[], nextSources: string[], quote = true) => {
    writeValue({
      ...draft,
      colours: nextThreads.map(embroideryHex),
      sourceColours: nextSources.map(embroideryHex),
    }, quote);
  };

  const changeThread = (index: number, hex: string, quote = false) => {
    const nextThreads = threadColours.slice();
    nextThreads[index] = embroideryHex(hex);
    writeThreads(nextThreads, sourceColours.slice(0, nextThreads.length), quote);
  };

  const removeThread = (index: number) => {
    if (threadColours.length <= 1) return;
    writeThreads(
      threadColours.filter((_, colourIndex) => colourIndex !== index),
      sourceColours.filter((_, colourIndex) => colourIndex !== index)
    );
  };

  return (
    <div className={classNameFileUploadContainer}>
      <VariationLabel
        name={name}
        variationClassName='merchi-embed-form_input-file'
        variation={variation}
      />
      {fileMode ? (
        <>
          <DropzoneInput
            accept='.jpg,.jpeg,.png,.webp,.gif'
            disabled={disabled || measuring}
            multiple={false}
            placeholder={variationField.placeholder || 'Drop artwork image:'}
            onUploadSuccess={(uploaded: any) => {
              if (fields.length) remove(0);
              append(uploaded);
            }}
            preview={file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div className='merchi-embroidery-previews'>
                  <figure>
                    {artworkUrl ? (
                      <img
                        alt={file.name || 'Original artwork'}
                        src={artworkUrl}
                      />
                    ) : null}
                    <figcaption>Original</figcaption>
                  </figure>
                  {artworkUrl && sourceColours.length && threadColours.length ? (
                    <figure>
                      <EmbroideryColourPreview
                        src={artworkUrl}
                        sourceColours={sourceColours}
                        threadColours={threadColours}
                      />
                      <figcaption>Embroidery</figcaption>
                    </figure>
                  ) : null}
                  <button
                    type='button'
                    aria-label='Remove artwork'
                    className={classNameFilePreviewIconWrapper}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      fileColourKey.current = null;
                      remove(0);
                    }}
                  >
                    <FaTimes className='close-icon' />
                  </button>
                </div>
                <div className='merchi-embroidery-measure' style={{ fontSize: 12 }}>
                  {measuring ? (
                    <CgSpinner className='animate_spin' aria-hidden />
                  ) : null}
                  {width ? `${width} mm wide` : 'Measuring width…'}
                  {' · '}
                  {height ? `${height} mm high` : 'Measuring height…'}
                </div>
                {threadColours.length > 0 ? (
                  <div
                    className='merchi-embroidery-threads'
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {threadColours.map((colour, index) => (
                      <div className='merchi-embroidery-thread' key={`${sourceColours[index] || colour}-${index}`}>
                        <input
                          type='color'
                          aria-label={`Thread colour ${index + 1}`}
                          disabled={disabled}
                          value={colour}
                          onChange={(event) => changeThread(index, event.target.value)}
                          onBlur={(event) => changeThread(index, event.target.value, true)}
                        />
                        <button
                          type='button'
                          aria-label={`Remove colour ${colour}`}
                          disabled={disabled || threadColours.length <= 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            removeThread(index);
                          }}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {warning ? (
                  <div className='text-danger' style={{ fontSize: 12 }}>{warning}</div>
                ) : null}
                <InputHiddenStatic
                  name={`${filesName}[0].id`}
                  rules={{ required: true }}
                  value={file.id}
                />
              </div>
            ) : undefined}
          />
        </>
      ) : (
        <>
          <input
            className='form-control'
            disabled={disabled}
            value={wording}
            placeholder={variationField.placeholder || 'Wording'}
            onChange={(event) => setWording(event.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {colours.map((colour, index) => (
              <input
                key={`${colour}-${index}`}
                type='color'
                aria-label={`Thread colour ${index + 1}`}
                disabled={disabled}
                value={colour}
                onChange={(event) => {
                  const next = colours.slice();
                  next[index] = event.target.value;
                  setColours(next);
                }}
              />
            ))}
            {colours.length < maxColours ? (
              <button
                type='button'
                className='btn btn-sm btn-link'
                disabled={disabled}
                onClick={() => setColours([...colours, '#000000'])}
              >
                Add colour
              </button>
            ) : null}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12 }}>Width (mm)</span>
          <input
            className='form-control merchi-embroidery-size-input'
            type='text'
            inputMode='decimal'
            disabled={disabled}
            placeholder='Width (mm)'
            value={width}
            onChange={(event) => updateSize('width', event.target.value)}
            onBlur={() => commitSize('width')}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12 }}>Height (mm)</span>
          <input
            className='form-control merchi-embroidery-size-input'
            type='text'
            inputMode='decimal'
            disabled={disabled}
            placeholder='Height (mm)'
            value={height}
            onChange={(event) => updateSize('height', event.target.value)}
            onBlur={() => commitSize('height')}
          />
        </label>
      </div>
      {error ? <div className='text-danger'>{error}</div> : null}
      <VariationError name={name} />
    </div>
  );
}

export default VariationEmbroideryInput;
