import { Merchi } from '../merchi.js';
import { setup, mockFetch } from '../test_util.js';

setup();

test('can make CartItem', () => {
  const merchi = new Merchi();
  const cartItem = new merchi.CartItem();
  expect(cartItem).toBeTruthy();
});

test('requiresShipment', () => {
  const merchi = new Merchi();
  const cartItem = new merchi.CartItem();
  expect(cartItem.requiresShipment).toThrow(); 
  cartItem.product = new merchi.Product();
  expect(cartItem.requiresShipment).toThrow(); 
  cartItem.product.needsShipping = false;
  expect(cartItem.requiresShipment()).toBe(false);
  cartItem.product.needsShipping = true;
  expect(cartItem.requiresShipment()).toBe(true);
});

test('Get quote update job cost', () => {
  const merchi = new Merchi();
  const cartItem = new merchi.CartItem().fromJson(
    {'quantity': 10, 'totalCost': 0});
  mockFetch(true, {'quantity': 10, 'totalCost': 100}, 200);
  cartItem.calculate().then(item => {
    expect(item.quantity).toEqual(10);
    expect(item.totalCost).toEqual(100);
  });
});


test('a cart item preserves a job without a tax relationship', () => {
  const merchi = new Merchi();
  const job = new merchi.Job().fromJson({ quantity: 100, taxType: null });
  const item = new merchi.CartItem();

  // The cart transfers this nullable API value through its untyped entity adapter.
  expect(() => { (item as any).taxType = job.taxType; }).not.toThrow();
  expect(item.toJson()).toMatchObject({ taxType: null });
  expect(Array.from((item.toFormData() as any).entries())).toEqual([
    ['taxType-0-id', '-1'],
    ['taxType-count', '1'],
  ]);
});

test('clearing a cart tax relationship preserves normal entity linking', () => {
  const merchi = new Merchi();
  const item = new merchi.CartItem();
  const tax = new merchi.CountryTax();
  tax.id = 7;
  item.taxType = tax;
  expect(tax.backObjects.has(item)).toBe(true);

  expect(() => { (item as any).taxType = null; }).not.toThrow();
  expect(item.toJson()).toMatchObject({ taxType: null });
  item.taxType = tax;
  expect(tax.backObjects.has(item)).toBe(true);
  expect(item.taxType).toBe(tax);
});
