const estimateQuoteMock = jest.fn();
const serverGetQuoteMock = jest.fn();
const serverFromJsonMock = jest.fn();

jest.mock('merchi_sdk_ts', () => ({
  Merchi: jest.fn().mockImplementation(() => ({
    Job: jest.fn().mockImplementation(() => ({
      fromJson: serverFromJsonMock,
      getQuote: serverGetQuoteMock,
    })),
  })),
  pricing: {
    estimateQuote: (...args: unknown[]) => estimateQuoteMock(...args),
  },
}));

import { toSelections, clientQuote, PricingRules } from '../runtime/clientPricing';
import { createPricing } from '../runtime/pricing';

const RULES: PricingRules = {
  hasGroups: true,
  fields: [],
  groupFields: [{ id: 10, isSelectable: true }],
};

beforeEach(() => {
  estimateQuoteMock.mockReset();
  serverGetQuoteMock.mockReset();
  serverFromJsonMock.mockReset();
  serverGetQuoteMock.mockResolvedValue({ toJson: () => ({ totalCost: 1, source: 'server' }) });
});

describe('toSelections', () => {
  it('maps grouped selectable fields to selectedOptionIds', () => {
    const sel = toSelections(
      {
        variationsGroups: [
          { quantity: 2, variations: [{ variationField: { id: 10 }, value: '5' }] },
        ],
      },
      RULES,
    );
    expect(sel.groups).toEqual([
      { quantity: 2, fieldValues: { 10: { selectedOptionIds: [5] } } },
    ]);
  });
});

describe('clientQuote', () => {
  it('merges pricing fields and per-group costs', () => {
    estimateQuoteMock.mockReturnValue({
      cost: 100, costPerUnit: 50, taxAmount: 15, totalCost: 115,
      currency: 'NZD', groupCosts: [40, 60],
    });
    const job = {
      variationsGroups: [{ quantity: 1, variations: [] }, { quantity: 1, variations: [] }],
    };
    const out = clientQuote(RULES, job)!;
    expect(out.totalCost).toBe(115);
    expect(out.currency).toBe('NZD');
    expect(out.variationsGroups![0].groupCost).toBe(40);
    expect(out.variationsGroups![1].groupCost).toBe(60);
  });

  it('returns null when pricing is unsupported', () => {
    estimateQuoteMock.mockReturnValue({ unsupported: 'nope' });
    expect(clientQuote(RULES, { variationsGroups: [] })).toBeNull();
  });
});

describe('createPricing client-side path', () => {
  it('computes locally without a server call when clientSideCalculation is set', async () => {
    estimateQuoteMock.mockReturnValue({ totalCost: 200, currency: 'USD' });
    const pricing = createPricing('https://api/v6/', {
      product: { id: 9, clientSideCalculation: true },
      pricingRules: RULES,
    });
    const out = await pricing.getQuote({ variationsGroups: [] });
    expect(out.totalCost).toBe(200);
    expect(estimateQuoteMock).toHaveBeenCalled();
    expect(serverGetQuoteMock).not.toHaveBeenCalled();
  });

  it('falls back to the server quote when client-side is unsupported', async () => {
    estimateQuoteMock.mockReturnValue({ unsupported: 'x' });
    const pricing = createPricing('https://api/v6/', {
      product: { id: 9, clientSideCalculation: true },
      pricingRules: RULES,
    });
    const out = await pricing.getQuote({ variationsGroups: [] });
    expect(serverGetQuoteMock).toHaveBeenCalled();
    expect((out as Record<string, unknown>).source).toBe('server');
  });

  it('uses the server quote when clientSideCalculation is not set', async () => {
    const pricing = createPricing('https://api/v6/', { product: { id: 9 } });
    await pricing.getQuote({ variationsGroups: [] });
    expect(estimateQuoteMock).not.toHaveBeenCalled();
    expect(serverGetQuoteMock).toHaveBeenCalled();
  });

  it('warm() caches provided rules so the first quote does no fetch and is local', async () => {
    estimateQuoteMock.mockReturnValue({ totalCost: 5, currency: 'USD' });
    const fetchMock = jest.fn();
    (global as Record<string, unknown>).fetch = fetchMock;
    const pricing = createPricing('https://api/v6/', {
      product: { id: 9, clientSideCalculation: true },
      pricingRules: RULES,
    });
    pricing.warm();
    const out = await pricing.getQuote({ variationsGroups: [] });
    expect(out.totalCost).toBe(5);
    // rules were provided, so warm/getQuote never hit the network
    expect(fetchMock).not.toHaveBeenCalled();
    expect(serverGetQuoteMock).not.toHaveBeenCalled();
    delete (global as Record<string, unknown>).fetch;
  });
});
