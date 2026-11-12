import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React from 'react';

const require = createRequire(import.meta.url);
const bundle = await build({
  stdin: {
    contents: `
      export { default as FormLead } from './src/components/FormLead';
      export { VariationInputTextarea } from './src/components/VariationInput';
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'cjs',
  jsx: 'automatic',
  platform: 'browser',
  external: ['react', 'react/*', 'react-hook-form', '@hcaptcha/react-hcaptcha'],
  plugins: [{
    name: 'contact-form-fixture-boundaries',
    setup(build) {
      build.onResolve({ filter: /MerchiProductFormProvider$/ }, () => ({ path: 'lead-context', external: true }));
      build.onResolve({ filter: /^\.\/Variations$/ }, () => ({ path: 'lead-variations', external: true }));
      build.onResolve({ filter: /^\.\/VariationLabel$/ }, () => ({ path: 'lead-variation-label', external: true }));
      build.onResolve({ filter: /actions\/leads$/ }, () => ({ path: 'lead-transport', external: true }));
    },
  }],
  write: false,
});

async function mount(t, defaultValues) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.example.test/contact' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const restore = Object.entries(globals).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    return () => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
  });
  const { createRoot } = require('react-dom/client');
  const { useForm } = require('react-hook-form');
  const container = document.getElementById('root');
  const root = createRoot(container);
  const requests = [];
  t.mock.method(console, 'error', () => {});
  let hookForm;
  const mod = { exports: {} };
  runInThisContext(`(function (module, exports, require) {${bundle.outputFiles[0].text}\n})`)(
    mod,
    mod.exports,
    name => {
      if (name === 'lead-context') return {
        useMerchiFormContext: () => ({
          hookForm,
          control: hookForm.control,
          product: { independentVariationFields: [{}] },
        }),
      };
      if (name === 'lead-variations') return () => React.createElement(mod.exports.VariationInputTextarea, {
        name: 'variations[0]',
        variation: { variationField: { name: 'Message', required: true } },
      });
      if (name === 'lead-variation-label') return () => null;
      if (name === 'lead-transport') return {
        async submitLead(payload) {
          requests.push(structuredClone(payload));
          if (requests.length === 1) throw Object.assign(new Error('Invalid submission'), {
            statusCode: 400,
            errorCode: 227,
          });
        },
      };
      return require(name);
    },
  );
  function Fixture() {
    hookForm = useForm({ defaultValues, shouldFocusError: false });
    return React.createElement(mod.exports.FormLead, {
      contactFallback: { phone: '(03) 9000 0000', email: 'sales@example.test' },
    });
  }
  t.after(async () => {
    try {
      await React.act(async () => root.unmount());
    } finally {
      for (const cleanup of restore.reverse()) cleanup();
      dom.window.close();
    }
  });
  await React.act(async () => root.render(React.createElement(Fixture)));
  const submit = async () => React.act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  return { container, submit, requests };
}

test('shows contact and message field errors before sending a request', async t => {
  const form = await mount(t, {
    client: { name: ' ', emailAddresses: [{ emailAddress: 'incorrect' }], phoneNumbers: [{ number: 'oops' }] },
    variations: [{ value: '' }],
  });
  await form.submit();
  assert.deepEqual(form.requests, []);
  for (const [selector, message] of [
    ['input[autocomplete="name"]', 'Enter your name.'],
    ['input[type="email"]', 'Enter a valid email address.'],
    ['input[type="tel"]', 'Enter a valid phone number or leave it blank.'],
    ['textarea', 'Message is required'],
  ]) {
    const field = form.container.querySelector(selector);
    assert.equal(field.getAttribute('aria-invalid'), 'true');
    assert.equal(document.getElementById(field.getAttribute('aria-describedby')).textContent, message);
  }
});

test('keeps the message on rejection and offers working contact links before retry', async t => {
  const message = 'Please quote wristbands for an event.';
  const form = await mount(t, {
    client: { name: 'Test Customer', emailAddresses: [{ emailAddress: 'customer@example.test' }], phoneNumbers: [{ number: '' }] },
    variations: [{ value: message }],
  });
  await form.submit();
  const alert = form.container.querySelector('[role="alert"]');
  assert.match(alert.textContent, /Check your contact details/);
  assert.ok(alert.querySelector('a[href="tel:0390000000"]'));
  assert.ok(alert.querySelector('a[href="mailto:sales@example.test"]'));
  assert.equal(form.container.querySelector('textarea').value, message);
  assert.equal(form.container.querySelector('input[type="email"]').value, 'customer@example.test');
  await form.submit();
  assert.equal(form.requests.length, 2);
  assert.deepEqual(form.requests[0], form.requests[1]);
  assert.equal(form.requests[1].variations[0].value, message);
  assert.match(form.container.textContent, /Thank you/);
});
