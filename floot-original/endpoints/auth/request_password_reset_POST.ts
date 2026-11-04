import { db } from "../../helpers/db";
import { sql } from "kysely";
import { createHash, randomInt } from "crypto";
import { sendEmail } from "@floot/email";
import superjson from "superjson";
import { schema } from "./request_password_reset_POST.schema";

// Who the code comes from. Until an email domain is verified in the Email tab,
// Floot sends from its own domain (keeping the display name) and delivers ONLY
// to the project owner, so the owner can always reset their own account. Once
// a domain is verified, change the address to one on that domain so every user
// receives their own code.
const RESET_EMAIL_FROM = "Account <noreply@example.com>";

const CODE_TTL_MINUTES = 15;
const MAX_CODES_PER_HOUR = 3;

// The address is stored data, so it is escaped before it goes into HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Same function in reset_password_POST: keep the two in step.
function hashResetCode(userId: number, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email } = schema.parse(json);
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    const user = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where(sql`LOWER(users.email)`, "=", normalizedEmail)
      .orderBy("id")
      .executeTakeFirst();

    if (user) {
      const recent = await db
        .selectFrom("passwordResetCodes")
        .select(db.fn.countAll<number>().as("count"))
        .where("userId", "=", user.id)
        .where("createdAt", ">=", new Date(now.getTime() - 60 * 60 * 1000))
        .executeTakeFirst();

      if (Number(recent?.count ?? 0) < MAX_CODES_PER_HOUR) {
        const code = randomInt(0, 100_000_000).toString().padStart(8, "0");

        await db.transaction().execute(async (trx) => {
          // Only the newest code works.
          await trx
            .updateTable("passwordResetCodes")
            .set({ usedAt: now })
            .where("userId", "=", user.id)
            .where("usedAt", "is", null)
            .execute();
          await trx
            .insertInto("passwordResetCodes")
            .values({
              userId: user.id,
              codeHash: hashResetCode(user.id, code),
              expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
            })
            .execute();
        });

        const text = `Your password reset code for ${user.email} is ${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you did not ask to reset your password, ignore this email.`;
        const result = await sendEmail({
          from: RESET_EMAIL_FROM,
          to: user.email,
          subject: "Your password reset code",
          text,
          html: `<p>Your password reset code for <strong>${escapeHtml(user.email)}</strong> is:</p><p style="font-size:28px;font-weight:600;letter-spacing:4px;font-family:monospace">${code}</p><p>It expires in ${CODE_TTL_MINUTES} minutes. If you did not ask to reset your password, ignore this email.</p>`,
        });
        if (!result.ok) {
          console.error(
            "Password reset email failed:",
            result.error.code,
            result.error.message
          );
        }
      }
    }

    // The same answer whether or not the account exists.
    return new Response(superjson.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Password reset request error:", error);
    return new Response(
      superjson.stringify({ message: "Could not send a reset code" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
