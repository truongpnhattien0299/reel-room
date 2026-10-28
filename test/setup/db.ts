import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

/**
 * Stand-in for `@/db`: an in-memory Postgres per test file, with the real
 * migrations applied. Same drizzle API, except `batch`, which neon-http has
 * and PGlite lacks; it is emulated with one transaction on the single
 * connection (tests run their queries one at a time).
 */
const client = new PGlite({ extensions: { unaccent } });
const base = drizzle({ client, schema, casing: "snake_case" });

async function batch(queries: PromiseLike<unknown>[]) {
  await client.query("begin");
  try {
    const results = [];
    for (const q of queries) results.push(await q);
    await client.query("commit");
    return results;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

export const db = Object.assign(base, { batch });

await migrate(db, { migrationsFolder: "drizzle" });

/** Empties every table. Call in `beforeEach`. */
export async function resetDb() {
  await db.execute(sql`truncate
    share_link_files, share_links, folder_permissions, files, folders,
    invitations, session, account, verification, "user"
    cascade`);
}
