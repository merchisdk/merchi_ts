import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

const require = createRequire(import.meta.url);
const sourcePath = process.env.DRAFT_CTA_SOURCE || fileURLToPath(new URL('../src/components/drafts/ProductDraftsHost.tsx', import.meta.url));
const result = await build({
  stdin: {
    contents: `export { ProductDraftsCta } from ${JSON.stringify(sourcePath)}; export { FixtureContext } from 'fixture-context';`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic',
  packages: 'external', loader: { '.png': 'dataurl' }, write: false,
  plugins: [{
    name: 'isolated-form-context',
    setup(builder) {
      builder.onResolve({ filter: /(?:MerchiProductFormProvider|^fixture-context)$/ }, () => ({ path: 'context', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: `import React from 'react'; export const FixtureContext = React.createContext({}); export const useMerchiFormContext = () => React.useContext(FixtureContext);`,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
      }));
      // These closed editors/upload controls are outside the CTA hydration contract.
      // Keep the real CTA, template selection, saved-draft validation and storage helpers.
      builder.onResolve({ filter: /\/(DraftApprovePanel|DraftDesignerSheet|DropzoneInput)$/ }, args => ({ path: args.path, namespace: 'closed-ui' }));
      builder.onLoad({ filter: /.*/, namespace: 'closed-ui' }, () => ({ contents: 'export default function ClosedUI() { return null; }' }));
    },
  }],
});
const mod = { exports: {} };
runInThisContext(`(function (module, exports, require) {${result.outputFiles[0].text}\n})`)(mod, mod.exports, require);
const { ProductDraftsCta, FixtureContext } = mod.exports;

const product = {
  id: 44, name: 'Custom wristband', needsDrafting: true, allowClientDraftContribution: true,
  draftTemplates: [{ id: 1, name: 'Front', width: 100, height: 20 }],
};
const saved = [{ productId: 44, groupIndex: 0, templateData: [{ templateId: 1, draft: 'data:a', canvasPreview: 'data:b' }] }];

async function fixture(t, { storage, strict = false, currentProduct = product, formValues = {}, artworkPath } = {}) {
  let opened = 0;
  const context = {
    apiUrl: 'https://api.example.test/v6/', product: currentProduct, job: {},
    hookForm: { watch: () => formValues }, setJob() {},
    setIsDraftDesignerOpen(value) { if (value) opened += 1; },
  };
  const render = () => {
    const node = React.createElement(FixtureContext.Provider, { value: { ...context } }, React.createElement(ProductDraftsCta));
    return strict ? React.createElement(React.StrictMode, null, node) : node;
  };
  const html = renderToString(render());
  assert.ok(!html.includes('Draft saved'), 'SSR cannot access browser-saved artwork');
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, {
    pretendToBeVisual: true, url: 'https://store.example.test/',
  });
  const restore = [];
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
    restore.push(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  if (storage !== undefined) window.localStorage.setItem('productDraftTemplate-44', storage);
  if (artworkPath) window.localStorage.setItem('productArtworkPath-44', artworkPath);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const errors = [], messages = [];
  const savedError = console.error, savedWarn = console.warn;
  console.error = (...args) => messages.push(args.map(String).join(' '));
  console.warn = (...args) => messages.push(args.map(String).join(' '));
  const container = document.getElementById('root');
  const serverNode = container.firstElementChild;
  let root;
  t.after(async () => {
    try { if (root) await React.act(async () => root.unmount()); }
    finally {
      console.error = savedError; console.warn = savedWarn;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
      for (const cleanup of restore.reverse()) cleanup();
      dom.window.close();
    }
  });
  await React.act(async () => {
    root = hydrateRoot(container, render(), {
      onRecoverableError: error => errors.push(error.message),
      onUncaughtError: error => errors.push(error.message),
    });
  });
  assert.deepEqual(errors, [], 'Hydration must not recover by replacing the server tree');
  assert.deepEqual(messages, [], 'Hydration must not emit mismatched-attribute warnings');
  assert.equal(container.firstElementChild, serverNode, 'Hydration must preserve the server node');
  return {
    container, context, errors, messages,
    opened: () => opened,
    update: async () => React.act(async () => root.render(render())),
    click: async label => {
      const button = [...container.querySelectorAll('button')].find(node => node.textContent.trim() === label);
      assert.ok(button, `Missing button: ${label}`);
      await React.act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    },
  };
}

for (const [name, storage] of [
  ['absent', undefined], ['empty', '[]'], ['malformed', '{bad'], ['non-array', '{}'],
  ['incomplete', JSON.stringify([{ productId: 44, groupIndex: 0, templateData: [{ templateId: 1, draft: 'data:a' }] }])],
]) {
  test(`${name} saved artwork hydrates without a saved status`, async t => {
    const f = await fixture(t, { storage });
    assert.ok(!f.container.textContent.includes('Draft saved'));
  });
}

test('completed saved artwork appears only after hydration and preserves SSR nodes', async t => {
  const f = await fixture(t, { storage: JSON.stringify(saved) });
  assert.ok(f.container.textContent.includes('Draft saved'));
  assert.equal(window.localStorage.getItem('productDraftTemplate-44'), JSON.stringify(saved));
});

test('StrictMode hydrates completed artwork without resetting or deleting it', async t => {
  const f = await fixture(t, { storage: JSON.stringify(saved), strict: true });
  assert.ok(f.container.textContent.includes('Draft saved'));
  await f.update();
  assert.ok(f.container.textContent.includes('Draft saved'));
  assert.deepEqual(f.errors, []);
});

test('grouped artwork reports completed groups after hydration', async t => {
  const f = await fixture(t, {
    storage: JSON.stringify(saved),
    currentProduct: { ...product, groupVariationFields: [{ id: 9 }] },
    formValues: { variationsGroups: [{ variations: [] }, { variations: [] }] },
  });
  assert.ok(f.container.textContent.includes('1 of 2 groups saved'));
});

test('a stored design-service choice restores after hydration and saved artwork remains available', async t => {
  const f = await fixture(t, { storage: JSON.stringify(saved), artworkPath: 'service' });
  assert.equal(f.container.querySelector('button[aria-selected="true"]').textContent, 'Free design service');
  await f.click('Design myself');
  assert.ok(f.container.textContent.includes('Draft saved'));
});

test('saved artwork changes are reflected on subsequent form renders', async t => {
  const f = await fixture(t);
  window.localStorage.setItem('productDraftTemplate-44', JSON.stringify(saved));
  await f.update();
  assert.ok(f.container.textContent.includes('Draft saved'));
  window.localStorage.removeItem('productDraftTemplate-44');
  await f.update();
  assert.ok(!f.container.textContent.includes('Draft saved'));
  assert.deepEqual(f.errors, []);
});

test('cancelled start-again keeps artwork; confirmed start-again clears it and opens the designer', async t => {
  const f = await fixture(t, { storage: JSON.stringify(saved) });
  window.confirm = () => false;
  await f.click('Start again');
  assert.ok(f.container.textContent.includes('Draft saved'));
  assert.equal(f.opened(), 0);
  window.confirm = () => true;
  await f.click('Start again');
  assert.ok(!f.container.textContent.includes('Draft saved'));
  assert.equal(window.localStorage.getItem('productDraftTemplate-44'), null);
  assert.equal(f.opened(), 1);
});
