import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

export async function stripeInitPromise(apiUrl: string) {
  return await fetch(
    `${apiUrl}stripe/master_publishable_key/`,
    { method: 'GET', mode: 'cors' }
  ).then((response: any) => response.key);
}

export async function fetchTestPublishableKey(apiUrl: string) {
  const response: any = await fetch(
    `${apiUrl}stripe/test_publishable_key/`,
    { method: 'GET', mode: 'cors' }
  );
  if (response && typeof response.json === 'function') {
    if (!response.ok) {
      throw new Error('Stripe test keys are not configured');
    }
    const data = await response.json();
    if (!data || !data.key) {
      throw new Error('Stripe test keys are not configured');
    }
    return data.key;
  }
  if (!response || !response.key) {
    throw new Error('Stripe test keys are not configured');
  }
  return response.key;
}

export async function completeTestPayment(apiUrl: string, cart: any) {
  const query = new URLSearchParams({ cart_token: cart.token }).toString();
  const response = await fetch(
    `${apiUrl}carts/${cart.id}/complete_test_payment/?${query}`,
    { method: 'POST', mode: 'cors' }
  );
  if (!response.ok) {
    let message = 'Unable to complete the test order.';
    try {
      const data = await response.json();
      message = data.message || data.errorMessage || message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  const data = await response.json();
  return data.invoice;
}

async function createPaymentIntent(apiUrl: string, cart: any, paymentMethodType?: string) {
  const { id, token } = cart;
  const fetchOptions: any = {
    method: 'GET',
    mode: 'cors',
  };
  const queryParams: any[] = [['cart_token', token]];

  if (paymentMethodType) {
    queryParams.push(['payment_method_types', paymentMethodType]);
  }

  const queryString = new URLSearchParams(queryParams).toString();
  const uri = `stripe/payment_intent/cart/${id}/`
  const url = `${apiUrl}${uri}?${queryString}`;

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create payment intent.");
  }

  return data;
}

async function completeZeroBalanceCheckout(apiUrl: string, cart: any) {
  const url = `${apiUrl.replace(/\/$/, '')}/payments/stripe/cart/${cart.id}/attempts/`;
  const query = new URLSearchParams({ cart_token: cart.token }).toString();
  const response = await fetch(`${url}?${query}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestKey: `zero-balance:${cart.id}:${Date.now()}`,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Unable to complete this order.');
  }
  if (!data.invoice) {
    throw new Error('Unable to complete this order.');
  }
  return data.invoice;
}

async function checkPaymentIntnetIsComplete(apiUrl: string, cart: any) {
  const url = `stripe/payment_intent/cart/complete/${cart.id}/`;
  const fetchOptions: any = {
    method: 'GET',
    mode: 'cors',
  };
  const queryString = new URLSearchParams({cart_token: cart.token}).toString();

  const response = await fetch(`${apiUrl}${url}?${queryString}`, fetchOptions);
  
  if (!response.ok) {
    throw new Error("Failed to check if payment intent is complete.");
  }
  const i = await response.json();
  return i.invoice;
}

export async function stripeCardFormSubmit(apiUrl: string, stripe: any, card: any, cart: any) {
  try {
    if ((cart.totalCost ?? 0) <= 0) {
      return await completeZeroBalanceCheckout(apiUrl, cart);
    }
    const intent = await createPaymentIntent(apiUrl, cart);
    if (intent.zeroBalance) {
      return await checkPaymentIntnetIsComplete(apiUrl, cart);
    }
    const stripePayment = await stripe.confirmCardPayment(intent.stripeClientSecret, { payment_method: { card } });

    if (stripePayment.error) {
      throw new Error(stripePayment.error.message || 'Stripe connect unknown error');
    }

    return await checkPaymentIntnetIsComplete(apiUrl, cart);
  } catch (e) {
    throw e;
  }
}

export async function stripePaymentButtonSubmit(
  apiUrl: string,
  stripe: any,
  cart: any,
  paymentMethodEvent: PaymentRequestPaymentMethodEvent
) {
  const { complete, paymentMethod } = paymentMethodEvent;

  try {
    if ((cart.totalCost ?? 0) <= 0) {
      return await completeZeroBalanceCheckout(apiUrl, cart);
    }
    const intent = await createPaymentIntent(apiUrl, cart);
    if (intent.zeroBalance) {
      return await checkPaymentIntnetIsComplete(apiUrl, cart);
    }
    const stripePayment = await stripe.confirmCardPayment(
      intent.stripeClientSecret,
      { payment_method: paymentMethod.id },
      { handleActions: false }
    );

    if (stripePayment.error) {
      throw new Error(stripePayment.error.message || 'Stripe unknown error');
    }

    complete('success');
    return await checkPaymentIntnetIsComplete(apiUrl, cart);

  } catch (e) {
    complete('fail');
    throw e;
  }
}
