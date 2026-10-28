import { vi } from "vitest";

// Mock factories run only when a test (indirectly) imports the module, so
// tests that never touch the DB don't pay for starting Postgres.
vi.mock("@/db", () => import("./db"));
vi.mock("@/lib/auth", () => import("./auth"));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
