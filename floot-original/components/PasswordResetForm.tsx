import React, { useState } from "react";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import styles from "./PasswordResetForm.module.css";
import {
  schema as requestSchema,
  postRequestPasswordReset,
} from "../endpoints/auth/request_password_reset_POST.schema";
import { postResetPassword } from "../endpoints/auth/reset_password_POST.schema";

const codeSchema = z.object({
  code: z.string().trim().min(1, "Enter the code from the email"),
  newPassword: z.string().min(8, "Use at least 8 characters"),
  confirmPassword: z.string().min(1, "Repeat the new password"),
});

interface PasswordResetFormProps {
  className?: string;
  defaultEmail?: string;
  /** Called after the password was changed (e.g. go back to the login form). */
  onDone: () => void;
  onCancel: () => void;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  className,
  defaultEmail = "",
  onDone,
  onCancel,
}) => {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm({
    defaultValues: { email: defaultEmail },
    schema: requestSchema,
  });
  const codeForm = useForm({
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
    schema: codeSchema,
  });

  const sendCode = async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await postRequestPasswordReset({ email });
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a reset code");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: z.infer<typeof codeSchema>) => {
    if (!sentTo) return;
    if (data.newPassword !== data.confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await postResetPassword({
        email: sentTo,
        code: data.code,
        newPassword: data.newPassword,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setIsLoading(false);
    }
  };

  if (!sentTo) {
    return (
      <Form {...emailForm}>
        <form
          onSubmit={emailForm.handleSubmit((data) => sendCode(data.email))}
          className={`${styles.form} ${className || ""}`}
        >
          <p className={styles.intro}>
            Enter your account email and we will send you a code to choose a new
            password.
          </p>
          {error && <div className={styles.errorMessage}>{error}</div>}
          <FormItem name="email">
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                disabled={isLoading}
                value={emailForm.values.email}
                onChange={(e) =>
                  emailForm.setValues((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <Button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? "Sending..." : "Send code"}
          </Button>
          <button type="button" className={styles.linkButton} onClick={onCancel}>
            Back to log in
          </button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...codeForm}>
      <form
        onSubmit={codeForm.handleSubmit(resetPassword)}
        className={`${styles.form} ${className || ""}`}
      >
        <p className={styles.intro}>
          If an account exists for {sentTo}, a code is on its way. It expires in
          15 minutes.
        </p>
        {error && <div className={styles.errorMessage}>{error}</div>}
        <FormItem name="code">
          <FormLabel>Code</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="12345678"
              disabled={isLoading}
              value={codeForm.values.code}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, code: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="newPassword">
          <FormLabel>New password</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.newPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, newPassword: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="confirmPassword">
          <FormLabel>Repeat new password</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.confirmPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <Button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? "Saving..." : "Set new password"}
        </Button>
        <button
          type="button"
          className={styles.linkButton}
          disabled={isLoading}
          onClick={() => sendCode(sentTo)}
        >
          Send a new code
        </button>
        <button type="button" className={styles.linkButton} onClick={onCancel}>
          Back to log in
        </button>
      </form>
    </Form>
  );
};
