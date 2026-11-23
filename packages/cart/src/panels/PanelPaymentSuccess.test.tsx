import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import { useCartContext } from '../CartProvider';
import PanelPaymentSuccess from './PanelPaymentSuccess';

jest.mock('../CartProvider', () => ({ useCartContext: jest.fn() }));
jest.mock('../components/containers', () => ({
  CheckoutContainer: ({ children }: any) => children,
  InnerContainer: ({ children }: any) => children,
}));
jest.mock('../components', () => ({
  CartBody: ({ children }: any) => children,
  CartTabPanel: ({ children }: any) => children,
}));
jest.mock('../buttons', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
  ButtonInvoiceDownload: () => <button>Download receipt</button>,
}));

it.each([
  [true, false, true],
  [undefined, true, true],
  [false, false, false],
])('labels the confirmation for invoice %s and cart %s', (invoiceTest, cartTest, expectedTest) => {
  (useCartContext as jest.Mock).mockReturnValue({
    cart: { isTest: cartTest },
    invoiceJson: { id: 42, isTest: invoiceTest, unpaid: false },
    customSuccessMessage: 'Our team is preparing your goods.',
  });
  const page = renderToStaticMarkup(<PanelPaymentSuccess />);
  expect(page.includes('Test order #42')).toBe(expectedTest);
  expect(page.includes('Simulated payment received.')).toBe(expectedTest);
  expect(page.includes('Payment Received!')).toBe(!expectedTest);
  expect(page.includes('Our team is preparing your goods.')).toBe(!expectedTest);
  expect(page).toContain('Download receipt');
});
