import { readHandoffCart } from './cookie';

describe('checkout cart handoff', () => {
  it('reads an id and token from the checkout query', () => {
    expect(readHandoffCart('?cart=530141,AbcdEfgh_123-xyz')).toEqual([
      '530141',
      'AbcdEfgh_123-xyz',
    ]);
  });

  it('reads a query where the comma was encoded', () => {
    expect(readHandoffCart('?cart=5%2Cabcdefgh')).toEqual(['5', 'abcdefgh']);
  });

  it('ignores a cart value that is not an id and token', () => {
    expect(readHandoffCart('?cart=530141')).toBeNull();
    expect(readHandoffCart('?cart=nope,short')).toBeNull();
    expect(readHandoffCart('')).toBeNull();
  });
});
