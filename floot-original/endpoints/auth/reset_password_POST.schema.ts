import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  email: z.string().email("Enter a valid email"),
  code: z.string().trim().min(1, "Enter the code from the email"),
  newPassword: z.string().min(8, "Use at least 8 characters"),
});

export type OutputType = { ok: true };

export const postResetPassword = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/reset_password`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!result.ok) {
    const errorData = superjson.parse<{ message: string }>(await result.text());
    throw new Error(errorData.message || "Could not reset the password");
  }

  return superjson.parse<OutputType>(await result.text());
};
