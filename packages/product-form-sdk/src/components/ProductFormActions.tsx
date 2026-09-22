import * as React from 'react';
import { useProductForm } from './context.js';
import { FooterAction, normalizeFooterActions } from './footerActions.js';

/**
 * Configure the host ProductFormShell footer from form source.
 * Render as the first child of the default-exported form.
 *
 * Example — one "Place order" button that opens the Get quote modal:
 *   <ProductFormActions actions={[{ action: 'getQuote', label: 'Place order', primary: true }]} />
 */
export function ProductFormActions({ actions }: { actions: FooterAction[] }) {
  const { setFooterActions } = useProductForm();
  const key = JSON.stringify(actions);
  const normalized = React.useMemo(
    () => normalizeFooterActions(actions),
    [key],
  );

  React.useLayoutEffect(() => {
    setFooterActions(normalized);
    return () => setFooterActions(null);
  }, [normalized, setFooterActions]);

  return null;
}
