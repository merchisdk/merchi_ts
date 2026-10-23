import { apiFetch, backendFetch, ApiError } from './request.js';
import { ErrorType } from './constants/errors.js';
import { setup, mockFetch } from './test_util.js';

setup();

test('can pass through data from server', () => {
  mockFetch(true, {'animal': 'turtle'}, 200);
  return apiFetch('https://api.merchi.co/', '/test').then(data => {
    expect(data.animal).toBe('turtle');
  });
});

test('can pass through data from server with override url', () => {
  (window as any).merchiBackendUri = 'http://override.example.com/';
  mockFetch(true, {'animal': 'turtle'}, 200);
  return apiFetch('https://api.merchi.co/', '/test').then(data => {
    expect(data.animal).toBe('turtle');
  });
});

test('404 creates ApiError', () => {
  mockFetch(false, {'statusCode': 404, 'errorCode': ErrorType.RESOURCE_NOT_FOUND}, 404);
  return apiFetch('https://api.merchi.co/', '/test').catch(e => {
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe('ApiError');
    expect(e.errorCode).toBe(ErrorType.RESOURCE_NOT_FOUND);
    expect(e.errorMessage).toBe('Request failed (HTTP 404)');
  });
});

test('will get default errorCode', () => {
  mockFetch(false,
    {'statusCode': 404,
      'errorCode': -1,
      'message': 'just a test'}, 404);
  return apiFetch('https://api.merchi.co/', '/test').catch(e => {
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe('ApiError');
    expect(e.errorCode).toBe(ErrorType.UNKNOWN_ERROR);
    expect(e.errorMessage).toBe('just a test');
    expect(e.message).toBe('just a test');
  });
});

test('lead spam rejection keeps its API code through apiFetch', async () => {
  mockFetch(false, {
    statusCode: 400,
    errorCode: 227,
    message: 'Invalid submission',
  }, 400);
  await expect(apiFetch('https://api.merchi.co/', '/create_new_lead/', {
    method: 'POST',
  })).rejects.toMatchObject({
    name: 'ApiError',
    statusCode: 400,
    errorCode: 227,
    message: 'Invalid submission',
    errorMessage: 'Invalid submission',
  });
});

test.each([226, 1000])('ApiError preserves new numeric API code %s', errorCode => {
  const error = new ApiError({ statusCode: 400, errorCode, message: 'Rejected' });
  expect(error.errorCode).toBe(errorCode);
  expect(error.original.errorCode).toBe(errorCode);
});

test.each(['227', 'INVALID_PHONE_NUMBER', NaN, -1])(
  'ApiError rejects malformed API code %p', errorCode => {
    const error = new ApiError({ statusCode: 400, errorCode, message: 'Rejected' });
    expect(error.errorCode).toBe(ErrorType.UNKNOWN_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Rejected');
  },
);

test('ApiError keeps plain string messages', () => {
  const e = new ApiError('empty response');
  expect(e.message).toBe('empty response');
  expect(e.errorMessage).toBe('empty response');
});

test('ApiError.message is the human-readable text, not serialized JSON', () => {
  mockFetch(false, {
    'statusCode': 403,
    'errorCode': ErrorType.UNKNOWN_ERROR,
    'message': 'cannot set referrer',
  }, 403);
  return apiFetch('https://api.merchi.co/', '/test').catch(e => {
    expect(e.message).toBe('cannot set referrer');
    expect(e.errorMessage).toBe('cannot set referrer');
    expect(e.message).not.toContain('errorCode');
    expect(e.message).not.toContain('statusCode');
  });
});

test('ApiError exposes details when the server supplies them', () => {
  const details = {
    relation: 'file',
    parentType: 'variation',
    id: 'abc123',
    index: 0,
    provided: {
      id: 'abc123',
      uploadId: 'upload-xyz',
      creationDate: '1776978388',
    },
  };
  mockFetch(false, {
    'statusCode': 404,
    'errorCode': ErrorType.RESOURCE_NOT_FOUND,
    'message': 'no such file #abc123 on variation',
    'details': details,
  }, 404);
  return apiFetch('https://api.merchi.co/', '/test').catch(e => {
    expect(e.name).toBe('ApiError');
    expect(e.details).toEqual(details);
    expect(e.details.provided.uploadId).toBe('upload-xyz');
  });
});

test('ApiError leaves details undefined when the server omits them', () => {
  mockFetch(false,
    {'statusCode': 400,
      'errorCode': ErrorType.RESOURCE_NOT_FOUND,
      'message': 'plain error'}, 400);
  return apiFetch('https://api.merchi.co/', '/test').catch(e => {
    expect(e.name).toBe('ApiError');
    expect(e.details).toBeUndefined();
  });
});

test.each([null, undefined])('ApiError accepts an empty response body (%s)', value => {
  const error = new ApiError(value);
  expect(error.message).toBe('No error message');
  expect(error.statusCode).toBeUndefined();
});

test.each(['GET', 'HEAD', undefined])('retries one lost %s response', async method => {
  const response = { status: 200, json: () => Promise.resolve({ cart: { id: 42 } }) };
  const fetch = jest.fn().mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValue(response);
  (global as any).fetch = fetch;
  await expect(apiFetch('https://api.merchi.co/', '/carts/42/', { method })).resolves.toEqual({ cart: { id: 42 } });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1]);
});

test('retries Safari NetworkError reads', async () => {
  const error = Object.assign(new Error('A network error occurred.'), { name: 'NetworkError' });
  const fetch = jest.fn().mockRejectedValueOnce(error).mockResolvedValue({ status: 200, json: async () => ({}) });
  (global as any).fetch = fetch;
  await apiFetch('https://api.merchi.co/', '/carts/42/');
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('read retry is bounded and preserves the final failure', async () => {
  const error = new TypeError('Failed to fetch');
  const fetch = jest.fn().mockRejectedValue(error);
  (global as any).fetch = fetch;
  await expect(apiFetch('https://api.merchi.co/', '/carts/42/')).rejects.toBe(error);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test.each(['POST', 'PATCH', 'PUT', 'DELETE'])('never retries %s after a lost response', async method => {
  const error = new TypeError('Load failed');
  const fetch = jest.fn().mockRejectedValue(error);
  (global as any).fetch = fetch;
  await expect(apiFetch('https://api.merchi.co/', '/carts/', { method })).rejects.toBe(error);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('does not retry aborts or unrelated exceptions', async () => {
  for (const error of [Object.assign(new Error('Cancelled'), { name: 'AbortError' }), new Error('unexpected failure')]) {
    const fetch = jest.fn().mockRejectedValue(error);
    (global as any).fetch = fetch;
    await expect(apiFetch('https://api.merchi.co/', '/carts/42/')).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});

test('does not retry a network error after its signal is aborted', async () => {
  const controller = new AbortController();
  const error = new TypeError('Load failed');
  (global as any).fetch = jest.fn().mockImplementation(async () => { controller.abort(); throw error; });
  await expect(apiFetch('https://api.merchi.co/', '/carts/42/', { signal: controller.signal })).rejects.toBe(error);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('cancelling during the retry delay prevents a second request', async () => {
  const controller = new AbortController();
  const error = new TypeError('Load failed');
  (global as any).fetch = jest.fn().mockRejectedValue(error);
  const pending = apiFetch('https://api.merchi.co/', '/carts/42/', { signal: controller.signal });
  await Promise.resolve();
  controller.abort();
  await expect(pending).rejects.toBe(error);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('query parameters survive retries without duplication', async () => {
  const fetch = jest.fn().mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValue({ status: 200 });
  (global as any).fetch = fetch;
  await backendFetch('https://api.merchi.co/v6/', '/carts/42/', { query: [['cart_token', 'test-token']], method: 'GET' });
  expect(fetch).toHaveBeenCalledWith('https://api.merchi.co/v6/carts/42/?cart_token=test-token', { method: 'GET', query: [['cart_token', 'test-token']] });
});

test('non-JSON gateway failures preserve their HTTP status without exposing HTML', async () => {
  const fetch = jest.fn().mockResolvedValue({ status: 502, json: async () => { throw new SyntaxError('private gateway HTML'); } });
  (global as any).fetch = fetch;
  await expect(apiFetch('https://api.merchi.co/', '/carts/42/')).rejects.toMatchObject({ name: 'ApiError', statusCode: 502, message: 'Request failed (HTTP 502)' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([null, 'Service unavailable', { statusCode: 200, message: 'Service unavailable' }])('HTTP status is authoritative for error body %s', async body => {
  mockFetch(false, body, 503);
  await expect(apiFetch('https://api.merchi.co/', '/carts/42/')).rejects.toMatchObject({ name: 'ApiError', statusCode: 503 });
});
