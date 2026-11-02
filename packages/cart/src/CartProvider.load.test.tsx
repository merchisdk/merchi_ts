import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import CartProvider, { useCartContext } from './CartProvider';
import { getCartCookie, setCartCookie } from './utilities/cookie';
import { reportCartFailure, CART_FAILURE_SOURCES } from './utilities/reportFailure';
import { tabIdClearCart, tabIdItems } from './utilities/tabs';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockCreateItem = jest.fn();

jest.mock('@merchi/sdk', () => ({
  Merchi: jest.fn().mockImplementation(() => ({
    Cart: { get: (...args: unknown[]) => mockGet(...args) },
    authenticatedFetch: (...args: unknown[]) => mockPost(...args),
  })),
}));
jest.mock('./utilities/product', () => ({ makeProduct: jest.fn(json => json) }));
jest.mock('./utilities/job', () => ({ makeJob: jest.fn(json => json) }));
jest.mock('./utilities/cart', () => ({
  makeCart: (json: any) => ({
    ...json,
    toFormData: () => new FormData(),
    fromJson: jest.fn(),
    toJson: () => ({ id: 99, token: 'new-token', isTest: false }),
  }),
  makeCartItem: () => ({ create: mockCreateItem }),
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
  reportAddCartItemFailure: jest.fn((error, onError) => onError(error)),
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
  const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
  const headlessUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0.8010.0 Safari/537.36';
  function setUserAgent(value: string) {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value });
  }
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockPost.mockReset();
    mockCreateItem.mockReset();
    mockCreateItem.mockImplementation(function (this: any) {
      return Promise.resolve({ toJson: () => ({ id: 7, cart: { id: this.cart.id } }) });
    });
    (getCartCookie as jest.Mock).mockReset();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockPost.mockResolvedValue({ cart: { id: 99, token: 'new-token' } });
    (getCartCookie as jest.Mock).mockResolvedValue(['42', 'saved-token']);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (userAgentDescriptor) Object.defineProperty(navigator, 'userAgent', userAgentDescriptor);
    else delete (navigator as any).userAgent;
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
  it.each([
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0.8010.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Baiduspider-render/2.0)',
  ])('does not create an unused cart on automated startup: %s', async userAgent => {
    setUserAgent(userAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(context.fetchingCart).toBe(false);
    expect(reportCartFailure).not.toHaveBeenCalled();
  });
  it('allows explicit cart opening and concurrent callers in an automated browser', async () => {
    setUserAgent(headlessUserAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => {
      context.toggleCartModal();
      await Promise.all([(window as any).getCart(), (window as any).refetchCart()]);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(context.cart.id).toBe(99);
  });
  it('creates once when explicit interaction joins a pending passive cookie lookup', async () => {
    setUserAgent(headlessUserAgent);
    let finishCookie!: (value: undefined) => void;
    (getCartCookie as jest.Mock).mockImplementationOnce(
      () => new Promise(resolve => { finishCookie = resolve; }),
    ).mockResolvedValue(undefined);
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      first = (window as any).getCart();
      second = (window as any).getCart();
      context.toggleCartModal();
    });
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => { finishCookie(undefined); await Promise.all([first, second]); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(context.cart.id).toBe(99);
  });
  it('restores saved carts for automated clients without duplicating an active read', async () => {
    setUserAgent(headlessUserAgent);
    let finish!: (value: unknown) => void;
    mockGet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    let read!: Promise<void>;
    await act(async () => { read = (window as any).getCart(); context.toggleCartModal(); });
    expect(mockGet).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ toJson: () => ({ id: 42, isTest: false, cartItems: [{ id: 7 }] }) });
      await read;
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(context.cart.cartItems).toHaveLength(1);
  });
  it('keeps explicit retry available after an automated client creation fails', async () => {
    setUserAgent(headlessUserAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    mockPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => { await (window as any).getCart(); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(context.fetchingCart).toBe(false);
    await act(async () => { await (window as any).getCart(); });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(context.cart.id).toBe(99);
  });
  it('initializes a cart for a direct item operation without a storefront readiness helper', async () => {
    setUserAgent(headlessUserAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    const onSuccess = jest.fn(), onError = jest.fn();
    await act(async () => {
      await (window as any).addCartItem({ product: { id: 44 }, quantity: 100 }, onSuccess, onError);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockCreateItem).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ id: 7, cart: { id: 99 } });
    expect(onError).not.toHaveBeenCalled();
  });
  it('rejects a direct item operation when initialization fails without posting an item', async () => {
    setUserAgent(headlessUserAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    mockPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    const onSuccess = jest.fn(), onError = jest.fn();
    await act(async () => {
      await (window as any).addCartItem({ product: { id: 44 }, quantity: 100 }, onSuccess, onError);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockCreateItem).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(context.fetchingCart).toBe(false);
  });
  it('waits for ordinary startup before concurrent direct item operations', async () => {
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    let finish!: (value: unknown) => void;
    mockPost.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    const onSuccess = jest.fn(), onError = jest.fn();
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      const job = { product: { id: 44 }, quantity: 100 };
      first = (window as any).addCartItem(job, onSuccess, onError);
      second = (window as any).addCartItem(job, onSuccess, onError);
    });
    expect(mockCreateItem).not.toHaveBeenCalled();
    await act(async () => {
      finish({ cart: { id: 99, token: 'new-token' } });
      await Promise.all([first, second]);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls.map(call => call[0].cart.id)).toEqual([99, 99]);
    expect(onError).not.toHaveBeenCalled();
  });
  it('does not automatically repeat a failed item write after explicit initialization', async () => {
    setUserAgent(headlessUserAgent);
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    mockCreateItem.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    const onSuccess = jest.fn(), onError = jest.fn();
    const job = { product: { id: 44 }, quantity: 100 };
    await act(async () => { await (window as any).addCartItem(job, onSuccess, onError); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockCreateItem).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => { await (window as any).addCartItem(job, onSuccess, onError); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockCreateItem).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith({ id: 7, cart: { id: 99 } });
  });
  it('shares cold initialization with opening the modal and concurrent getCart callers', async () => {
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    let finish!: (value: unknown) => void;
    mockPost.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      context.toggleCartModal();
      first = (window as any).getCart();
      second = (window as any).getCart();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(context.fetchingCart).toBe(true);
    await act(async () => {
      finish({ cart: { id: 99, token: 'new-token' } });
      await Promise.all([first, second]);
    });
    expect(context.cart.id).toBe(99);
    expect(context.fetchingCart).toBe(false);
    expect(setCartCookie).toHaveBeenCalledTimes(1);
  });
  it('shares an active saved-cart read and allows a later refresh', async () => {
    let finish!: (value: unknown) => void;
    const saved = { toJson: () => ({ id: 42, isTest: false, cartItems: [{ id: 7 }] }) };
    mockGet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue(saved);
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    let read!: Promise<void>;
    await act(async () => {
      context.toggleCartModal();
      read = (window as any).getCart();
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
    await act(async () => { finish(saved); await read; });
    await act(async () => { await (window as any).getCart(); });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockPost).not.toHaveBeenCalled();
    expect(context.cart.cartItems).toHaveLength(1);
  });
  it('releases failed initialization so an explicit retry can create the cart', async () => {
    (getCartCookie as jest.Mock).mockResolvedValue(undefined);
    mockPost.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => root.render(
      <CartProvider domainId={5} createCartAndCookie={() => {}}><Probe /></CartProvider>,
    ));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(context.fetchingCart).toBe(false);
    await act(async () => {
      await Promise.all([(window as any).getCart(), (window as any).getCart()]);
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(context.cart.id).toBe(99);
    expect(context.fetchingCart).toBe(false);
  });
  it('initializes a changed domain independently of the previous pending domain', async () => {
    const finish: Record<number, (value: unknown) => void> = {};
    (getCartCookie as jest.Mock).mockImplementation(id => Promise.resolve([String(id), 'token']));
    mockGet.mockImplementation(id => new Promise(resolve => { finish[id] = resolve; }));
    const view = (id: number) => <CartProvider domainId={id} createCartAndCookie={() => {}}><Probe /></CartProvider>;
    await act(async () => root.render(view(5)));
    await act(async () => root.render(view(6)));
    expect(mockGet).toHaveBeenCalledTimes(2);
    await act(async () => finish[5]({ toJson: () => ({ id: 5, isTest: false }) }));
    let current!: Promise<void>;
    await act(async () => { current = (window as any).getCart(); });
    expect(mockGet).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish[6]({ toJson: () => ({ id: 6, isTest: false }) });
      await current;
    });
    expect(context.cart.id).toBe(6);
  });
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
