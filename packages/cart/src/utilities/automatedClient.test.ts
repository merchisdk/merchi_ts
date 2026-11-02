import { isAutomatedClient } from './automatedClient';

describe('automated startup hint', () => {
  it.each([
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0.8010.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Baiduspider-render/2.0)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'Mozilla/5.0 (compatible; SEBot-WA/1.0)',
  ])('recognizes an automated visitor: %s', userAgent => {
    expect(isAutomatedClient(userAgent)).toBe(true);
  });
  it.each([
    '',
    'Mozilla/5.0 Chrome/153.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.6.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15) Chrome/153.0.0.0 Mobile Safari/537.36 [FBAN/FB4A]',
  ])('keeps ordinary startup behavior: %s', userAgent => {
    expect(isAutomatedClient(userAgent)).toBe(false);
  });
});
