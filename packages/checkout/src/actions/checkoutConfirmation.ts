type CheckoutEntity = {
  id: number;
  totalCost?: number;
  client?: unknown;
};

type CheckoutConfirmation =
  | { confirmed: true; entity: CheckoutEntity }
  | { confirmed: false; error: unknown; statusCode?: number; message: string };

export async function confirmCheckoutSubmission(
  send: () => Promise<Response>,
  kind: 'order' | 'quote request',
  requireTestEntity = false,
): Promise<CheckoutConfirmation> {
  const unconfirmed = `We couldn't confirm your ${kind}. Check for a confirmation email or contact the store before submitting again.`;

  try {
    const response = await send();
    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.message;
      return {
        confirmed: false,
        error: payload,
        statusCode: response.status,
        message: response.status >= 400 && response.status < 500
          && typeof message === 'string' && message.trim()
          ? message
          : unconfirmed,
      };
    }

    const entity = kind === 'order' ? payload?.invoice : payload?.job;
    if (!Number.isSafeInteger(entity?.id) || entity.id <= 0) {
      throw new Error('Checkout response did not contain a valid confirmation ID.');
    }
    if (requireTestEntity && entity.isTest !== true) {
      throw new Error('The API did not confirm this was a test submission.');
    }
    return { confirmed: true, entity };
  } catch (error) {
    // A failed fetch or unreadable response can arrive after the API commits.
    // Do not retry a create request here.
    return { confirmed: false, error, message: unconfirmed };
  }
}
