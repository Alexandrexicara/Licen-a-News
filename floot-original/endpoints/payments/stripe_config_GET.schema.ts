import { z } from "zod";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  publishableKey: string;
  stripeAccountId: string;
};

export const getPaymentsStripeConfig = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/payments/stripe_config`, {
    method: "GET",
    cache: "no-store",
    ...init,
  });
  if (!result.ok) {
    const errorBody = (await result.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? "Payments are temporarily unavailable");
  }
  return result.json();
};