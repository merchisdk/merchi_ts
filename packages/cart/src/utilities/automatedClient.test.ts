import { isAutomatedClient } from './automatedClient';

describe('isAutomatedClient', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('detects common crawler user agents', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent:
          'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      },
    });
    expect(isAutomatedClient()).toBe(true);
  });

  it('returns false for a normal browser user agent', () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    expect(isAutomatedClient()).toBe(false);
  });
});
