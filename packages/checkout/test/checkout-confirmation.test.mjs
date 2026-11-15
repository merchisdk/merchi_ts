import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmCheckoutSubmission } from '../src/actions/checkoutConfirmation.ts';

test('a lost checkout response leaves the outcome unknown and never resends the POST', async () => {
  const networkFailure = new TypeError('Load failed');
  let sends = 0;
  const result = await confirmCheckoutSubmission(async () => {
    sends += 1;
    throw networkFailure;
  }, 'quote request');

  assert.equal(sends, 1);
  assert.equal(result.confirmed, false);
  assert.equal(result.error, networkFailure);
  assert.match(result.message, /couldn't confirm your quote request/);
  assert.match(result.message, /contact the store before submitting again/);
});

test('an HTTP gateway error also cannot confirm whether a checkout succeeded', async () => {
  const result = await confirmCheckoutSubmission(
    async () => Response.json({ message: 'Bad gateway' }, { status: 502 }),
    'order',
  );
  assert.equal(result.confirmed, false);
  assert.equal(result.statusCode, 502);
  assert.match(result.message, /couldn't confirm your order/);
});

test('a parsed validation response still tells the shopper what to correct', async () => {
  const result = await confirmCheckoutSubmission(
    async () => Response.json({ message: 'Enter a valid phone number' }, { status: 422 }),
    'order',
  );
  assert.equal(result.confirmed, false);
  assert.equal(result.statusCode, 422);
  assert.equal(result.message, 'Enter a valid phone number');
});

test('checkout advances only when the response contains the new invoice or job', async () => {
  for (const [kind, key] of [['order', 'invoice'], ['quote request', 'job']]) {
    const entity = { id: 42, totalCost: 100 };
    const result = await confirmCheckoutSubmission(
      async () => Response.json({ [key]: entity }, { status: 201 }),
      kind,
    );
    assert.deepEqual(result, { confirmed: true, entity });
    const incomplete = await confirmCheckoutSubmission(
      async () => Response.json({ [key]: {} }, { status: 201 }),
      kind,
    );
    assert.equal(incomplete.confirmed, false);
    assert.match(incomplete.message, /couldn't confirm/);
  }
});
