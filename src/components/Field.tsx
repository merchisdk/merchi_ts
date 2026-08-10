import * as React from 'react';
import { useMemo, useState } from 'react';
import { useProductForm, FieldSelection } from './context';
import { theme } from './layout';
import { VariationFieldJson, OptionJson } from '../types/variation';
import {
  AreaUnit,
  DisplayModality,
  clampWithAspectRatio,
  defaultModalityForAreaUnit,
  displayToMm,
  estimateAreaCosts,
  formatAreaSummary,
  formatAreaValue,
  mmToDisplay,
  parseAreaValue,
  stepInDisplayUnit,
  unitLabel,
} from '../helpers/area';
import { formatCurrency } from '../helpers/format';

const FIELD = {
  TEXT_INPUT: 1,
  SELECT: 2,
  FILE_UPLOAD: 3,
  TEXT_AREA: 4,
  NUMBER_INPUT: 5,
  CHECKBOX: 6,
  RADIO: 7,
  FIELD_INSTRUCTIONS: 8,
  IMAGE_SELECT: 9,
  COLOUR_PICKER: 10,
  COLOUR_SELECT: 11,
  TURNAROUND_TIME: 12,
  COLOUR_EXTRACT: 13,
  AREA: 14,
} as const;

function Label({ field }: { field: VariationFieldJson }) {
  if (!field.name) return null;
  return (
    <label
      style={{
        fontFamily: theme.font,
        fontSize: 14,
        fontWeight: 700,
        color: theme.text,
        marginBottom: 8,
        display: 'block',
      }}
    >
      {field.name}
      {field.required ? <span style={{ color: theme.primary }}> *</span> : null}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    fontFamily: theme.font,
    fontSize: 14,
    color: theme.text,
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function visibleOptions(field: VariationFieldJson): OptionJson[] {
  return (field.options || []).filter((o) => o?.isVisible !== false);
}

type AreaFieldConfig = VariationFieldJson & {
  areaUnit?: AreaUnit;
  areaStep?: number | null;
  aspectRatioLock?: boolean;
  aspectRatio?: number;
  heightFieldMin?: number | null;
  heightFieldMax?: number | null;
  widthFieldMin?: number | null;
  widthFieldMax?: number | null;
};

function AreaFieldControl({
  field,
  value,
  onChange,
}: {
  field: AreaFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const areaUnit = (field.areaUnit || 'mm') as AreaUnit;
  const aspectLocked = Boolean(field.aspectRatioLock && field.aspectRatio);
  const aspectRatio = Number(field.aspectRatio) || 0;
  const [modality, setModality] = useState<DisplayModality>(() =>
    defaultModalityForAreaUnit(areaUnit)
  );

  const parsed = parseAreaValue(value);
  const heightMm = parsed?.heightMm ?? 0;
  const widthMm = parsed?.widthMm ?? 0;
  const heightDisplay = heightMm ? mmToDisplay(heightMm, modality, areaUnit) : '';
  const widthDisplay = widthMm ? mmToDisplay(widthMm, modality, areaUnit) : '';
  const label = unitLabel(modality, areaUnit);
  const summary = useMemo(
    () => formatAreaSummary(value, modality, areaUnit),
    [value, modality, areaUnit]
  );
  const costDetail = useMemo(() => {
    const estimated = estimateAreaCosts(field, value);
    if (!estimated) return '';
    const currency = field.currency || 'AUD';
    const parts: string[] = [];
    if (estimated.onceOffCost > 0) {
      parts.push(`${formatCurrency(estimated.onceOffCost, currency)} once off`);
    }
    if (estimated.unitCost > 0) {
      parts.push(`${formatCurrency(estimated.unitCost, currency)} per unit`);
    }
    return parts.length ? `+ ${parts.join(', ')}` : '';
  }, [field, value]);

  const commitMm = (
    nextHeightMm: number,
    nextWidthMm: number,
    changed: 'height' | 'width'
  ) => {
    let h = nextHeightMm;
    let w = nextWidthMm;
    if (aspectLocked && aspectRatio > 0) {
      const clamped = clampWithAspectRatio({
        heightMm: h,
        widthMm: w,
        changed,
        aspectRatio,
        heightMin: field.heightFieldMin ?? null,
        heightMax: field.heightFieldMax ?? null,
        widthMin: field.widthFieldMin ?? null,
        widthMax: field.widthFieldMax ?? null,
      });
      h = clamped.heightMm;
      w = clamped.widthMm;
    }
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
      onChange('');
      return;
    }
    onChange(formatAreaValue(h, w));
  };

  const updateHeight = (raw: string) => {
    if (raw === '') {
      onChange('');
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const mm = displayToMm(n, modality, areaUnit);
    commitMm(mm, widthMm > 0 ? widthMm : mm * (aspectRatio || 1), 'height');
  };

  const updateWidth = (raw: string) => {
    if (raw === '') {
      onChange('');
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const mm = displayToMm(n, modality, areaUnit);
    commitMm(heightMm > 0 ? heightMm : mm / (aspectRatio || 1), mm, 'width');
  };

  const step = stepInDisplayUnit(field.areaStep, modality, areaUnit);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontSize: 13,
            fontWeight: modality === 'metric' ? 600 : 400,
            color: modality === 'metric' ? theme.text : theme.muted,
          }}
        >
          Metric
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={modality === 'imperial'}
          aria-label="Use imperial units"
          onClick={() =>
            setModality(modality === 'metric' ? 'imperial' : 'metric')
          }
          style={{
            position: 'relative',
            width: 36,
            height: 20,
            padding: 0,
            border: 'none',
            borderRadius: 999,
            background: modality === 'imperial' ? theme.primary || '#0d6efd' : '#ced4da',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: modality === 'imperial' ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
        <span
          style={{
            fontFamily: theme.font,
            fontSize: 13,
            fontWeight: modality === 'imperial' ? 600 : 400,
            color: modality === 'imperial' ? theme.text : theme.muted,
          }}
        >
          Imperial
        </span>
        {aspectLocked ? (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: theme.font,
              fontSize: 12,
              color: theme.muted,
            }}
          >
            Aspect ratio locked
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.muted }}>
            Height ({label})
          </span>
          <input
            type="number"
            value={heightDisplay === '' ? '' : heightDisplay}
            onChange={(e) => updateHeight(e.target.value)}
            step={step}
            style={inputStyle()}
            aria-label={`${field.name || 'Area'} height`}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: theme.font, fontSize: 13, color: theme.muted }}>
            Width ({label})
          </span>
          <input
            type="number"
            value={widthDisplay === '' ? '' : widthDisplay}
            onChange={(e) => updateWidth(e.target.value)}
            step={step}
            style={inputStyle()}
            aria-label={`${field.name || 'Area'} width`}
          />
        </label>
      </div>
      {summary ? (
        <div style={{ marginTop: 8 }}>
          <p
            style={{
              fontFamily: theme.font,
              fontSize: 13,
              color: theme.muted,
              margin: 0,
            }}
          >
            {summary}
          </p>
          {costDetail ? (
            <p
              style={{
                fontFamily: theme.font,
                fontSize: 12,
                color: theme.muted,
                margin: '4px 0 0',
              }}
            >
              {costDetail}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Field({
  field,
  groupIndex,
}: {
  field?: VariationFieldJson | null;
  /** When set, reads/writes that batch's group-field selections (see GroupRows). */
  groupIndex?: number;
}) {
  const {
    selections,
    setFieldSelection,
    groups,
    setGroupFieldSelection,
  } = useProductForm();
  if (!field || field.id === undefined) return null;

  const fieldId = field.id;
  const isGroupField = groupIndex !== undefined;
  const current: FieldSelection | undefined = isGroupField
    ? groups[groupIndex]?.selections[fieldId]
    : selections[fieldId];
  const fieldType = Number(field.fieldType);
  const selectedIds = current?.selectedOptionIds ?? [];

  const applySelection = (sel: FieldSelection) => {
    if (isGroupField) {
      setGroupFieldSelection(groupIndex, fieldId, sel);
    } else {
      setFieldSelection(fieldId, sel);
    }
  };

  const selectSingle = (optionId: number) =>
    applySelection({
      value: String(optionId),
      selectedOptionIds: [optionId],
    });

  const toggleMulti = (optionId: number) => {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    applySelection({
      value: next.join(','),
      selectedOptionIds: next,
    });
  };

  const setText = (value: string) =>
    applySelection({ value, selectedOptionIds: [] });

  // ── Image select ────────────────────────────────────────────────
  if (fieldType === FIELD.IMAGE_SELECT) {
    const opts = visibleOptions(field);
    return (
      <div>
        <Label field={field} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {opts.map((o) => {
            const checked = o.id !== undefined && selectedIds.includes(o.id);
            const available = o.available !== false;
            return (
              <button
                type="button"
                key={o.id}
                disabled={!available}
                onClick={() => o.id !== undefined && selectSingle(o.id)}
                style={{
                  position: 'relative',
                  textAlign: 'center',
                  padding: 12,
                  background: theme.card,
                  border: `2px solid ${checked ? theme.primary : theme.border}`,
                  borderRadius: theme.radius,
                  cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.45,
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {o.linkedFile?.viewUrl ? (
                  <img
                    src={o.linkedFile.viewUrl}
                    alt={o.value || ''}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 130,
                      objectFit: 'contain',
                      margin: '0 auto 8px',
                    }}
                  />
                ) : null}
                <span
                  style={{
                    display: 'block',
                    fontFamily: theme.font,
                    fontSize: 13,
                    fontWeight: 500,
                    color: theme.text,
                  }}
                >
                  {o.value}
                </span>
                {checked ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: theme.primary,
                      color: theme.primaryText,
                      fontSize: 13,
                      lineHeight: '20px',
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Colour select ───────────────────────────────────────────────
  if (fieldType === FIELD.COLOUR_SELECT) {
    const opts = visibleOptions(field);
    return (
      <div>
        <Label field={field} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {opts.map((o) => {
            const checked = o.id !== undefined && selectedIds.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                title={o.value}
                onClick={() => o.id !== undefined && selectSingle(o.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: o.colour || '#ccc',
                    boxShadow: checked
                      ? `0 0 0 2px ${theme.card}, 0 0 0 4px ${theme.primary}`
                      : `0 0 0 1px ${theme.border}`,
                  }}
                />
                <span style={{ fontFamily: theme.font, fontSize: 11, color: theme.muted }}>
                  {o.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Select dropdown ─────────────────────────────────────────────
  if (fieldType === FIELD.SELECT) {
    const opts = visibleOptions(field);
    return (
      <div>
        <Label field={field} />
        <select
          value={selectedIds[0] !== undefined ? String(selectedIds[0]) : ''}
          onChange={(e) => selectSingle(Number(e.target.value))}
          style={inputStyle()}
        >
          <option value="" disabled>
            Select…
          </option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.value}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ── Radio ───────────────────────────────────────────────────────
  if (fieldType === FIELD.RADIO) {
    const opts = visibleOptions(field);
    return (
      <div>
        <Label field={field} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((o) => (
            <label
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: theme.font,
                fontSize: 14,
                color: theme.text,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name={`field-${fieldId}`}
                checked={o.id !== undefined && selectedIds.includes(o.id)}
                onChange={() => o.id !== undefined && selectSingle(o.id)}
              />
              {o.value}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // ── Checkbox (multi) ────────────────────────────────────────────
  if (fieldType === FIELD.CHECKBOX) {
    const opts = visibleOptions(field);
    return (
      <div>
        <Label field={field} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((o) => (
            <label
              key={o.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: theme.font,
                fontSize: 14,
                color: theme.text,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={o.id !== undefined && selectedIds.includes(o.id)}
                onChange={() => o.id !== undefined && toggleMulti(o.id)}
              />
              {o.value}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // ── Text / number / textarea / colour picker ────────────────────
  if (fieldType === FIELD.TEXT_AREA) {
    return (
      <div>
        <Label field={field} />
        <textarea
          value={current?.value ?? ''}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{ ...inputStyle(), resize: 'vertical' }}
        />
      </div>
    );
  }

  if (fieldType === FIELD.NUMBER_INPUT) {
    return (
      <div>
        <Label field={field} />
        <input
          type="number"
          value={current?.value ?? ''}
          onChange={(e) => setText(e.target.value)}
          style={inputStyle()}
        />
      </div>
    );
  }

  if (fieldType === FIELD.AREA) {
    return (
      <div>
        <Label field={field} />
        <AreaFieldControl
          field={field as AreaFieldConfig}
          value={current?.value ?? ''}
          onChange={setText}
        />
      </div>
    );
  }

  if (fieldType === FIELD.COLOUR_PICKER) {
    return (
      <div>
        <Label field={field} />
        <input
          type="color"
          value={current?.value || '#000000'}
          onChange={(e) => setText(e.target.value)}
          style={{ width: 48, height: 36, border: 'none', background: 'none' }}
        />
      </div>
    );
  }

  if (fieldType === FIELD.FIELD_INSTRUCTIONS) {
    return (
      <div>
        <Label field={field} />
      </div>
    );
  }

  // TEXT_INPUT (default) + unsupported-in-preview types fall back to a text box.
  if (
    fieldType === FIELD.FILE_UPLOAD ||
    fieldType === FIELD.TURNAROUND_TIME ||
    fieldType === FIELD.COLOUR_EXTRACT
  ) {
    const message =
      fieldType === FIELD.FILE_UPLOAD
        ? 'File upload is available on the live store.'
        : fieldType === FIELD.COLOUR_EXTRACT
          ? 'Colour extract (upload artwork and edit extracted colours) is available on the live store.'
          : 'Turnaround options are available on the live store.';
    const selectedColours = (current?.selectedOptions || []).filter(
      (option) => option.colour || option.value,
    );
    return (
      <div>
        <Label field={field} />
        <p style={{ fontFamily: theme.font, fontSize: 13, color: theme.muted, margin: 0 }}>
          {message}
        </p>
        {fieldType === FIELD.COLOUR_EXTRACT && selectedColours.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {selectedColours.map((option, index) => (
              <span
                key={option.id ?? index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: theme.font,
                  fontSize: 12,
                  color: theme.text,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: option.colour || option.value || '#ccc',
                    border: `1px solid ${theme.border}`,
                  }}
                />
                {(option.colour || option.value || '').toUpperCase()}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Label field={field} />
      <input
        type="text"
        value={current?.value ?? ''}
        onChange={(e) => setText(e.target.value)}
        style={inputStyle()}
      />
    </div>
  );
}
