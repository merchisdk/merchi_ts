import {
  footerActionsFromComponent,
  normalizeFooterActions,
  resolveFooterActions,
} from '../components/footerActions';

const allAvailable = { addToCart: true, buyNow: true, getQuote: true };

describe('normalizeFooterActions', () => {
  it('drops invalid entries and empty lists', () => {
    expect(normalizeFooterActions(null)).toBeNull();
    expect(normalizeFooterActions([])).toBeNull();
    expect(normalizeFooterActions([{ action: 'nope' }])).toBeNull();
    expect(
      normalizeFooterActions([
        { action: 'getQuote', label: 'Place order', primary: true },
        { action: 'skip-me' },
      ]),
    ).toEqual([{ action: 'getQuote', label: 'Place order', primary: true }]);
  });
});

describe('resolveFooterActions', () => {
  it('defaults to Get quote, Buy now, Add to cart', () => {
    expect(resolveFooterActions({ available: allAvailable })).toEqual([
      { action: 'getQuote', label: 'Get quote', primary: false },
      { action: 'buyNow', label: 'Buy now', primary: false },
      { action: 'addToCart', label: 'Add to cart', primary: true },
    ]);
  });

  it('replaces the host footer with a single Place order → getQuote action', () => {
    expect(
      resolveFooterActions({
        available: allAvailable,
        footerActions: [
          { action: 'getQuote', label: 'Place order', primary: true },
        ],
      }),
    ).toEqual([
      { action: 'getQuote', label: 'Place order', primary: true },
    ]);
  });

  it('falls back to host defaults when configured actions are unavailable', () => {
    expect(
      resolveFooterActions({
        available: { addToCart: true, buyNow: false, getQuote: false },
        actionLabels: { addToCart: 'Save' },
        footerActions: [
          { action: 'getQuote', label: 'Place order', primary: true },
        ],
      }),
    ).toEqual([{ action: 'addToCart', label: 'Save', primary: true }]);
  });

  it('lets host actionLabels override a form label', () => {
    expect(
      resolveFooterActions({
        available: { addToCart: true, buyNow: false, getQuote: false },
        actionLabels: { addToCart: 'Save' },
        footerActions: [{ action: 'addToCart', label: 'Place order' }],
      }),
    ).toEqual([{ action: 'addToCart', label: 'Save', primary: true }]);
  });
});

describe('footerActionsFromComponent', () => {
  it('reads a static footerActions assignment on the form export', () => {
    function Form() {
      return null;
    }
    Form.footerActions = [
      { action: 'getQuote', label: 'Place order', primary: true },
    ];
    expect(footerActionsFromComponent(Form)).toEqual([
      { action: 'getQuote', label: 'Place order', primary: true },
    ]);
  });
});
