import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StripeCardForm from './StripeCardForm';

vi.mock('./LegacyStripeCardForm', () => ({
  default: ({ testKey }: { testKey: string }) => <span>Card form {testKey}</span>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  ['pk_test_example', true],
  ['pk_live_example', false],
  ['', false],
])('only mounts the test invoice card form with a test key (%s)', async (key, available) => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key }) });
  vi.stubGlobal('fetch', fetch);
  render(<StripeCardForm urlApi="https://example.test/v6/" invoice={{ id: 9, isTest: true }} />);
  if (available) {
    expect(await screen.findByText('Card form pk_test_example')).toBeTruthy();
    expect(screen.getByText(/4242 4242 4242 4242/)).toBeTruthy();
  } else {
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/^Card form/)).toBeNull();
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('https://example.test/v6/stripe/test_publishable_key/');
});
