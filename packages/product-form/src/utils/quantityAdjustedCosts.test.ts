import {
  costsAtQuantity,
  displayQuantity,
  groupIndexFromVariationName,
  withQuantityAdjustedDisplayCosts,
} from './quantityAdjustedCosts';

const smallDiscounts = {
  discounts: [
    { amount: 30.25, lowerLimit: 20 },
    { amount: 33.61, lowerLimit: 30 },
    { amount: 38.66, lowerLimit: 40 },
    { amount: 43.7, lowerLimit: 50 },
    { amount: 45.38, lowerLimit: 60 },
  ],
};

const mediumDiscounts = {
  discounts: [
    { amount: 8.33, lowerLimit: 10 },
    { amount: 27.78, lowerLimit: 20 },
    { amount: 31.25, lowerLimit: 30 },
    { amount: 34.72, lowerLimit: 40 },
    { amount: 38.19, lowerLimit: 50 },
    { amount: 39.58, lowerLimit: 60 },
  ],
};

const embroideryRules = {
  currency: 'AUD',
  fields: [
    {
      id: 399949,
      fieldType: 2,
      isSelectable: true,
      variationCost: 0,
      variationUnitCost: 0,
      options: [
        {
          id: 1133340,
          variationCost: 40,
          variationUnitCost: 8.92,
          variationCostDiscountGroup: null,
          variationUnitCostDiscountGroup: smallDiscounts,
        },
        {
          id: 1133341,
          variationCost: 40,
          variationUnitCost: 10.8,
          variationCostDiscountGroup: null,
          variationUnitCostDiscountGroup: mediumDiscounts,
        },
      ],
    },
  ],
  groupFields: [],
};

test('applies the quantity tier to an option unit cost', () => {
  expect(
    costsAtQuantity(
      {
        variationCost: 40,
        variationUnitCost: 8.92,
        variationUnitCostDiscountGroup: smallDiscounts,
      },
      50
    )
  ).toEqual({ onceOffCost: 40, unitCost: 5.022 });
  expect(
    costsAtQuantity(
      {
        variationCost: 40,
        variationUnitCost: 10.8,
        variationUnitCostDiscountGroup: mediumDiscounts,
      },
      50
    )
  ).toEqual({ onceOffCost: 40, unitCost: 6.675 });
});

test('keeps the base unit cost below the first discount tier', () => {
  expect(
    costsAtQuantity(
      {
        variationCost: 40,
        variationUnitCost: 8.92,
        variationUnitCostDiscountGroup: smallDiscounts,
      },
      1
    )
  ).toEqual({ onceOffCost: 40, unitCost: 8.92 });
});

test('rewrites select option costs used by labels', () => {
  const variation = {
    variationField: { id: 399949, fieldType: 2 },
    selectableOptions: [
      { optionId: 1133340, value: 'Small (5 x 5cm)', onceOffCost: 40, unitCost: 8.92, currency: 'AUD' },
      { optionId: 1133341, value: 'Medium (7.5 x 5cm)', onceOffCost: 40, unitCost: 10.8, currency: 'AUD' },
    ],
  };

  const priced = withQuantityAdjustedDisplayCosts(variation, embroideryRules, 50);

  expect(priced.selectableOptions.map((option: any) => option.unitCost)).toEqual([
    5.022,
    6.675,
  ]);
  expect(priced.selectableOptions[0].onceOffCost).toBe(40);
  expect(priced.selectableOptions[0].value).toBe('Small (5 x 5cm)');
});

test('leaves options alone when pricing rules are missing', () => {
  const variation = {
    variationField: { id: 399949 },
    selectableOptions: [{ optionId: 1133340, onceOffCost: 40, unitCost: 8.92 }],
  };
  expect(withQuantityAdjustedDisplayCosts(variation, null, 50)).toBe(variation);
});

test('prices an independent field from the summed group quantity', () => {
  expect(groupIndexFromVariationName('variations')).toBeNull();
  expect(groupIndexFromVariationName('variationsGroups[1].variations')).toBe(1);
  expect(
    displayQuantity({
      groupIndex: null,
      groupQuantity: 0,
      groups: [{ quantity: 20 }, { quantity: '30' }],
      jobQuantity: 1,
      hasGroups: true,
    })
  ).toBe(50);
  expect(
    displayQuantity({
      groupIndex: 1,
      groupQuantity: '30',
      groups: [{ quantity: 20 }, { quantity: 30 }],
      jobQuantity: 50,
      hasGroups: true,
    })
  ).toBe(30);
});
