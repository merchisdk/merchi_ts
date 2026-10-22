import { Merchi } from '../merchi.js';
import { setup, mockFetch } from '../test_util.js';

setup();

test('can make Cart', () => {
  const merchi = new Merchi();
  const cart = new merchi.Cart();
  expect(cart).toBeTruthy();
});

test('cart token supported by merchi', () => {
  const merchi = new Merchi(undefined, undefined, undefined, 'c');
  const correct = [['skip_rights', 'y'], ['cart_token', 'c']];
  const fetch = mockFetch(true, {'invoice': {'id': 1}}, 200);
  const invocation = merchi.Invoice.get(1);
  expect(fetch.mock.calls[0][1]['query']).toEqual(correct);
  return invocation;
});

test('requiresShipment', () => {
  const merchi = new Merchi();
  const cart = new merchi.Cart();
  expect(cart.requiresShipment).toThrow();
  cart.cartItems = [];
  expect(cart.requiresShipment()).toBe(false);
  cart.cartItems = [new merchi.CartItem()];
  cart.cartItems[0].product = new merchi.Product();
  cart.cartItems[0].product.needsShipping = true;
  expect(cart.requiresShipment()).toBe(true);
  cart.cartItems[0].product.needsShipping = false;
  expect(cart.requiresShipment()).toBe(false);
});

test('pass cookie tokens to query string', () => {
  const cookie = 'cart_token=c;';
  Object.defineProperty(document, 'cookie', {
    get: jest.fn().mockImplementation(() => { return cookie; }),
    set: jest.fn().mockImplementation(() => {}),
  });
  const correct = [
    ['skip_rights', 'y'],
    ['cart_token', 'c'],
  ];
  const fetch = mockFetch(true, {'cart': {'id': 1}}, 200);
  const merchi = new Merchi();
  const invocation = merchi.Cart.get(1);
  expect(fetch.mock.calls[0][1]['query']).toEqual(correct);
  return invocation;
});

test('preserves server payment engine hint', () => {
  const merchi = new Merchi();
  const entity = new merchi.Cart();
  entity.fromJson({ id: 1, stripePaymentEngine: 'wallet' });
  expect(entity.toJson()).toMatchObject({ stripePaymentEngine: 'wallet' });
});

test('preserves isTest', () => {
  const merchi = new Merchi();
  const entity = new merchi.Cart();
  entity.fromJson({ id: 1, isTest: true });
  expect(entity.toJson()).toMatchObject({ isTest: true });
});

test('serialises a new cart when FormData has no set', () => {
  class AppendOnlyFormData {
    fields = new Map<string, string>();
    append(name: string, value: any) {
      this.fields.set(name, String(value));
    }
    get(name: string) {
      return this.fields.has(name) ? this.fields.get(name) : null;
    }
    entries() {
      return this.fields.entries();
    }
  }
  class ReplacingFormData extends AppendOnlyFormData {
    private ready = false;
    append(name: string, value: any) {
      if (!this.ready) {
        throw new Error(`delete was not called before append(${name})`);
      }
      this.ready = false;
      super.append(name, value);
    }
    delete() {
      this.ready = true;
    }
  }
  const serialise = (form: AppendOnlyFormData) => {
    const merchi = new Merchi();
    const cart = new merchi.Cart();
    cart.isTest = false;
    const domain = new merchi.Domain();
    domain.id = 9;
    cart.domain = domain;
    cart.toFormData({existing: form as unknown as FormData});
    return form;
  };

  const appended = serialise(new AppendOnlyFormData());
  expect(appended.get('isTest')).toBe('false');
  expect(appended.get('domain-0-id')).toBe('9');
  expect(appended.get('domain-count')).toBe('1');

  const replaced = serialise(new ReplacingFormData());
  expect(replaced.get('isTest')).toBe('false');
  expect(replaced.get('domain-0-id')).toBe('9');
  expect(replaced.get('domain-count')).toBe('1');
});

test('preserves source attribution', () => {
  const merchi = new Merchi();
  const entity = new merchi.Cart();
  entity.fromJson({
    id: 1,
    sourceChannel: 'meta',
    utmSource: 'facebook',
    sourceClickId: 'IwAR',
  });
  expect(entity.toJson()).toMatchObject({
    sourceChannel: 'meta',
    utmSource: 'facebook',
    sourceClickId: 'IwAR',
  });
});
