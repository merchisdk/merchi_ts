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
  embroideryQualityWarning,
  embroideryValueJson,
  parseEmbroideryValue,
} from '../utils/embroidery';

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
  const filesName = `${name}.variationFiles`;
  const { append, fields, remove } = useFieldArray({
    control,
    keyName: 'fileId',
    name: filesName,
  });
  const file = fields[0] as any;
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
    if (parsed.widthMm && String(parsed.widthMm) !== width) {
      setWidth(String(parsed.widthMm));
    }
    if (parsed.heightMm && String(parsed.heightMm) !== height) {
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
      if (current !== requestId.current) return;
      const merged: EmbroideryValue = {
        ...next,
        colours: data.colours || next.colours,
        coverage: data.coverage,
        pixelWidth: data.pixelWidth || next.pixelWidth,
        pixelHeight: data.pixelHeight || next.pixelHeight,
        widthMm: next.widthMm || data.widthMm,
        heightMm: next.heightMm || data.heightMm,
      };
      if (!next.widthMm && data.widthMm) setWidth(String(data.widthMm));
      if (!next.heightMm && data.heightMm) setHeight(String(data.heightMm));
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

  const updateSize = (axis: 'width' | 'height', raw: string) => {
    if (axis === 'width') setWidth(raw);
    else setHeight(raw);
    writeValue({
      ...draft,
      widthMm: Number(axis === 'width' ? raw : width) || undefined,
      heightMm: Number(axis === 'height' ? raw : height) || undefined,
    }, false);
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
          />
          {file ? (
            <div className={classNameFilePreviewContainer} style={{ marginTop: 8, maxWidth: 320 }}>
              <div
                className={classNameFilePreviewIconWrapper}
                onClick={() => remove(0)}
              >
                <FaTimes className='close-icon' />
              </div>
              <div style={{ position: 'relative' }}>
                {file.viewUrl || file.cachedViewUrl ? (
                  <img
                    alt={file.name || 'Embroidery artwork'}
                    src={file.viewUrl || file.cachedViewUrl}
                    style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'contain' }}
                  />
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                  <span>{width || '–'} mm wide</span>
                  <span>{height || '–'} mm high</span>
                </div>
                {warning ? (
                  <div className='text-danger' style={{ fontSize: 12, marginTop: 4 }}>
                    {warning}
                  </div>
                ) : null}
              </div>
              <InputHiddenStatic
                name={`${filesName}[0].id`}
                rules={{ required: true }}
                value={file.id}
              />
            </div>
          ) : null}
          {Array.isArray(draft.colours) && draft.colours.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {draft.colours.map((colour) => (
                <span
                  key={colour}
                  title={colour}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: colour,
                    display: 'inline-block',
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                />
              ))}
            </div>
          ) : null}
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
            className='form-control'
            type='number'
            min={0}
            disabled={disabled}
            value={width}
            onChange={(event) => updateSize('width', event.target.value)}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12 }}>Height (mm)</span>
          <input
            className='form-control'
            type='number'
            min={0}
            disabled={disabled}
            value={height}
            onChange={(event) => updateSize('height', event.target.value)}
          />
        </label>
      </div>
      {measuring ? <CgSpinner className='animate_spin' /> : null}
      {error ? <div className='text-danger'>{error}</div> : null}
      <VariationError name={name} />
    </div>
  );
}

export default VariationEmbroideryInput;
