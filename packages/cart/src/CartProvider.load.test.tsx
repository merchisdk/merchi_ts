import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import CartProvider, { useCartContext } from './CartProvider';
import { getCartCookie, setCartCookie } from './utilities/cookie';
import { reportCartFailure, CART_FAILURE_SOURCES } from './utilities/reportFailure';
import { tabIdClearCart, tabIdItems } from './utilities/tabs';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@merchi/sdk', () => ({
  Merchi: jest.fn().mockImplementation(() => ({
    Cart: { get: (...args: unknown[]) => mockGet(...args) },
    authenticatedFetch: (...args: unknown[]) => mockPost(...args),
  })),
}));
jest.mock('./utilities/product', () => ({ makeProduct: jest.fn() }));
jest.mock('./utilities/cart', () => ({
  makeCart: () => ({
    toFormData: () => new FormData(),
    fromJson: jest.fn(),
    toJson: () => ({ id: 99, token: 'new-token', isTest: false }),
  }),
  stripeIsValidAndActive: () => true,
}));
jest.mock('./utilities/cookie', () => ({
  getCartCookie: jest.fn().mockResolvedValue(['42', 'saved-token']),
  getCartCookieToken: jest.fn(),
  setCartCookie: jest.fn(),
  readHandoffCart: jest.fn(),
}));
jest.mock('./utilities/local_storage', () => ({ getSavedCheckoutCustomer: () => null }));
jest.mock('./utilities/job_source', () => ({
  captureAndReadJobSource: () => null,
  jobSourceFieldsForApi: () => ({}),
  cartNeedsSourceUpdate: () => false,
  appendJobSourceToFormData: (form: FormData) => form,
}));
jest.mock('./utilities/reportFailure', () => ({
  reportCartFailure: jest.fn(),
  CART_FAILURE_SOURCES: { load: 'cart.load', create: 'cart.create' },
}));

let context: ReturnType<typeof useCartContext>;
function Probe() {
  context = useCartContext();
  return null;
}

describe('cart load and replacement failures', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockPost.mockResolvedValue({ cart: { id: 99, token: 'new-token' } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  async function mount(error: unknown) {
    mockGet.mockRejectedValue(error);
    await act(async () => {
      root.render(<CartProvider domainId={5} createCartAndCookie={() => {}} cart={{ id: 42, cartItems: [{ id: 7 }] }}>
        <Probe />
      </CartProvider>);
    });
  }
  async function mountSavedCart() {
    mockGet.mockResolvedValue({
      toJson: () => ({ id: 42, isTest: false, cartItems: [{ id: 7 }] }),
    });
    await act(async () => {
      root.render(<CartProvider domainId={5} createCartAndCookie={() => {}}>
        <Probe />
      </CartProvider>);
    });
    await act(async () => context.setActiveTabIndex(tabIdClearCart));
  }
  it.each([new TypeError('Load failed'), { statusCode: 502, message: 'Gateway unavailable' }, { statusCode: 403, message: 'Forbidden' }])('preserves the saved cart and never POSTs a replacement after %s', async error => {
    await mount(error);
    expect(getCartCookie).toHaveBeenCalledWith(5);
    expect(mockPost).not.toHaveBeenCalled();
    expect(setCartCookie).not.toHaveBeenCalled();
    expect(context.cart).toEqual({ id: 42, cartItems: [{ id: 7 }] });
    expect(context.alert.show).toBe(true);
    expect(context.fetchingCart).toBe(false);
    expect(reportCartFailure).toHaveBeenCalledWith(error, CART_FAILURE_SOURCES.load);
  });
  it.each([404, 410])('replaces a genuinely missing cart after HTTP %s', async statusCode => {
    await mount({ statusCode });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/carts/', expect.objectContaining({ method: 'POST' }));
    expect(setCartCookie).toHaveBeenCalledTimes(1);
  });
  it('allows an explicit retry to restore the same cart without creating another', async () => {
    await mount(new TypeError('Load failed'));
    mockGet.mockResolvedValue({ toJson: () => ({ id: 42, isTest: false, cartItems: [{ id: 7 }] }) });
    await act(async () => { await (window as any).getCart(); });
    expect(context.cart.id).toBe(42);
    expect(context.cart.cartItems).toHaveLength(1);
    expect(mockPost).not.toHaveBeenCalled();
  });
  it.each([
    new TypeError('Failed to fetch'),
    { statusCode: 503, message: 'Service unavailable' },
    null,
    undefined,
  ])('keeps the clear-cart panel and saved cart when replacement fails with %s', async error => {
    await mountSavedCart();
    mockPost.mockRejectedValueOnce(error);

    await act(async () => { await context.clearCart(); });

    expect(context.activeTabIndex).toBe(tabIdClearCart);
    expect(context.cart).toEqual({ id: 42, isTest: false, cartItems: [{ id: 7 }] });
    expect(setCartCookie).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(reportCartFailure).toHaveBeenCalledWith(error, CART_FAILURE_SOURCES.create);
    expect(context.alert.show).toBe(true);
    expect(context.alert.message).toBe(error?.message || 'Unable to fetch cart.');
    expect(context.fetchingCart).toBe(false);
  });
  it('finishes clearing only after an explicit retry successfully creates the replacement', async () => {
    await mountSavedCart();
    mockPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => { await context.clearCart(); });
    expect(context.activeTabIndex).toBe(tabIdClearCart);

    await act(async () => { await context.clearCart(); });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(context.cart.id).toBe(99);
    expect(setCartCookie).toHaveBeenCalledTimes(1);
    expect(context.activeTabIndex).toBe(tabIdItems);
    expect(context.alert.show).toBe(false);
    expect(context.fetchingCart).toBe(false);
  });
});
