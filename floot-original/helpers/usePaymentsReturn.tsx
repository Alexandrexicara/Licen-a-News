// Floot Payments: listener for every Stripe return (checkout, payment, setup, canceled)
import { useEffect, useRef } from "react";

type PaymentsReturnMessage = {
  type: "PAYMENTS_RETURN";
  paymentIntentId: string | null;
  setupIntentId: string | null;
  checkoutSessionId: string | null;
  redirectStatus: string | null;
};

export type PaymentsReturn =
  | { kind: "payment"; paymentIntentId: string; redirectStatus: string | null }
  | { kind: "setup"; setupIntentId: string; redirectStatus: string | null }
  | { kind: "checkout"; checkoutSessionId: string }
  | { kind: "canceled" };

const URL_RETURN_PARAMS = [
  "payment_intent",
  "payment_intent_client_secret",
  "setup_intent",
  "setup_intent_client_secret",
  "redirect_status",
  "checkoutSessionId",
];

function getPaymentsReturn(message: PaymentsReturnMessage): PaymentsReturn {
  if (message.checkoutSessionId) {
    return { kind: "checkout", checkoutSessionId: message.checkoutSessionId };
  }
  if (message.paymentIntentId) {
    return {
      kind: "payment",
      paymentIntentId: message.paymentIntentId,
      redirectStatus: message.redirectStatus,
    };
  }
  if (message.setupIntentId) {
    return {
      kind: "setup",
      setupIntentId: message.setupIntentId,
      redirectStatus: message.redirectStatus,
    };
  }
  return { kind: "canceled" };
}

function takePaymentsReturnFromUrl(): PaymentsReturnMessage | null {
  const url = new URL(window.location.href);
  const message: PaymentsReturnMessage = {
    type: "PAYMENTS_RETURN",
    paymentIntentId: url.searchParams.get("payment_intent"),
    setupIntentId: url.searchParams.get("setup_intent"),
    checkoutSessionId: url.searchParams.get("checkoutSessionId"),
    redirectStatus: url.searchParams.get("redirect_status"),
  };
  if (!message.paymentIntentId && !message.setupIntentId && !message.checkoutSessionId) {
    return null;
  }
  for (const param of URL_RETURN_PARAMS) url.searchParams.delete(param);
  window.history.replaceState(window.history.state, "", url.toString());
  return message;
}

export function usePaymentsReturn(onReturn: (paymentsReturn: PaymentsReturn) => void) {
  const onReturnRef = useRef(onReturn);

  useEffect(() => {
    onReturnRef.current = onReturn;
  }, [onReturn]);

  useEffect(() => {
    const handledKeys = new Set<string>();
    const handleMessage = (message: PaymentsReturnMessage) => {
      const paymentsReturn = getPaymentsReturn(message);
      if (paymentsReturn.kind !== "canceled") {
        const key = JSON.stringify(paymentsReturn);
        if (handledKeys.has(key)) return;
        handledKeys.add(key);
      }
      onReturnRef.current(paymentsReturn);
    };
    const urlReturn = takePaymentsReturnFromUrl();
    if (urlReturn) handleMessage(urlReturn);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "PAYMENTS_RETURN") return;
      handleMessage(event.data as PaymentsReturnMessage);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
