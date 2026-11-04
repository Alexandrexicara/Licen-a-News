// Floot Payments: finds this mode's Stripe price by plan key, creating it on first use
import { stripeRequest } from "@floot/payments";

export type StripePlan = {
  key: string;
  name: string;
  amount: number;
  currency: string;
  interval?: "day" | "week" | "month" | "year";
};

async function getStripePriceIdByKey(key: string): Promise<string | null> {
  const prices = await stripeRequest<{ data: { id: string }[] }>({
    method: "GET",
    path: "/v1/prices",
    params: { lookup_keys: [key], active: true, limit: 1 },
  });
  return prices.data[0]?.id ?? null;
}

export async function getOrCreateStripePriceId(plan: StripePlan): Promise<string> {
  const existingPriceId = await getStripePriceIdByKey(plan.key);
  if (existingPriceId) return existingPriceId;
  const product = await stripeRequest<{ id: string }>({
    method: "POST",
    path: "/v1/products",
    params: { name: plan.name },
  });
  try {
    const price = await stripeRequest<{ id: string }>({
      method: "POST",
      path: "/v1/prices",
      params: {
        product: product.id,
        unit_amount: plan.amount,
        currency: plan.currency,
        lookup_key: plan.key,
        ...(plan.interval ? { recurring: { interval: plan.interval } } : {}),
      },
    });
    return price.id;
  } catch (error) {
    const racedPriceId = await getStripePriceIdByKey(plan.key);
    if (!racedPriceId) throw error;
    await stripeRequest({ method: "POST", path: "/v1/products/" + product.id, params: { active: false } });
    return racedPriceId;
  }
}
