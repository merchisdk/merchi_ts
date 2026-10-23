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
const sourcePath = process.env.TOOLTIP_SOURCE || fileURLToPath(new URL('../src/components/TooltipElement.tsx', import.meta.url));
const result = await build({
  entryPoints: [sourcePath],
  bundle: true, format: 'cjs', platform: 'browser', jsx: 'automatic',
  external: ['react', 'react/*', 'react-tooltip', 'uuid'], write: false,
});
const mod = { exports: {} };
runInThisContext(`(function (module, exports, require) {${result.outputFiles[0].text}\n})`)(mod, mod.exports, require);
const TooltipElement = mod.exports.default;

async function hydratedFixture(t, render) {
  const html = renderToString(render(0));
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, {
    pretendToBeVisual: true,
  });
  const restore = [];
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'Event', 'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    const value = ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key)
      ? dom.window[key].bind(dom.window) : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restore.push(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const messages = [];
  const errors = [];
  const savedError = console.error;
  const savedWarn = console.warn;
  console.error = (...args) => messages.push(args.map(String).join(' '));
  console.warn = (...args) => messages.push(args.map(String).join(' '));
  const container = document.getElementById('root');
  const serverAnchors = [...container.querySelectorAll('span[role="tooltip"]')];
  const serverIds = serverAnchors.map(anchor => anchor.id);
  const queries = [];
  const originalQueryAll = document.querySelectorAll.bind(document);
  document.querySelectorAll = selector => {
    const result = originalQueryAll(selector);
    if (selector.startsWith('#')) queries.push({ selector, matches: result.length });
    return result;
  };
  let root;
  t.after(async () => {
    try {
      if (root) await React.act(async () => root.unmount());
    } finally {
      console.error = savedError;
      console.warn = savedWarn;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      for (const cleanup of restore.reverse()) cleanup();
      dom.window.close();
    }
  });
  await React.act(async () => {
    root = hydrateRoot(container, render(0), {
      onRecoverableError: error => errors.push(error.message),
      onUncaughtError: error => errors.push(error.message),
    });
  });
  return {
    container, serverAnchors, serverIds, queries, messages, errors,
    update: async value => React.act(async () => root.render(render(value))),
  };
}

function anchor(label, props = {}) {
  return React.createElement(TooltipElement, { tooltip: 'More information', ...props },
    React.createElement('button', null, label));
}

test('generated tooltip ID hydrates without mismatch and attaches the real tooltip to its server anchor', async t => {
  const fixture = await hydratedFixture(t, value => anchor(`Content ${value}`));
  const { container, serverAnchors, serverIds, queries, errors, messages } = fixture;
  assert.equal(container.querySelector('span'), serverAnchors[0], 'hydration must preserve the server node');
  assert.deepEqual(errors, []);
  assert.deepEqual(messages, [], 'hydration must not produce an attribute mismatch');
  assert.ok(queries.length > 0, 'react-tooltip must query its anchor');
  assert.ok(queries.every(query => query.matches === 1), 'each tooltip selector must match the server anchor');
  await fixture.update(1);
  assert.equal(container.querySelector('span').id, serverIds[0], 'parent updates must not change the anchor ID');
  assert.equal(container.querySelector('button').textContent, 'Content 1');
});

test('generated IDs are unique for sibling tooltips and remain stable on parent updates', async t => {
  const fixture = await hydratedFixture(t, value => React.createElement(React.Fragment, null,
    anchor(`First ${value}`, { key: 'first' }), anchor(`Second ${value}`, { key: 'second' })));
  assert.equal(new Set(fixture.serverIds).size, 2);
  assert.ok(fixture.serverIds.every(id => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)), 'generated IDs must work as CSS ID selectors');
  assert.deepEqual(fixture.errors, []);
  assert.deepEqual(fixture.messages, []);
  await fixture.update(1);
  assert.deepEqual([...fixture.container.querySelectorAll('span[role="tooltip"]')].map(el => el.id), fixture.serverIds);
});

test('explicit tooltip IDs remain authoritative and can update', async t => {
  const fixture = await hydratedFixture(t, value => anchor('Explicit anchor', { id: value ? 'custom-anchor-next' : 'custom-anchor' }));
  assert.deepEqual(fixture.serverIds, ['custom-anchor']);
  assert.deepEqual(fixture.errors, []);
  assert.deepEqual(fixture.messages, []);
  await fixture.update(1);
  assert.equal(fixture.container.querySelector('span').id, 'custom-anchor-next');
  assert.ok(fixture.queries.some(query => query.selector === '#custom-anchor-next' && query.matches === 1));
});

test('anchors without tooltip text also keep stable IDs across hydration and updates', async t => {
  const fixture = await hydratedFixture(t, value => anchor(`Content ${value}`, { tooltip: undefined }));
  assert.deepEqual(fixture.errors, []);
  assert.deepEqual(fixture.messages, []);
  assert.deepEqual(fixture.queries, []);
  await fixture.update(1);
  assert.equal(fixture.container.querySelector('span').id, fixture.serverIds[0]);
});
