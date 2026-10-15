import {
  configureFrontendErrors,
  type FrontendErrorEvent,
} from '@merchi/error-catch';
import { reportAddCartItemFailure, reportCartFailure } from './reportFailure';

function apiError(statusCode: number, message: string) {
  const error = new Error(message);
  error.name = 'ApiError';
  return Object.assign(error, {
    statusCode,
    errorCode: 3,
    errorMessage: message,
  });
}

describe('reportAddCartItemFailure', () => {
  const events: FrontendErrorEvent[] = [];

  beforeEach(() => {
    events.length = 0;
    configureFrontendErrors({
      endpoint: 'https://api.merchi.co/v6/frontend-errors',
      application: 'merchi-storefront-1',
      enabled: true,
      dedupeWindowMs: 0,
      transport: (_endpoint, event) => {
        events.push(event);
      },
    });
  });

  it('reports an unexpected add-to-cart failure and still calls onError', () => {
    const error = new TypeError('cart item create failed');
    const onError = jest.fn();

    reportAddCartItemFailure(error, onError);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(events[0]).toMatchObject({
      digest: 'cart.addItem',
      errorType: 'TypeError',
      message: 'cart item create failed',
      source: 'manual',
      operation: { name: 'cart.add_item', outcome: 'handled', reason: 'validation' },
    });
  });

  it('normalises a non-Error rejection and forwards the original value', () => {
    const onError = jest.fn();

    reportAddCartItemFailure('stock check failed', onError);

    expect(onError).toHaveBeenCalledWith('stock check failed');
    expect(events[0]).toMatchObject({
      digest: 'cart.addItem',
      errorType: 'NonErrorException',
      message: 'stock check failed',
    });
  });

  it('skips an expected client error and still calls onError', () => {
    const error = apiError(422, 'quantity unavailable');
    const onError = jest.fn();

    reportAddCartItemFailure(error, onError);

    expect(onError).toHaveBeenCalledWith(error);
    expect(events).toEqual([]);
  });

  it('reports a server error', () => {
    const error = apiError(500, 'cart service down');
    const onError = jest.fn();

    reportAddCartItemFailure(error, onError);

    expect(onError).toHaveBeenCalledWith(error);
    expect(events[0]).toMatchObject({
      digest: 'cart.addItem',
      errorType: 'ApiError',
      message: 'cart service down',
    });
  });

  it('retains a client-shaped failure when the UI callback itself fails', () => {
    const error = apiError(422, 'input error');
    expect(() => reportAddCartItemFailure(error, () => { throw new Error('UI broke'); })).toThrow('UI broke');
    expect(events[0]).toMatchObject({ operation: { name: 'cart.add_item', outcome: 'failed' } });
  });
});

describe('reportCartFailure before error-catch is configured', () => {
  it('does not throw and does not create a reporter', () => {
    jest.isolateModules(() => {
      const errorCatch = require('@merchi/error-catch');
      const reporting = require('./reportFailure');
      const onError = jest.fn();
      const error = new TypeError('boom');

      expect(() => {
        reporting.reportCartFailure(error, 'cart.invoicePdf');
        reporting.reportAddCartItemFailure('plain failure', onError);
      }).not.toThrow();

      expect(onError).toHaveBeenCalledWith('plain failure');
      expect(errorCatch.getDefaultFrontendErrorReporter()).toBeUndefined();
    });
  });
});
