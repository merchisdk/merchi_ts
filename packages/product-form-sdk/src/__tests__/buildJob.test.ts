import {
  buildProductFormJob,
  jobToFormState,
  selectionsToVariations,
} from '../helpers/buildJob';
import { FieldSelection } from '../components/context';

describe('buildProductFormJob', () => {
  const independentField = { id: 10, fieldType: 2, options: [{ id: 100, value: 'Rush' }] };
  const colourField = {
    id: 20,
    fieldType: 2,
    options: [
      { id: 201, value: 'Red' },
      { id: 202, value: 'Blue' },
    ],
  };

  it('builds a simple job with quantity for non-group products', () => {
    const selections: Record<number, FieldSelection> = {
      10: { value: '100', selectedOptionIds: [100] },
    };
    const job = buildProductFormJob({
      product: { id: 1, independentVariationFields: [independentField] },
      quantity: 5,
      selections,
    });
    expect(job.quantity).toBe(5);
    expect(job.variations).toEqual([
      { variationField: { id: 10 }, value: '100' },
    ]);
    expect(job.variationsGroups).toBeUndefined();
  });

  it('builds variationsGroups from option quantity grid state', () => {
    const job = buildProductFormJob({
      product: {
        id: 1,
        groupVariationFields: [colourField],
      },
      quantity: 99,
      selections: {},
      optionQuantities: { 201: 3, 202: 0 },
    });
    expect(job.quantity).toBeUndefined();
    expect(job.variationsGroups).toEqual([
      {
        quantity: 3,
        variations: [{ variationField: { id: 20 }, value: '201' }],
      },
    ]);
  });

  it('omits all-zero option quantity grid groups', () => {
    const job = buildProductFormJob({
      product: {
        id: 1,
        groupVariationFields: [colourField],
      },
      quantity: 1,
      selections: {},
      optionQuantities: { 201: 0, 202: 0 },
    });
    expect(job.variationsGroups).toEqual([]);
  });

  it('builds variationsGroups from multi-batch group rows', () => {
    const sizeField = { id: 30, fieldType: 2, options: [{ id: 301, value: 'L' }] };
    const job = buildProductFormJob({
      product: {
        id: 1,
        groupVariationFields: [colourField, sizeField],
        independentVariationFields: [independentField],
      },
      quantity: 1,
      selections: { 10: { value: '100', selectedOptionIds: [100] } },
      groups: [
        {
          quantity: 2,
          selections: {
            20: { value: '201', selectedOptionIds: [201] },
            30: { value: '301', selectedOptionIds: [301] },
          },
        },
      ],
    });
    expect(job.variations).toEqual([
      { variationField: { id: 10 }, value: '100' },
    ]);
    expect(job.variationsGroups).toHaveLength(1);
    expect(job.variationsGroups![0].quantity).toBe(2);
    expect(job.variationsGroups![0].variations).toHaveLength(2);
  });
});

describe('selectionsToVariations', () => {
  it('maps field selections to variation json', () => {
    expect(
      selectionsToVariations({
        5: { value: 'abc', selectedOptionIds: [] },
      }),
    ).toEqual([{ variationField: { id: 5 }, value: 'abc' }]);
  });
});

describe('jobToFormState', () => {
  const independentField = {
    id: 10,
    fieldType: 2,
    options: [{ id: 100, value: 'Rush' }],
  };
  const colourField = {
    id: 20,
    fieldType: 2,
    options: [
      { id: 201, value: 'Red' },
      { id: 202, value: 'Blue' },
    ],
  };

  it('hydrates quantity and independent selections from a job', () => {
    const state = jobToFormState(
      { id: 1, independentVariationFields: [independentField] },
      {
        quantity: 7,
        variations: [{ variationField: { id: 10 }, value: '100' }],
      },
    );
    expect(state.quantity).toBe(7);
    expect(state.selections[10]).toEqual({
      value: '100',
      selectedOptionIds: [100],
    });
  });

  it('hydrates option quantity grid groups', () => {
    const state = jobToFormState(
      { id: 1, groupVariationFields: [colourField] },
      {
        variationsGroups: [
          {
            quantity: 4,
            variations: [{ variationField: { id: 20 }, value: '201' }],
          },
        ],
      },
    );
    expect(state.optionQuantities).toEqual({ 201: 4, 202: 0 });
    expect(state.groups).toEqual([]);
  });

  it('round-trips a multi-batch group job', () => {
    const sizeField = { id: 30, fieldType: 2, options: [{ id: 301, value: 'L' }] };
    const product = {
      id: 1,
      groupVariationFields: [colourField, sizeField],
      independentVariationFields: [independentField],
    };
    const job = buildProductFormJob({
      product,
      quantity: 1,
      selections: { 10: { value: '100', selectedOptionIds: [100] } },
      groups: [
        {
          quantity: 2,
          selections: {
            20: { value: '201', selectedOptionIds: [201] },
            30: { value: '301', selectedOptionIds: [301] },
          },
        },
      ],
    });
    const state = jobToFormState(product, job);
    expect(state.selections[10].selectedOptionIds).toEqual([100]);
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].quantity).toBe(2);
    expect(state.groups[0].selections[20].selectedOptionIds).toEqual([201]);
  });
});
