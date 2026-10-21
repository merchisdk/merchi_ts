import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../packages/product-form/package.json', import.meta.url));
const ts = require('typescript');

function loadSource(path, storageDescriptor) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });
  const context = { exports: {} };
  if (storageDescriptor) Object.defineProperty(context, 'localStorage', storageDescriptor);
  vm.runInNewContext(outputText, context);
  return context.exports;
}

for (const [name, path, readName] of [
  ['product form', '../packages/product-form/src/utils/merchiSource.ts', 'getMerchiSourceJobTags'],
  ['checkout', '../packages/checkout/src/merchi_source.ts', 'getMerchiSourceJobTagEntities'],
]) {
  for (const [scenario, storageDescriptor] of [
    ['server rendering', undefined],
    ['null storage', { value: null }],
    ['blocked storage getter', { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }],
    ['blocked storage read', { value: { getItem() { throw new DOMException('The operation is insecure.', 'SecurityError'); } } }],
  ]) {
    test(`${name} remains usable with ${scenario}`, () => {
      const api = loadSource(path, storageDescriptor);
      assert.equal(JSON.stringify(api[readName]()), '[]');
      if (api.clearMerchiSource) assert.doesNotThrow(() => api.clearMerchiSource());
    });
  }

  test(`${name} preserves valid source tags and ignores malformed entries`, () => {
    const api = loadSource(path, { value: { getItem(key) {
      assert.equal(key, 'merchi_source');
      return ' 12,invalid,34,, -5,6.7 ';
    } } });
    assert.equal(JSON.stringify(api[readName]()), '[{"id":12},{"id":34}]');
  });

  test(`${name} handles missing attribution`, () => {
    const api = loadSource(path, { value: { getItem: () => null } });
    assert.equal(JSON.stringify(api[readName]()), '[]');
  });
}

test('checkout clears only source attribution when storage is available', () => {
  const removed = [];
  const api = loadSource('../packages/checkout/src/merchi_source.ts', {
    value: { removeItem: key => removed.push(key) },
  });
  api.clearMerchiSource();
  assert.deepEqual(removed, ['merchi_source']);
});

test('checkout completion tolerates blocked storage writes', () => {
  const api = loadSource('../packages/checkout/src/merchi_source.ts', {
    value: { removeItem() { throw new DOMException('Storage denied', 'SecurityError'); } },
  });
  assert.doesNotThrow(() => api.clearMerchiSource());
});
