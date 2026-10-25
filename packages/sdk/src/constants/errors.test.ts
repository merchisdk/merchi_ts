import { ErrorType, getErrorFromCode } from './errors.js';

test.each([ErrorType.UNKNOWN_ERROR, ErrorType.INVALID_PHONE_NUMBER, ErrorType.DOMAIN_NOT_FOUND])(
  'preserves known API error code %s', code => {
    expect(getErrorFromCode(code)).toBe(code);
  },
);

// INVALID_HCAPTCHA and SPAM_DETECTED exist in the API's Python SDK but not
// this SDK's legacy enum. Future codes must remain diagnosable too.
test.each([226, 227, 1000, Number.MAX_SAFE_INTEGER])(
  'preserves forward-compatible numeric API error code %s', code => {
    expect(getErrorFromCode(code)).toBe(code);
  },
);

test.each([
  undefined, null, -1, 1.5, NaN, Infinity, -Infinity,
  Number.MAX_SAFE_INTEGER + 1, '227', 'INVALID_PHONE_NUMBER',
  'toString', '__proto__', true, {}, [],
])('uses UNKNOWN_ERROR for malformed API code %p', code => {
  expect(getErrorFromCode(code)).toBe(ErrorType.UNKNOWN_ERROR);
});
