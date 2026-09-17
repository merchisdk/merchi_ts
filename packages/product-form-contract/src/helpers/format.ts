const MERCHI_BASE = 'https://merchi.co';

/** Format a numeric amount as a currency string. */
export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Build an absolute merchi.co URL from a relative path. */
export function urlFor(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `${MERCHI_BASE}/${trimmed}`;
}
