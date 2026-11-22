import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import InvoiceInfo from './InvoiceInfo';

afterEach(cleanup);

it.each([true, false])('identifies a simulated receipt only for test invoices (%s)', (isTest) => {
  render(<InvoiceInfo invoice={{ id: 9, unpaid: false, isTest }} urlApi="/" alertErrorShow={() => {}} classNameMerchiInvoiceButtonDownloadInvoice="" />);
  expect(Boolean(screen.queryByRole('note', { name: 'Test order · Invoice #9' }))).toBe(isTest);
  expect(Boolean(screen.queryByText('Paid, thank you!'))).toBe(!isTest);
  expect(screen.getByRole('button', { name: 'Download Receipt' })).toBeTruthy();
});
