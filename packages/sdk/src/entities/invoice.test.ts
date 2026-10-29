import { setup, mockFetch } from '../test_util.js';
import { Merchi } from '../merchi.js';

setup();

test('can make Invoice', () => {
  const merchi = new Merchi();
  const invoice = new merchi.Invoice();
  expect(invoice).toBeTruthy();
});

test('pass cookie tokens to query string', () => {
  const cookie = 'session_token=s; client_token=c; invoice_token=i';
  Object.defineProperty(document, 'cookie', {
    get: jest.fn().mockImplementation(() => { return cookie; }),
    set: jest.fn().mockImplementation(() => {}),
  });
  const correct = [
    ['skip_rights', 'y'],
    ['session_token', 's'],
    ['client_token', 'c'],
    ['invoice_token', 'i'],
  ];
  const fetch = mockFetch(true, {'invoice': {'id': 1}}, 200);
  const merchi = new Merchi();
  const invocation = merchi.Invoice.get(1);
  expect(fetch.mock.calls[0][1]['query']).toEqual(correct);
  return invocation;
});

test('client and invoice tokens supported by merchi', () => {
  const merchi = new Merchi('s', 'c', 'i');
  const correct = [
    ['skip_rights', 'y'],
    ['session_token', 's'],
    ['client_token', 'c'],
    ['invoice_token', 'i'],
  ];
  const fetch = mockFetch(true, {'invoice': {'id': 1}}, 200);
  const invocation = merchi.Invoice.get(1);
  expect(fetch.mock.calls[0][1]['query']).toEqual(correct);
  return invocation;
});

test('reads quote fields', () => {
  const merchi = new Merchi();
  const invoice = new merchi.Invoice();
  invoice.fromJson({
    id: 1,
    isQuote: true,
    quoteDeclinedDate: 1761700000,
    quoteDeclineReason: 'Too expensive',
  });
  expect(invoice.isQuote).toBe(true);
  expect(invoice.quoteDeclinedDate).toBeInstanceOf(Date);
  expect(invoice.quoteDeclineReason).toBe('Too expensive');
});

test('approveQuote posts to approve_quote with the invoice token', async () => {
  const merchi = new Merchi(undefined, undefined, 'i');
  const fetch = mockFetch(
    true, {invoice: {id: 1, isQuote: false}, paymentUrl: 'https://pay'}, 200);
  const invoice = new merchi.Invoice();
  invoice.id = 1;
  invoice.isQuote = true;
  const result = await invoice.approveQuote();
  expect(fetch.mock.calls[0][0]).toContain('/invoices/1/approve_quote/');
  expect(fetch.mock.calls[0][1]['method']).toBe('POST');
  expect(fetch.mock.calls[0][1]['query']).toContainEqual(['invoice_token', 'i']);
  expect(result.paymentUrl).toBe('https://pay');
  expect(invoice.isQuote).toBe(false);
});

test('declineQuote sends the reason', async () => {
  const merchi = new Merchi();
  const fetch = mockFetch(true, {invoice: {id: 1}, paymentUrl: ''}, 200);
  const invoice = new merchi.Invoice();
  invoice.id = 1;
  await invoice.declineQuote('Too expensive');
  expect(fetch.mock.calls[0][0]).toContain('/invoices/1/decline_quote/');
  expect(fetch.mock.calls[0][1]['body'].get('reason')).toBe('Too expensive');
});

test('preserves server payment engine hint', () => {
  const merchi = new Merchi();
  const entity = new merchi.Invoice();
  entity.fromJson({ id: 1, stripePaymentEngine: 'wallet' });
  expect(entity.toJson()).toMatchObject({ stripePaymentEngine: 'wallet' });
});
