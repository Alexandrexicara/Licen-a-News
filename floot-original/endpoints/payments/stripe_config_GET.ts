import { getPaymentsClientConfig } from "@floot/payments";
import { OutputType } from "./stripe_config_GET.schema";

export async function handle() {
  try {
    const { publishableKey, stripeAccountId } = await getPaymentsClientConfig();
    return Response.json({ publishableKey, stripeAccountId } satisfies OutputType, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Payments are temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
