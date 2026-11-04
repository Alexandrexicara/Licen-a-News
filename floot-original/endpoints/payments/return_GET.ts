import { renderPaymentsReturnPage } from "@floot/payments";

export async function handle(request: Request) {
  return renderPaymentsReturnPage(request);
}
