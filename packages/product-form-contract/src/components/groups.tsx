import * as React from 'react';
import { useProductForm } from './context';
import { Field } from './Field';
import { Card, Heading, Stack, theme } from './layout';
import { OptionJson, VariationFieldJson } from '../types/variation';
import { inventoryStatusText, quoteGroupForOption } from '../helpers/gridQuote';

const COLOUR_SELECT = 11;
const IMAGE_SELECT = 9;

function qtyInputStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: 88,
    padding: '8px 10px',
    fontFamily: theme.font,
    fontSize: 14,
    color: theme.text,
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    opacity: disabled ? 0.55 : 1,
  };
}

const headerCell: React.CSSProperties = {
  fontFamily: theme.font,
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.muted,
  padding: '0 0 8px',
};

const inventoryToneColor = {
  ok: '#65cf85',
  warn: '#ffc928',
  error: theme.primary,
} as const;

/** Quantity input that allows clearing the field while typing (empty → 0 on blur). */
function QuantityInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  placeholder = '0',
  style,
}: {
  value: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const displayValue = draft !== null ? draft : value === 0 ? '' : String(value);

  return (
    <input
      type="number"
      min={0}
      disabled={disabled}
      placeholder={placeholder}
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setDraft('');
          onChange(0);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          setDraft(null);
          onChange(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      style={style}
      aria-label={ariaLabel}
    />
  );
}

function OptionSwatch({
  option,
  fieldType,
}: {
  option: OptionJson;
  fieldType: number;
}) {
  if (fieldType === IMAGE_SELECT && option.linkedFile?.viewUrl) {
    return (
      <img
        src={option.linkedFile.viewUrl}
        alt=""
        style={{
          width: 36,
          height: 36,
          objectFit: 'contain',
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      />
    );
  }
  if (option.colour) {
    return (
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: option.colour,
          border: `1px solid ${theme.border}`,
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      />
    );
  }
  if (fieldType === COLOUR_SELECT) {
    return (
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return null;
}

function InventoryLine({
  needsInventory,
  group,
}: {
  needsInventory: boolean;
  group: ReturnType<typeof quoteGroupForOption>;
}) {
  const status = inventoryStatusText(group, needsInventory);
  if (!status) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        fontFamily: theme.font,
        fontSize: 12,
        color: theme.muted,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: inventoryToneColor[status.tone],
          flexShrink: 0,
        }}
      />
      <span>Inventory: {status.label}</span>
    </div>
  );
}

/**
 * Per-option quantity grid for products with a single group variation field
 * (e.g. Size or Colour). Wired to useProductForm() for live quoting.
 */
export function OptionQuantityGrid({
  field,
  title,
  showCost = true,
  showInventory,
  optionColumnLabel,
}: {
  /** Defaults to product.groupVariationFields[0]. */
  field?: VariationFieldJson | null;
  title?: string;
  /** Show per-row cost from the live quote (default true). */
  showCost?: boolean;
  /** Show inventory status per row (defaults to product.needsInventory). */
  showInventory?: boolean;
  /** Header for the option/colour column (defaults to the field name). */
  optionColumnLabel?: string;
}) {
  const {
    product,
    groupFields,
    optionQuantities,
    setOptionQuantity,
    quote,
    loading,
    currency,
    helpers,
  } = useProductForm();
  const groupField = field ?? groupFields[0];
  if (!groupField?.options?.length || groupField.id === undefined) return null;

  const fieldType = Number(groupField.fieldType);
  const fieldId = groupField.id;
  const needsInventory =
    showInventory ?? Boolean((product as { needsInventory?: boolean })?.needsInventory);
  const optionLabel = optionColumnLabel ?? groupField.name ?? 'Option';

  const options = groupField.options.filter(
    (o) => o?.isVisible !== false && o?.id !== undefined,
  );

  const fmtCost = (amount: unknown) => {
    if (typeof amount !== 'number') return '—';
    return helpers.formatCurrency(amount, currency);
  };

  return (
    <Stack gap={12}>
      {title ? <Heading style={{ fontSize: 15 }}>{title}</Heading> : null}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showCost ? '1fr 96px 112px' : '1fr 96px',
            gap: '12px 16px',
            alignItems: 'center',
            minWidth: 320,
          }}
        >
          <div style={headerCell}>{optionLabel}</div>
          <div style={{ ...headerCell, textAlign: 'center' }}>Quantity</div>
          {showCost ? <div style={{ ...headerCell, textAlign: 'right' }}>Cost</div> : null}

          {options.map((opt) => {
            const optionId = opt.id as number;
            const quotedGroup = quoteGroupForOption(quote, fieldId, optionId);
            const qty = optionQuantities[optionId] ?? 0;
            const unavailable = opt.available === false;
            const rowCost = quotedGroup?.groupCost;
            const displayCost = typeof rowCost === 'number' ? rowCost : 0;

            return (
              <React.Fragment key={optionId}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <OptionSwatch option={opt} fieldType={fieldType} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: theme.font,
                        fontSize: 14,
                        fontWeight: 600,
                        color: theme.text,
                        lineHeight: 1.35,
                      }}
                    >
                      {opt.value}
                    </div>
                    <InventoryLine needsInventory={needsInventory} group={quotedGroup} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <QuantityInput
                    value={qty}
                    disabled={unavailable}
                    onChange={(next) => setOptionQuantity(optionId, next)}
                    style={qtyInputStyle(unavailable)}
                    ariaLabel={`Quantity for ${opt.value ?? 'option'}`}
                  />
                </div>
                {showCost ? (
                  <div
                    style={{
                      fontFamily: theme.font,
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme.text,
                      textAlign: 'right',
                      opacity: loading && qty > 0 ? 0.55 : 1,
                    }}
                  >
                    {fmtCost(displayCost)}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Stack>
  );
}

/**
 * Multi-batch group variation UI: each batch has its own quantity and group-field
 * selections. Use for products with multiple groupVariationFields or free-text
 * group fields.
 */
export function GroupRows({ addLabel = 'Add another batch' }: { addLabel?: string }) {
  const {
    groupFields,
    groups,
    setGroupQuantity,
    addGroup,
    removeGroup,
  } = useProductForm();

  if (!groupFields.length) return null;

  return (
    <Stack gap={20}>
      {groups.map((row, index) => (
        <Card key={index}>
          <Stack gap={16}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Heading style={{ fontSize: 15 }}>Batch {index + 1}</Heading>
              {groups.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeGroup(index)}
                  style={{
                    fontFamily: theme.font,
                    fontSize: 13,
                    color: theme.muted,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: theme.font,
                  fontSize: 14,
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: 8,
                }}
              >
                Quantity
              </label>
              <QuantityInput
                value={row.quantity}
                onChange={(next) => setGroupQuantity(index, next)}
                style={qtyInputStyle()}
                ariaLabel={`Quantity for batch ${index + 1}`}
              />
            </div>
            {groupFields.map((gf) => (
              <Field key={gf.id} field={gf} groupIndex={index} />
            ))}
          </Stack>
        </Card>
      ))}
      <button
        type="button"
        onClick={addGroup}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          fontFamily: theme.font,
          fontSize: 14,
          fontWeight: 600,
          color: theme.primary,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        {addLabel}
      </button>
    </Stack>
  );
}
