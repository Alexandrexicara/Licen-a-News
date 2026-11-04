// Floot Payments: in-app card form (pay or save card)
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "./Button";
import { usePaymentsReturn } from "../helpers/usePaymentsReturn";
import { getPaymentsStripeConfig } from "../endpoints/payments/stripe_config_GET.schema";
import styles from "./StripePaymentForm.module.css";

type Props = {
  clientSecret: string;
  clientSecretType: "payment" | "setup";
  returnUrl: string;
  submitLabel: string;
  onConfirmed: () => void;
  onError?: (message: string) => void;
  className?: string;
};

function ConfirmForm({
  clientSecretType,
  returnUrl,
  submitLabel,
  onConfirmed,
  onError,
}: Omit<Props, "clientSecret" | "className">) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePaymentsReturn((paymentsReturn) => {
    if (paymentsReturn.kind === clientSecretType) onConfirmed();
  });

  const showError = (message: string) => {
    setErrorMessage(message);
    onError?.(message);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const confirmArgs = {
      elements,
      confirmParams: {
        return_url: Capacitor.isNativePlatform() ? returnUrl : window.location.href,
      },
      redirect: "if_required" as const,
    };
    try {
      const result =
        clientSecretType === "setup"
          ? await stripe.confirmSetup(confirmArgs)
          : await stripe.confirmPayment(confirmArgs);
      if (result.error) {
        showError(result.error.message ?? "Payment failed");
        return;
      }
      onConfirmed();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <PaymentElement onLoadError={(event) => showError(event.error.message ?? "The payment form could not load")} />
      <Button type="submit" disabled={!stripe || isSubmitting}>
        {isSubmitting ? "Processing…" : submitLabel}
      </Button>
      {errorMessage && <p className={styles.error}>{errorMessage}</p>}
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  className,
  ...confirmProps
}: Props) {
  const stripeConfigQuery = useQuery({
    queryKey: ["payments", "stripeConfig"],
    queryFn: () => getPaymentsStripeConfig(),
    staleTime: 0,
    gcTime: 0,
  });
  const publishableKey = stripeConfigQuery.data?.publishableKey;
  const stripeAccountId = stripeConfigQuery.data?.stripeAccountId;
  const stripePromise = useMemo(
    () =>
      publishableKey && stripeAccountId
        ? loadStripe(publishableKey, { stripeAccount: stripeAccountId })
        : null,
    [publishableKey, stripeAccountId],
  );
  if (stripeConfigQuery.isError) {
    return (
      <div className={className}>
        <p className={styles.error}>{stripeConfigQuery.error.message}</p>
      </div>
    );
  }
  if (!stripePromise) {
    return <div className={className} />;
  }
  return (
    <div className={className}>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <ConfirmForm {...confirmProps} />
      </Elements>
    </div>
  );
}
