import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const reporter = '@merchi/error-catch';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.MERCHI_NPM_CLI || 'npm';
const installFlags = ['--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund'];
const expectedOperations = ['cart.update', 'checkout.submit'];

function installFixture(cwd, dependencies) {
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({
    name: 'storefront-reporter-fixture',
    private: true,
    dependencies: { ...dependencies, esbuild: '0.28.2' },
  }));
  execFileSync(npm, ['install', '--package-lock-only', ...installFlags], { cwd, stdio: 'inherit' });
  execFileSync(npm, ['ci', ...installFlags], { cwd, stdio: 'inherit' });
}

function latestPublished(range) {
  const output = execFileSync(npm, ['view', range, 'version', '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  const versions = (Array.isArray(parsed) ? parsed : [parsed]).filter(version => typeof version === 'string');
  versions.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const version = versions.at(-1);
  if (!version) throw new Error(`No published version for ${range}`);
  return version;
}

function pack(cwd, destination, specifier) {
  const args = ['pack', '--ignore-scripts', '--json', '--pack-destination', destination];
  if (specifier) args.push(specifier);
  const [archive] = JSON.parse(execFileSync(npm, args, { cwd, encoding: 'utf8' }));
  return archive.filename;
}

async function captureOperations(directory) {
  const { build } = createRequire(join(directory, 'package.json'))('esbuild');
  const result = await build({
    stdin: {
      contents: `
        import { configureFrontendErrors } from '@merchi/error-catch';
        import { reportCartFailure } from '@merchi/cart/esm/utilities/reportFailure.js';
        import { reportCheckoutFailure } from '@merchi/checkout/lib/reportFailure.js';
        configureFrontendErrors({
          endpoint: 'https://collector.example/frontend-errors',
          application: 'storefront-fixture',
          enabled: true,
          transport: (_endpoint, event) => operations.push(event.operation.name),
        });
        reportCartFailure(new Error('Cart fixture failed'), 'cart.update');
        reportCheckoutFailure({ message: 'Checkout fixture failed' }, 500);
      `,
      resolveDir: directory,
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
  });
  const operations = [];
  runInNewContext(result.outputFiles[0].text, { operations, Error, URL });
  return operations;
}

async function verifyHistoricalUpgrade(directory) {
  const vendor = join(directory, 'vendor');
  mkdirSync(vendor);
  const archive = pack(directory, vendor, `${reporter}@0.1.12`);
  // The exact Cart, Checkout and reporter versions from storefront PR #234.
  const upgrade = { '@merchi/cart': '1.4.80', '@merchi/checkout': '1.3.59' };
  const vendorReference = `file:vendor/${archive}`;
  installFixture(directory, { ...upgrade, [reporter]: vendorReference });
  const { packages } = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(packages[`node_modules/${reporter}`].resolved, vendorReference);
  for (const consumer of Object.keys(upgrade)) {
    assert.ok(packages[`node_modules/${consumer}/node_modules/${reporter}`],
      `Expected a private reporter under ${consumer} in the broken upgrade`);
  }
  assert.deepEqual(await captureOperations(directory), [], 'The split install should reproduce #234');

  // Cart and Checkout depend on ^0.1.13. A storefront pinned to the original
  // 0.1.13 now resolves those packages to a newer release, so they stop sharing
  // the configured reporter. Align to the version that range actually installs.
  const alignedReporter = latestPublished(`${reporter}@^0.1.13`);
  installFixture(directory, { ...upgrade, [reporter]: alignedReporter });
  assert.deepEqual(await captureOperations(directory), expectedOperations,
    'Cart and Checkout must share the configured storefront reporter after alignment');
}

async function verifyCandidate(directory) {
  installFixture(directory, {});
  for (const [name, source] of [
    [reporter, 'error-catch-sdk'],
    ['@merchi/cart', 'cart'],
    ['@merchi/checkout', 'checkout'],
  ]) {
    const archive = pack(join(root, 'packages', source), directory);
    const target = join(directory, 'node_modules', name);
    mkdirSync(target, { recursive: true });
    execFileSync('tar', ['-xf', join(directory, archive), '--strip-components=1', '-C', target]);
  }
  assert.deepEqual(await captureOperations(directory), expectedOperations,
    'The built Cart and Checkout packages must both report through the built host reporter');
}

const fixture = mkdtempSync(join(tmpdir(), 'merchi-storefront-reporter-'));
try {
  if (process.argv.includes('--candidate')) await verifyCandidate(fixture);
  else await verifyHistoricalUpgrade(fixture);
  console.log('Storefront error reporter verification passed');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
