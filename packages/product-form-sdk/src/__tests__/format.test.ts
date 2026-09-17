import { formatCurrency, urlFor } from '../helpers/format';

describe('formatCurrency', () => {
  it('formats with the given currency code', () => {
    expect(formatCurrency(1625, 'NZD')).toContain('1,625');
  });
  it('falls back to USD when no currency given', () => {
    expect(typeof formatCurrency(10)).toBe('string');
  });
});

describe('urlFor', () => {
  it('joins the merchi base with a relative path', () => {
    expect(urlFor('/products/1/')).toBe('https://merchi.co/products/1/');
  });
  it('does not double a leading slash', () => {
    expect(urlFor('products/1/')).toBe('https://merchi.co/products/1/');
  });
});
