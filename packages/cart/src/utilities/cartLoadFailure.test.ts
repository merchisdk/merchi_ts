import { canReplaceMissingCart } from './cartLoadFailure';

describe('saved-cart replacement', () => {
  it.each([404, 410])('replaces a cart only after a confirmed HTTP %s', statusCode => {
    expect(canReplaceMissingCart({ statusCode })).toBe(true);
  });
  it.each([400, 401, 403, 408, 422, 429, 500, 502, 503])('preserves the existing cart after HTTP %s', statusCode => {
    expect(canReplaceMissingCart({ statusCode })).toBe(false);
  });
  it.each([new TypeError('Load failed'), new TypeError('Failed to fetch'), null, undefined, 'offline'])('preserves the existing cart after a failure without an HTTP status', error => {
    expect(canReplaceMissingCart(error)).toBe(false);
  });
});
