import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatQuotedUnitPrice } from '../src/components/currency.ts';
import { quotedGroupUnitPrice } from '../../product-form/src/utils/quotedGroupUnitPrice.ts';

const product = { currency: 'AUD', unitPrice: 0.52 };

test('confirmation keeps the quoted third decimal and a zero price', () => {
  assert.equal(formatQuotedUnitPrice(product, 0.52), '$0.52');
  assert.equal(formatQuotedUnitPrice(product, '0.412'), '$0.412');
  assert.equal(formatQuotedUnitPrice(product, 0), '$0.00');
  assert.equal(formatQuotedUnitPrice(product), '$0.52');
});

test('a single group uses the job quote even when options are present', () => {
  const group = { quantity: 150, groupCost: 76.8, variations: [{ cost: 15 }] };
  assert.equal(quotedGroupUnitPrice(group, { variationsGroups: [group], costPerUnit: 0.412 }, product), 0.412);
});

test('group rates exclude option charges and setup fees included in the server group total', () => {
  const groups = [
    { quantity: 149, groupCost: 86.48, variations: [{ cost: 4 }] },
    { quantity: 150, groupCost: 72.8, variations: [{ cost: 6 }] },
  ];
  const job = { variationsGroups: groups, costPerUnit: 0.466 };
  const withSetup = { ...product, setupPrice: 5, setupPerGroup: true };
  assert.deepEqual(groups.map(group => formatQuotedUnitPrice(withSetup,
    quotedGroupUnitPrice(group, job, withSetup))), ['$0.52', '$0.412']);
  assert.equal(quotedGroupUnitPrice({ ...groups[0], variations: [{}] }, job, withSetup), undefined);
});
