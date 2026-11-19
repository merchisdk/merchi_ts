import { readTestCheckoutFlag } from '@merchi/invoice/lib/testCheckout';
export { readTestCheckoutFlag, TEST_CARD_NUMBER, TEST_CHECKOUT_QUERY, TEST_CHECKOUT_STORAGE_KEY } from '@merchi/invoice/lib/testCheckout';

export function persistTestCheckoutFlag(): boolean {
  return readTestCheckoutFlag();
}

export function cartCookieName(domainId: number | string, isTest = false): string {
  return isTest ? `cart-${domainId}-test` : `cart-${domainId}`;
}
