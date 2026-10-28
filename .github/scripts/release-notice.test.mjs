import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseNotice } from './release-notice.mjs';

const item = { name: '@merchi/cart', version: '1.4.58' };
const head = 'a'.repeat(40);

test('records exact package availability without inventing fixed issues', () => {
  const notice = releaseNotice(item, head);
  assert.equal(notice.upstream, 'merchisdk/merchi_ts');
  assert.equal(notice.commit_sha, head);
  assert.equal(notice.version, item.version);
  assert.equal(notice.availability_url, 'https://www.npmjs.com/package/@merchi/cart/v/1.4.58');
  assert.deepEqual(notice.fixed_issues, []);
  assert.deepEqual(releaseNotice(item, head), notice);
});

test('uses only explicitly recorded upstream issue evidence', () => {
  assert.deepEqual(releaseNotice(item, head, { '@merchi/cart': { fixed_issues: [63, 63, 62] } }).fixed_issues, [62, 63]);
  assert.throws(() => releaseNotice(item, head, { '@merchi/cart': { fixed_issues: [true] } }));
  assert.throws(() => releaseNotice(item, 'main'));
  assert.throws(() => releaseNotice({ ...item, version: '^1.4.58' }, head));
});

test('does not submit unmapped components to the release ingress', () => {
  assert.equal(releaseNotice({ name: '@merchi/unknown', version: '1.0.0' }, head), null);
});
