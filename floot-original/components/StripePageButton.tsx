// Floot Payments: opens a Stripe page (Checkout, portal, payment link) in a popup or the in-app browser
import { useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "./Button";

type Props = {
  getUrl: () => Promise<string>;
  children: ReactNode;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

export function StripePageButton({ getUrl, children, onError, disabled, className }: Props) {
  const [isOpening, setIsOpening] = useState(false);

  const openStripePage = async () => {
    const popup = Capacitor.isNativePlatform() ? null : window.open("about:blank", "stripe_page");
    setIsOpening(true);
    try {
      const url = await getUrl();
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
    } catch (error) {
      popup?.close();
      onError?.(error instanceof Error ? error.message : "Could not open the payment page");
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button type="button" className={className} disabled={disabled || isOpening} onClick={openStripePage}>
      {children}
    </Button>
  );
}
