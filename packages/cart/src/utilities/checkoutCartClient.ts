import { Merchi } from '@merchi/sdk';
import { getCartCookie } from './cookie';

export async function getCheckoutCartClient(
  cart: { id: number | string; token?: string; isTest?: boolean },
  domainId: number | string | undefined,
  apiUrl?: string,
) {
  let token = cart.token;
  // Another tab can replace the cookie while checkout still shows its own cart.
  if (!token && domainId) {
    const cookie = await getCartCookie(domainId, cart.isTest === true);
    if (cookie?.[0] === String(cart.id)) token = cookie[1];
  }
  return token ? new Merchi(undefined, undefined, undefined, token, apiUrl) : undefined;
}
