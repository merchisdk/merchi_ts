const warmMock = jest.fn();

jest.mock('../runtime/pricing', () => ({
  createPricing: () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getQuote: async (job: any) => ({ ...job, totalCost: 42 }),
    warm: () => warmMock(),
  }),
}));

import { createProductFormRuntime } from '../runtime/runtime';

describe('createProductFormRuntime', () => {
  beforeEach(() => warmMock.mockReset());

  it('warms pricing on creation', () => {
    createProductFormRuntime({ apiUrl: 'x', product: { id: 1 } });
    expect(warmMock).toHaveBeenCalled();
  });

  it('quotes the job then calls the matching callback', async () => {
    const onBuyNow = jest.fn();
    const runtime = createProductFormRuntime({
      apiUrl: 'https://api.example/v6/',
      product: { id: 7 },
      onBuyNow,
    });
    await runtime.actions.buyNow!({ variationsGroups: [{ quantity: 1, variations: [] }] });
    expect(onBuyNow).toHaveBeenCalledWith(
      expect.objectContaining({ totalCost: 42, product: { id: 7 } }),
    );
  });

  it('exposes pricing and helpers', () => {
    const runtime = createProductFormRuntime({ apiUrl: 'x', product: { id: 1 } });
    expect(typeof runtime.pricing.getQuote).toBe('function');
    expect(typeof runtime.helpers.serializeJob).toBe('function');
    expect(typeof runtime.helpers.nonEmptyGroups).toBe('function');
    expect(typeof runtime.helpers.formatCurrency).toBe('function');
    expect(typeof runtime.helpers.urlFor).toBe('function');
  });

  it('omits an action when its callback is not provided', () => {
    const runtime = createProductFormRuntime({ apiUrl: 'x', product: {} });
    expect(runtime.actions.buyNow).toBeUndefined();
  });
});
