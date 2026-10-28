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
      operation: { name: 'cart.add_item', outcome: 'failed' },
    });
  });

  it.each(['Load failed', 'Failed to fetch'])('does not label %s as handled validation', (message) => {
    reportAddCartItemFailure(new TypeError(message), jest.fn());
    expect(events).toHaveLength(1);
    expect(events[0].operation).toEqual({ name: 'cart.add_item', outcome: 'failed' });
  });

  it.each([400, 409, 422])('preserves handled known-input suppression for status %s', (status) => {
    for (const code of [3, 5, 6, 7]) {
      const error = Object.assign(apiError(status, 'input error'), { errorCode: code });
      reportAddCartItemFailure(error, jest.fn());
    }
    expect(events).toEqual([]);
  });

  it.each([
    [400, 2], [400, 0], [400, 1], [401, 3], [403, 3], [404, 3],
    [429, 3], [500, 3], [undefined, 3], [422, undefined], ['422', 3], [422, '3'],
  ])('retains unresolved API failure (%s, %s) without a validation label', (statusCode, errorCode) => {
    const error = Object.assign(new Error('request failed'), { statusCode, errorCode });
    reportAddCartItemFailure(error, jest.fn());
    expect(events).toHaveLength(1);
    expect(events[0].operation).toEqual({ name: 'cart.add_item', outcome: 'failed' });
  });

  it('normalises a non-Error rejection and forwards the original value', () => {
    const onError = jest.fn();

    reportAddCartItemFailure('stock check failed', onError);

    expect(onError).toHaveBeenCalledWith('stock check failed');
    expect(events[0]).toMatchObject({
      digest: 'cart.addItem',
      errorType: 'NonErrorException',
      message: 'stock check failed',
      operation: { name: 'cart.add_item', outcome: 'failed' },
    });
  });

  it('skips an expected client error and still calls onError', () => {
    const error = apiError(422, 'quantity unavailable');
    const onError = jest.fn();

    reportAddCartItemFailure(error, onError);

    expect(onError).toHaveBeenCalledWith(error);
    expect(events).toEqual([]);
  });

  it('retains validation-shaped failures without confirmed UI handling', () => {
    reportCartFailure(apiError(422, 'input error'), 'cart.addItem');
    expect(events).toHaveLength(1);
    expect(events[0].operation).toEqual({ name: 'cart.add_item', outcome: 'failed' });
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

describe('classification failures', () => {
  it('still calls the reporter when a diagnostic getter throws', () => {
    jest.isolateModules(() => {
      const capture = jest.fn();
      jest.doMock('@merchi/error-catch', () => ({ captureUnexpected: capture }));
      const reporting = require('./reportFailure');
      const error = Object.defineProperty(new TypeError('Load failed'), 'statusCode', {
        get() { throw new Error('unreadable status'); },
      });
      const callback = jest.fn();
      reporting.reportAddCartItemFailure(error, callback);
      expect(callback).toHaveBeenCalledWith(error);
      expect(capture).toHaveBeenCalledWith(error, expect.objectContaining({
        operation: { name: 'cart.add_item', outcome: 'failed' },
      }));
      jest.dontMock('@merchi/error-catch');
    });
  });
});
