import { serializeJob, nonEmptyGroups } from '../helpers/serialize';

describe('serializeJob', () => {
  it('defaults missing group quantity to 0 and drops zero-quantity groups', () => {
    const out = serializeJob({
      variationsGroups: [{ variations: [] }, { quantity: 3, variations: [] }],
    });
    expect(out.variationsGroups).toHaveLength(1);
    expect(out.variationsGroups![0].quantity).toBe(3);
  });

  it('strips form-only fields from variations', () => {
    const out = serializeJob({
      variations: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ value: 'red', id: 9, variationArrayFieldId: 'x', json: '{}' } as any),
      ],
    });
    const v = out.variations![0] as Record<string, unknown>;
    expect(v.value).toBe('red');
    expect(v.id).toBeUndefined();
    expect(v.variationArrayFieldId).toBeUndefined();
    expect(v.json).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const input = { variationsGroups: [{ quantity: 2, variations: [] }] };
    const out = serializeJob(input);
    expect(out).not.toBe(input);
    expect(input.variationsGroups[0].quantity).toBe(2);
  });
});

describe('nonEmptyGroups', () => {
  it('keeps only groups with quantity > 0', () => {
    const kept = nonEmptyGroups([
      { quantity: 0, variations: [] },
      { quantity: 2, variations: [] },
      { variations: [] },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].quantity).toBe(2);
  });
});
