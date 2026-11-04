// Floot Payments: creates a Stripe Checkout page that returns through /_api/payments/return
import { getPaymentsReturnUrl, stripeRequest } from "@floot/payments";

export async function createStripeCheckoutSession(
  request: Request,
  params: Record<string, unknown>,
): Promise<{ id: string; url: string }> {
  const returnUrl = getPaymentsReturnUrl(request);
  return stripeRequest<{ id: string; url: string }>({
    method: "POST",
    path: "/v1/checkout/sessions",
    params: {
      ...params,
      success_url: returnUrl + "?checkoutSessionId={CHECKOUT_SESSION_ID}",
      cancel_url: returnUrl,
    },
  });
}
