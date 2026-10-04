/**
 * Creates the first admin account (sign-up is disabled in the app).
 *
 *   pnpm create-admin <email> "<name>"
 *
 * Prompts for the password. Later users are invited from /admin/users.
 */
import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Usage: pnpm create-admin <email> "<name>"');
    process.exit(1);
  }

  // Imported after dotenv so DATABASE_URL is set.
  const { db } = await import("../src/db");
  const { account, user } = await import("../src/db/schema");

  const normalized = email.toLowerCase();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, normalized));
  if (existing) {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
    console.log(`${normalized} already exists — promoted to admin.`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password (min 8 chars): ");
  rl.close();
  if (password.length < 8) {
    console.error("Password too short.");
    process.exit(1);
  }

  const userId = crypto.randomUUID();
  await db.batch([
    db.insert(user).values({ id: userId, email: normalized, name, role: "admin", emailVerified: true }),
    db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(password),
    }),
  ]);
  console.log(`Admin ${normalized} created. Sign in at ${process.env.BETTER_AUTH_URL}/login`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
