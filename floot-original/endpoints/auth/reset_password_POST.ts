import { db } from "../../helpers/db";
import { sql } from "kysely";
import { createHash, timingSafeEqual } from "crypto";
import superjson from "superjson";
import { schema } from "./reset_password_POST.schema";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";

const MAX_ATTEMPTS_PER_CODE = 5;

// Same function in request_password_reset_POST: keep the two in step.
function hashResetCode(userId: number, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function invalidCode() {
  return new Response(
    superjson.stringify({
      message: "That code is wrong or has expired. Request a new one.",
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, code, newPassword } = schema.parse(json);
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    const user = await db
      .selectFrom("users")
      .select(["id"])
      .where(sql`LOWER(users.email)`, "=", normalizedEmail)
      .orderBy("id")
      .executeTakeFirst();
    if (!user) return invalidCode();

    const outcome = await db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("passwordResetCodes")
        .select(["id", "codeHash", "expiresAt", "attempts"])
        .where("userId", "=", user.id)
        .where("usedAt", "is", null)
        .orderBy("createdAt", "desc")
        .limit(1)
        .forUpdate()
        .executeTakeFirst();

      if (
        !row ||
        new Date(row.expiresAt) <= now ||
        row.attempts >= MAX_ATTEMPTS_PER_CODE
      ) {
        return "invalid" as const;
      }

      const expected = Buffer.from(row.codeHash, "hex");
      const actual = Buffer.from(hashResetCode(user.id, code.replace(/\s/g, "")), "hex");
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        await trx
          .updateTable("passwordResetCodes")
          .set({ attempts: row.attempts + 1 })
          .where("id", "=", row.id)
          .execute();
        return "invalid" as const;
      }

      const passwordHash = await generatePasswordHash(newPassword);
      await trx
        .insertInto("userPasswords")
        .values({ userId: user.id, passwordHash })
        .onConflict((oc) => oc.column("userId").doUpdateSet({ passwordHash }))
        .execute();
      await trx
        .updateTable("passwordResetCodes")
        .set({ usedAt: now })
        .where("id", "=", row.id)
        .execute();
      // Sign out everywhere, and lift a login lockout from earlier attempts.
      await trx.deleteFrom("sessions").where("userId", "=", user.id).execute();
      await trx
        .deleteFrom("loginAttempts")
        .where(sql`LOWER(email)`, "=", normalizedEmail)
        .where("success", "=", false)
        .execute();
      return "ok" as const;
    });

    if (outcome === "invalid") return invalidCode();
    return new Response(superjson.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const message =
      error instanceof Error ? error.message : "Could not reset the password";
    return new Response(superjson.stringify({ message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
