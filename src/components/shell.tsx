import * as React from 'react';
import {
  ProductFormProvider,
  ProductFormProviderProps,
  useProductForm,
} from './context';
import { theme } from './layout';
import { productHasGroups } from '../helpers/product';

function QuantityControl() {
  const { product, quantity, setQuantity } = useProductForm();
  if (productHasGroups(product)) return null;
  const min = Number(product.minOrderQuantity ?? product.minimum) || 1;
  return (
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
      <input
        type="number"
        min={min}
        value={quantity}
        onChange={(e) =>
          setQuantity(Math.max(min, parseInt(e.target.value, 10) || min))
        }
        style={{
          width: 160,
          padding: '10px 12px',
          fontFamily: theme.font,
          fontSize: 14,
          color: theme.text,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: '10px 18px',
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 8,
    cursor: 'pointer',
    border: `1px solid ${primary ? theme.primary : theme.border}`,
    background: primary ? theme.primary : theme.card,
    color: primary ? theme.primaryText : theme.text,
  };
}

function Footer() {
  const { quote, loading, currency, helpers, available, actionLabels, submit } =
    useProductForm();
  const total = quote?.totalCost;
  const unit = quote?.costPerUnit;
  const fmt = (n: unknown) =>
    typeof n === 'number' ? helpers.formatCurrency(n, currency) : '—';
  return (
    <div
      style={{
        borderTop: `1px solid ${theme.border}`,
        paddingTop: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: theme.muted,
          }}
        >
          Total {loading ? '· updating…' : ''}
        </div>
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 26,
            fontWeight: 800,
            color: theme.text,
          }}
        >
          {fmt(total)}
        </div>
        {typeof unit === 'number' ? (
          <div style={{ fontFamily: theme.font, fontSize: 13, color: theme.muted }}>
            {fmt(unit)} per unit
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {available.getQuote ? (
          <button type="button" style={btn(false)} onClick={() => submit('getQuote')}>
            {actionLabels.getQuote || 'Get quote'}
          </button>
        ) : null}
        {available.buyNow ? (
          <button type="button" style={btn(false)} onClick={() => submit('buyNow')}>
            {actionLabels.buyNow || 'Buy now'}
          </button>
        ) : null}
        {available.addToCart ? (
          <button type="button" style={btn(true)} onClick={() => submit('addToCart')}>
            {actionLabels.addToCart || 'Add to cart'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Wraps a custom form: provides the form context (state + live pricing) and
 * renders a quantity control above and a total + submit footer below the form's
 * own content. Hosts render this around the form's default export.
 *
 * If `product` is omitted, render children only. AI-built forms sometimes nest
 * `<ProductFormShell>` without props; the host already provided the real shell,
 * so a second Provider with undefined product would crash and fall back to the
 * default GroupRows form.
 */
export function ProductFormShell({
  product,
  pricing,
  actions,
  helpers,
  children,
  initialJob,
  actionLabels,
}: Partial<Omit<ProductFormProviderProps, 'children'>> & {
  children?: React.ReactNode;
}) {
  if (product == null || pricing == null || actions == null || helpers == null) {
    return <>{children}</>;
  }
  return (
    <ProductFormProvider
      product={product}
      pricing={pricing}
      actions={actions}
      helpers={helpers}
      initialJob={initialJob}
      actionLabels={actionLabels}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          fontFamily: theme.font,
        }}
      >
        <QuantityControl />
        {children}
        <Footer />
      </div>
    </ProductFormProvider>
  );
}
