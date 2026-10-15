import { configureFrontendErrors, type FrontendErrorEvent } from '@merchi/error-catch';
import { reportCheckoutFailure } from './reportFailure';

test('reports failed checkout transport/server/auth errors but filters confirmed handled input errors', () => {
  const events: FrontendErrorEvent[] = [];
  configureFrontendErrors({ endpoint: 'https://collector.example', application: 'store', enabled: true, dedupeWindowMs: 0,
    transport: (_, event) => { events.push(event); } });
  reportCheckoutFailure(new TypeError('Failed to fetch'));
  reportCheckoutFailure({ message: 'server error', errorCode: 1 }, 500);
  reportCheckoutFailure({ message: 'unauthorized', errorCode: 7 }, 401);
  reportCheckoutFailure({ message: 'invalid phone', errorCode: 6, email: 'person@example.com' }, 422);
  expect(events.map(event => event.apiStatusCode)).toEqual([undefined, 500, 401]);
  expect(events.every(event => event.operation?.name === 'checkout.submit')).toBe(true);
  expect(JSON.stringify(events)).not.toContain('person@example.com');
});
