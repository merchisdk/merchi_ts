import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materializeWorkspaceDependencies, publishRelease } from './publish-release.mjs';

const item = {
  name: 'consumer',
  version: '1.0.1',
  expectedLatest: '1.0.0',
  expectedLatestHead: 'old',
};

function fixture({ existing = null, latest = { version: '1.0.0', gitHead: 'old' }, status = 0, delay = 0, owner = 'ours' } = {}) {
  let publishes = 0;
  let reads = 0;
  let waits = 0;
  let waitedMs = 0;
  return {
    get publishes() { return publishes; },
    get reads() { return reads; },
    get waits() { return waits; },
    get waitedMs() { return waitedMs; },
    exactOrNull: async () => existing,
    latestOrNull: async () => latest,
    publish: () => { publishes += 1; return status; },
    exact: async () => {
      if (reads++ < delay) throw new Error('Registry not ready');
      return { version: item.version, gitHead: owner };
    },
    wait: async milliseconds => { waits += 1; waitedMs += milliseconds; },
  };
}

test('materializes workspace ranges using planned dependency versions', () => {
  const manifest = {
    dependencies: { sdk: 'workspace:^', exact: 'workspace:*', external: '^3.0.0' },
  };
  assert.deepEqual(materializeWorkspaceDependencies(manifest, { sdk: '2.1.0', exact: '4.0.0' }).dependencies, {
    sdk: '^2.1.0',
    exact: '4.0.0',
    external: '^3.0.0',
  });
});

test('refuses an occupied version from another commit', async () => {
  const io = fixture({ existing: { version: item.version, gitHead: 'other' } });
  await assert.rejects(publishRelease(item, 'ours', io), /another source commit/);
  assert.equal(io.publishes, 0);
});

test('recovers a version already published by this release commit', async () => {
  const io = fixture({ existing: { version: item.version, gitHead: 'ours' } });
  assert.deepEqual(await publishRelease(item, 'ours', io), { published: false, recovered: true });
  assert.equal(io.publishes, 0);
});

test('refuses when npm latest changed after planning', async () => {
  const io = fixture({ latest: { version: '1.0.2', gitHead: 'other' } });
  await assert.rejects(publishRelease(item, 'ours', io), /changed after release planning/);
  assert.equal(io.publishes, 0);
});

test('publishes once and verifies the exact version', async () => {
  const io = fixture();
  assert.deepEqual(await publishRelease(item, 'ours', io), { published: true, recovered: false });
  assert.equal(io.publishes, 1);
});

test('waits through delayed npm visibility without republishing', async () => {
  const io = fixture({ delay: 3 });
  await publishRelease(item, 'ours', io);
  assert.equal(io.publishes, 1);
  assert.equal(io.waits, 3);
  assert.equal(io.waitedMs, 15000);
});

test('allows the full five-minute npm propagation window', async () => {
  const io = fixture({ delay: 60 });
  await publishRelease(item, 'ours', io);
  assert.equal(io.publishes, 1);
  assert.equal(io.waitedMs, 300000);
});

test('bounds persistent registry failure and never republishes', async () => {
  const io = fixture({ delay: 99 });
  await assert.rejects(publishRelease(item, 'ours', io), /Could not verify/);
  assert.equal(io.publishes, 1);
  assert.equal(io.reads, 61);
  assert.equal(io.waitedMs, 300000);
});
