import {
  configureFrontendErrors,
  type FrontendErrorEvent,
} from '@merchi/error-catch';
import { generatePublicInvoicePdf } from './invoice';

function apiError(statusCode: number, message: string) {
  const error = new Error(message);
  error.name = 'ApiError';
  return Object.assign(error, {
    statusCode,
    errorCode: 3,
    errorMessage: message,
  });
}

describe('generatePublicInvoicePdf error reporting', () => {
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
    global.fetch = jest.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
  });

  it('reports an unexpected failure and still rejects with the original error', async () => {
    await expect(generatePublicInvoicePdf('https://api.example/', {
      id: 42,
      invoiceToken: 'token',
      domain: { emailDomain: 'shop.example' },
    })).rejects.toThrow('network down');

    expect(events.map((event) => event.digest)).toEqual(['cart.invoicePdf']);
    expect(events[0]?.errorType).toBe('TypeError');
  });

  it('normalises a non-Error rejection instead of dropping it', async () => {
    global.fetch = jest.fn(async () => {
      throw 'pdf failed';
    }) as unknown as typeof fetch;

    await expect(generatePublicInvoicePdf('https://api.example/', {
      id: 42,
      invoiceToken: 'token',
      domain: null,
    })).rejects.toBe('pdf failed');

    expect(events[0]).toMatchObject({
      digest: 'cart.invoicePdf',
      errorType: 'NonErrorException',
      message: 'pdf failed',
    });
  });

  it('reports a non-OK PDF response and still rejects', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
    })) as unknown as typeof fetch;

    await expect(generatePublicInvoicePdf('https://api.example/', {
      id: 9,
      invoiceToken: 'token',
      domain: { emailDomain: 'shop.example' },
    })).rejects.toThrow('Error fetching PDF.');

    expect(events[0]).toMatchObject({
      digest: 'cart.invoicePdf',
      errorType: 'Error',
      message: 'Error fetching PDF.',
    });
  });

  it('redacts a non-Error object rejection', async () => {
    global.fetch = jest.fn(async () => {
      throw { customerEmail: 'person@example.com' };
    }) as unknown as typeof fetch;

    await expect(generatePublicInvoicePdf('https://api.example/', {
      id: 42,
      invoiceToken: 'token',
      domain: null,
    })).rejects.toEqual({ customerEmail: 'person@example.com' });

    expect(events[0]?.errorType).toBe('NonErrorException');
    expect(events[0]?.message).toBe('Non-Error exception');
    expect(JSON.stringify(events[0])).not.toContain('person@example.com');
  });

  it('skips expected client errors and still rejects', async () => {
    const error = apiError(409, 'invoice token rejected');
    global.fetch = jest.fn(async () => {
      throw error;
    }) as unknown as typeof fetch;

    await expect(generatePublicInvoicePdf('https://api.example/', {
      id: 42,
      invoiceToken: 'token',
      domain: { emailDomain: 'shop.example' },
    })).rejects.toBe(error);

    expect(events).toEqual([]);
  });
});
