import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materializeWorkspaceDependencies, publishPlannedReleases, publishRelease } from './publish-release.mjs';

const item = {
  name: 'consumer',
  version: '1.0.1',
  expectedLatest: '1.0.0',
  expectedLatestHead: 'old',
};

function fixture({
  existing = null,
  latest = { version: '1.0.0', gitHead: 'old' },
  status = 0,
  delay = 0,
  owner = 'ours',
  visibleVersion = item.version,
} = {}) {
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
      return { version: visibleVersion, gitHead: owner };
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

test('returns unverified when a successful publish stays invisible and never republishes', async () => {
  const io = fixture({ delay: 99 });
  assert.deepEqual(await publishRelease(item, 'ours', io), {
    published: true,
    recovered: false,
    unverified: true,
  });
  assert.equal(io.publishes, 1);
  assert.equal(io.reads, 61);
  assert.equal(io.waitedMs, 300000);
});

test('a non-zero npm publish exit that stays invisible is still a hard error', async () => {
  const io = fixture({ status: 1, delay: 99 });
  await assert.rejects(
    publishRelease(item, 'ours', io),
    error => {
      assert.match(error.message, /Could not verify consumer@1\.0\.1 after publication \(exit 1\)/);
      assert.match(error.cause.message, /Registry not ready/);
      return true;
    },
  );
  assert.equal(io.publishes, 1);
  assert.equal(io.reads, 61);
  assert.equal(io.waitedMs, 300000);
});

test('a registry version from another commit is still a hard error', async () => {
  const io = fixture({ owner: 'other' });
  await assert.rejects(publishRelease(item, 'ours', io), /published from another source commit/);
  assert.equal(io.publishes, 1);
});

test('an unexpected registry version is still a hard error', async () => {
  const io = fixture({ visibleVersion: '9.9.9' });
  await assert.rejects(publishRelease(item, 'ours', io), /unexpected version/);
  assert.equal(io.publishes, 1);
});

test('reconciles a non-zero publish once the registry shows this commit', async () => {
  const io = fixture({ status: 1 });
  assert.deepEqual(await publishRelease(item, 'ours', io), { published: false, recovered: true });
  assert.equal(io.publishes, 1);
});

const sdk = {
  mode: 'publish',
  name: '@merchi/sdk',
  version: '2.0.1',
  expectedLatest: '2.0.0',
  expectedLatestHead: 'old',
};
const cart = {
  mode: 'publish',
  name: '@merchi/cart',
  version: '1.4.1',
  expectedLatest: '1.4.0',
  expectedLatestHead: 'old',
};
const versions = { '@merchi/sdk': '2.0.1', '@merchi/cart': '1.4.1' };

function queueIo(spec) {
  let reads = 0;
  return {
    exactOrNull: async () => spec.existing ?? null,
    latestOrNull: async () => spec.latest ?? { version: spec.item.expectedLatest, gitHead: spec.item.expectedLatestHead },
    exact: async () => {
      if (reads++ < (spec.delay ?? 0)) throw new Error('Registry version is not visible yet.');
      return {
        version: spec.visibleVersion ?? spec.item.version,
        gitHead: spec.owner === undefined ? 'ours' : spec.owner,
      };
    },
    wait: async () => {},
  };
}

test('emits the unverified-publish warning on stdout', async () => {
  const lines = [];
  const original = console.log;
  console.log = line => lines.push(line);
  try {
    await publishPlannedReleases([sdk], 'ours', versions, {
      ioFor: item => queueIo({ item, delay: 99 }),
      publishPackage() { return 0; },
      recordTag() { throw new Error('should not tag'); },
    });
  } finally {
    console.log = original;
  }
  assert.deepEqual(lines, [
    '::warning::Could not verify @merchi/sdk@2.0.1 after publication (exit 0); next run will reconcile it.',
  ]);
});

test('reports only registry-verified and tagged packages, preserving partial success', async () => {
  const reported = [];
  const tagged = [];
  await assert.rejects(() => publishPlannedReleases([sdk, cart], 'ours', versions, {
    ioFor: item => queueIo({ item, delay: item.name === cart.name ? 99 : 0 }),
    publishPackage: item => item.name === cart.name ? 1 : 0,
    recordTag: item => tagged.push(item.name),
    onVerified: item => reported.push(item.name),
    log() {},
  }));
  assert.deepEqual(tagged, [sdk.name]);
  assert.deepEqual(reported, [sdk.name]);
});

test('never reports an unverified publication or failed source tag', async () => {
  const reported = [];
  const options = {
    ioFor: item => queueIo({ item, delay: 99 }),
    publishPackage: () => 0,
    recordTag() { throw new Error('must not tag'); },
    onVerified: item => reported.push(item.name),
    log() {},
  };
  await publishPlannedReleases([sdk], 'ours', versions, options);
  assert.deepEqual(reported, []);
  await assert.rejects(() => publishPlannedReleases([sdk], 'ours', versions, {
    ...options, ioFor: item => queueIo({ item }),
    recordTag() { throw new Error('tag push failed'); },
  }), /tag push failed/);
  assert.deepEqual(reported, []);
});

test('continues dependents after an unverified publish and leaves it untagged', async () => {
  const published = [];
  const tagged = [];
  const lines = [];
  let cartDependency;
  await publishPlannedReleases([sdk, cart], 'ours', versions, {
    ioFor: item => queueIo({
      item,
      delay: item.name === '@merchi/sdk' ? 99 : 0,
    }),
    publishPackage(item, receivedVersions) {
      published.push(item.name);
      if (item.name === '@merchi/cart') {
        cartDependency = materializeWorkspaceDependencies(
          { dependencies: { '@merchi/sdk': 'workspace:^' } },
          receivedVersions,
        ).dependencies['@merchi/sdk'];
      }
      return 0;
    },
    recordTag: item => tagged.push(`${item.name}@${item.version}`),
    log: line => lines.push(line),
  });
  assert.deepEqual(published, ['@merchi/sdk', '@merchi/cart']);
  assert.equal(cartDependency, '^2.0.1');
  assert.deepEqual(tagged, ['@merchi/cart@1.4.1']);
  assert.deepEqual(lines, [
    '::warning::Could not verify @merchi/sdk@2.0.1 after publication (exit 0); next run will reconcile it.',
    '@merchi/cart@1.4.1: published.',
  ]);
});

test('a failed publish still stops later packages', async () => {
  const published = [];
  await assert.rejects(
    () => publishPlannedReleases([sdk, cart], 'ours', versions, {
      ioFor: item => queueIo({ item, delay: 99 }),
      publishPackage(item) {
        published.push(item.name);
        return item.name === '@merchi/sdk' ? 1 : 0;
      },
      recordTag() {},
      log() {},
    }),
    /Could not verify @merchi\/sdk@2\.0\.1 after publication \(exit 1\)/,
  );
  assert.deepEqual(published, ['@merchi/sdk']);
});

test('a conflicting registry version still stops later packages', async () => {
  const published = [];
  const tagged = [];
  await assert.rejects(
    () => publishPlannedReleases([sdk, cart], 'ours', versions, {
      ioFor: item => queueIo({ item, owner: item.name === '@merchi/sdk' ? 'other' : 'ours' }),
      publishPackage(item) {
        published.push(item.name);
        return 0;
      },
      recordTag: item => tagged.push(item.name),
      log() {},
    }),
    /published from another source commit/,
  );
  assert.deepEqual(published, ['@merchi/sdk']);
  assert.deepEqual(tagged, []);
});

test('records a tag for a version already visible from this commit', async () => {
  const tagged = [];
  await publishPlannedReleases([
    { mode: 'tag', name: '@merchi/sdk', version: '2.0.1' },
  ], 'ours', versions, {
    ioFor: item => queueIo({ item, existing: { version: item.version, gitHead: 'ours' } }),
    publishPackage() {
      throw new Error('tag recovery must not publish');
    },
    recordTag: item => tagged.push(`${item.name}@${item.version}`),
    log() {},
  });
  assert.deepEqual(tagged, ['@merchi/sdk@2.0.1']);
});

test('refuses to tag a version published from another commit', async () => {
  await assert.rejects(
    () => publishPlannedReleases([
      { mode: 'tag', name: '@merchi/sdk', version: '2.0.1' },
    ], 'ours', versions, {
      ioFor: item => queueIo({ item, existing: { version: item.version, gitHead: 'other' } }),
      publishPackage() {
        throw new Error('tag recovery must not publish');
      },
      recordTag() {
        throw new Error('should not tag');
      },
      log() {},
    }),
    /cannot recover tag without matching npm gitHead/,
  );
});

test('the next run reconciles an unverified publication without republishing', async () => {
  let visible = false;
  const published = [];
  const tagged = [];
  const release = () => publishPlannedReleases([sdk], 'ours', versions, {
    ioFor: item => queueIo({
      item,
      delay: visible ? 0 : 99,
      existing: visible ? { version: item.version, gitHead: 'ours' } : null,
    }),
    publishPackage(item) {
      published.push(item.name);
      return 0;
    },
    recordTag: item => tagged.push(`${item.name}@${item.version}`),
    log() {},
  });
  await release();
  visible = true;
  await release();
  assert.deepEqual(published, ['@merchi/sdk']);
  assert.deepEqual(tagged, ['@merchi/sdk@2.0.1']);
});
