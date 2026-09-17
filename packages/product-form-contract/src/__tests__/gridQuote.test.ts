import { quoteGroupForOption, inventoryStatusText } from '../helpers/gridQuote';
import { JobJson } from '../types/job';

describe('quoteGroupForOption', () => {
  const quote: JobJson = {
    variationsGroups: [
      {
        quantity: 2,
        groupCost: 40,
        inventorySufficient: true,
        variations: [{ variationField: { id: 20 }, value: '201' }],
      },
      {
        quantity: 0,
        groupCost: 0,
        inventorySufficient: false,
        inventoryCount: 0,
        variations: [{ variationField: { id: 20 }, value: '202' }],
      },
    ],
  };

  it('finds the group row matching field id and option id', () => {
    expect(quoteGroupForOption(quote, 20, 201)?.groupCost).toBe(40);
    expect(quoteGroupForOption(quote, 20, 202)?.inventorySufficient).toBe(false);
  });

  it('returns undefined when no match', () => {
    expect(quoteGroupForOption(quote, 99, 201)).toBeUndefined();
    expect(quoteGroupForOption(null, 20, 201)).toBeUndefined();
  });
});

describe('inventoryStatusText', () => {
  it('returns null when inventory is not tracked', () => {
    expect(inventoryStatusText(undefined, false)).toBeNull();
  });

  it('describes in-stock, insufficient, and out-of-stock rows', () => {
    expect(
      inventoryStatusText({ inventorySufficient: true }, true)?.label,
    ).toBe('In stock');
    expect(
      inventoryStatusText(
        { inventorySufficient: false, inventoryCount: 3 },
        true,
      )?.label,
    ).toBe('Insufficient stock (3 in stock)');
    expect(
      inventoryStatusText(
        { inventorySufficient: false, inventoryCount: 0 },
        true,
      )?.label,
    ).toBe('Out of stock');
  });
});
