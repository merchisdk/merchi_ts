export const TEST_CHECKOUT_QUERY = 'merchi_test_checkout';
export const TEST_CHECKOUT_STORAGE_KEY = 'merchi_test_checkout';
export const TEST_CARD_NUMBER = '4242 4242 4242 4242';

export function readTestCheckoutFlag(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const enabled = new URLSearchParams(window.location.search).get(TEST_CHECKOUT_QUERY) === '1';
  try {
    if (enabled) {
      window.localStorage.setItem(TEST_CHECKOUT_STORAGE_KEY, '1');
      return true;
    }
    return window.localStorage.getItem(TEST_CHECKOUT_STORAGE_KEY) === '1';
  } catch {
    return enabled;
  }
}
