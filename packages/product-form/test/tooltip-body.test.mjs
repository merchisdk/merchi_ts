import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
let dom;
let root;
let activeObservers = new Map();
let invalidTargets = [];
let browserErrors = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const result = await build({
  entryPoints: [new URL('../src/components/TooltipElement.tsx', import.meta.url).pathname],
  bundle: true, format: 'cjs', platform: 'browser', jsx: 'automatic',
  external: ['react', 'react/*', 'react-tooltip', 'uuid'], write: false,
});
const mod = { exports: {} };
runInNewContext(result.outputFiles[0].text, {
  module: mod, exports: mod.exports, require,
  get document() { return dom?.window.document; },
  get MutationObserver() { return globalThis.MutationObserver; },
});
const TooltipElement = mod.exports.default;
const element = (props = {}) => React.createElement(TooltipElement, { id: 'help', tooltip: 'Helpful content', ...props }, 'Help anchor');

function setup({ body = true } = {}) {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  const { window } = dom;
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent']) globalThis[key] = key === 'window' ? window : window[key];
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  window.addEventListener('error', (event) => { browserErrors.push(event.error); event.preventDefault(); });
  const NativeObserver = window.MutationObserver;
  globalThis.MutationObserver = class extends NativeObserver {
    observe(target, options) {
      if (!(target instanceof window.Node)) invalidTargets.push(target);
      const value = super.observe(target, options);
      activeObservers.set(this, target);
      return value;
    }
    disconnect() { activeObservers.delete(this); super.disconnect(); }
  };
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!body) document.body.remove();
  const container = document.createElement('div');
  root = createRoot(container);
  return container;
}

async function flush(action = () => {}, delay = 0) {
  await act(async () => { action(); await new Promise((resolve) => setTimeout(resolve, delay)); });
}

afterEach(async () => {
  await flush(() => root?.unmount());
  root = undefined;
  assert.equal(activeObservers.size, 0, 'All dependency and body-availability observers must disconnect');
  dom?.window.close();
  dom = undefined;
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle', 'MutationObserver', 'ResizeObserver']) delete globalThis[key];
  invalidTargets = [];
  const errors = browserErrors;
  browserErrors = [];
  assert.deepEqual(errors, [], 'Browser event errors must not be silently ignored');
});

test('server output preserves the anchor without a browser document', () => {
  assert.match(renderToString(element()), /Help anchor/);
});

test('the real dependency never receives null when the body is initially absent', async () => {
  const container = setup({ body: false });
  await flush(() => root.render(element()));
  assert.match(container.textContent, /Help anchor/);
  assert.deepEqual(invalidTargets, []);
  const body = document.createElement('body');
  await flush(() => document.documentElement.append(body));
  assert.ok([...activeObservers.values()].includes(body), 'The real Tooltip must mount after body is available');
});

test('removal and restoration cleanly remount the real dependency', async () => {
  setup();
  await flush(() => root.render(element()));
  const oldBody = document.body;
  assert.ok([...activeObservers.values()].includes(oldBody));
  await flush(() => oldBody.remove());
  assert.ok(![...activeObservers.values()].includes(oldBody));
  await flush(() => root.render(element({ tooltip: 'Changed while body is missing' })));
  const body = document.createElement('body');
  await flush(() => document.documentElement.append(body));
  assert.ok([...activeObservers.values()].includes(body));
  assert.deepEqual(invalidTargets, []);
});

test('direct body replacement reconnects the dependency even with an explicit stable anchor ID', async () => {
  setup();
  await flush(() => root.render(element()));
  const oldBody = document.body;
  const body = document.createElement('body');
  await flush(() => oldBody.replaceWith(body));
  assert.ok(![...activeObservers.values()].includes(oldBody));
  assert.ok([...activeObservers.values()].includes(body));
  assert.deepEqual(invalidTargets, []);
});

test('StrictMode and repeated mount cycles disconnect every observer', async () => {
  setup();
  for (let i = 0; i < 3; i++) {
    await flush(() => root.render(React.createElement(React.StrictMode, null, element())));
    assert.ok([...activeObservers.values()].includes(document.body));
    await flush(() => root.render(null));
    assert.equal(activeObservers.size, 0);
  }
  assert.deepEqual(invalidTargets, []);
});


test('anchors without help text do not mount observers', async () => {
  const container = setup();
  await flush(() => root.render(element({ tooltip: undefined })));
  assert.equal(container.textContent, 'Help anchor');
  assert.equal(activeObservers.size, 0);
});

test('the real tooltip still opens on hover after the body returns', async () => {
  const container = setup({ body: false });
  await flush(() => root.render(element()));
  const body = document.createElement('body');
  body.append(container);
  await flush(() => document.documentElement.append(body));
  const anchor = document.getElementById('help');
  await flush(() => anchor.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })), 30);
  await flush(() => {}, 30);
  const tooltip = container.querySelector('.react-tooltip');
  assert.ok(tooltip, 'The actual react-tooltip UI must render');
  assert.match(tooltip.textContent, /Helpful content/);
  assert.deepEqual(invalidTargets, []);
});
