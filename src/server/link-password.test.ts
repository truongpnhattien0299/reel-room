import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { POST as viewLink } from "@/app/api/s/[token]/view/route";
import { GET as fileContent } from "@/app/api/s/[token]/files/[fileId]/content/route";
import { POST as zipList } from "@/app/api/s/[token]/downloads/route";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { clearCookies } from "../../test/setup/headers";
import { createShareLink, unlockShareLink, updateShareLink } from "./actions";
import { hashLinkPassword, verifyLinkPassword } from "./link-password";
import { resolveShareLink } from "./share-links";

beforeEach(async () => {
  await resetDb();
  clearCookies();
  signIn(null);
});
afterEach(() => vi.useRealTimers());

/** An editor's folder link, made through the action so the password gets hashed. */
async function setup(opts: { password?: string; allowDownload?: boolean } = {}) {
  const owner = await makeUser();
  const folder = await makeFolder(owner);
  await grant(owner, folder, "owner");
  const file = await makeFile(folder, owner);
  signIn(sessionFor(owner));
  const res = await createShareLink({ folderId: folder.id, expiresAt: null, ...opts });
  signIn(null);
  const link = (await db.query.shareLinks.findFirst({ where: eq(shareLinks.token, res.data!.token) }))!;
  return { owner, folder, file, link, token: link.token };
}

const stats = async (id: string) =>
  (await db.query.shareLinks.findFirst({ where: eq(shareLinks.id, id) }))!;

describe("link passwords", () => {
  it("hashes with a salt and checks without storing the password", async () => {
    const a = await hashLinkPassword("hunter2");
    expect(a).not.toContain("hunter2");
    expect(await hashLinkPassword("hunter2")).not.toBe(a);
    expect(await verifyLinkPassword("hunter2", a)).toBe(true);
    expect(await verifyLinkPassword("hunter3", a)).toBe(false);
  });

  it("keeps a link locked until this browser types the password", async () => {
    const { owner, link, token } = await setup({ password: "secret" });
    expect(link.passwordHash).not.toBe("secret");
    expect(await resolveShareLink(token)).toEqual({ status: "locked", linkId: link.id });

    expect((await unlockShareLink(token, "wrong")).error).toBe("Mật khẩu không đúng");
    expect((await resolveShareLink(token)).status).toBe("locked");
    expect((await unlockShareLink(token, "secret")).error).toBeUndefined();
    expect((await resolveShareLink(token)).status).toBe("ok");

    // Another browser still has to type it.
    clearCookies();
    expect((await resolveShareLink(token)).status).toBe("locked");
    await unlockShareLink(token, "secret");

    // A new password voids the cookie handed out for the old one.
    signIn(sessionFor(owner));
    await updateShareLink(link.id, { password: "another" });
    signIn(null);
    expect((await resolveShareLink(token)).status).toBe("locked");

    // Removing it opens the link to everyone.
    signIn(sessionFor(owner));
    await updateShareLink(link.id, { password: null });
    clearCookies();
    expect((await resolveShareLink(token)).status).toBe("ok");
  });

  it("refuses every try for 15 minutes after 10 wrong ones", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { link, token } = await setup({ password: "secret" });
    for (let i = 0; i < 9; i++) expect((await unlockShareLink(token, "nope")).error).toBe("Mật khẩu không đúng");
    expect((await unlockShareLink(token, "nope")).error).toMatch(/Thử lại sau 15 phút/);
    // Even the right password, while locked.
    expect((await unlockShareLink(token, "secret")).error).toMatch(/Thử lại sau/);
    expect((await resolveShareLink(token)).status).toBe("locked");

    vi.setSystemTime(Date.now() + 15 * 60_000 + 1000);
    expect((await unlockShareLink(token, "secret")).error).toBeUndefined();
    expect((await stats(link.id)).failedAttempts).toBe(0);
  });

  it("rejects passwords outside 4–128 characters", async () => {
    const owner = await makeUser();
    const folder = await makeFolder(owner);
    await grant(owner, folder, "owner");
    signIn(sessionFor(owner));
    expect((await createShareLink({ folderId: folder.id, expiresAt: null, password: "abc" })).error).toBeDefined();
    expect((await createShareLink({ folderId: folder.id, expiresAt: null, password: "x".repeat(129) })).error).toBeDefined();
  });
});

const ctx = <T extends object>(params: T) => ({ params: Promise.resolve(params) });
const contentUrl = (token: string, fileId: string, download = false) =>
  `http://x/api/s/${token}/files/${fileId}/content${download ? "?download=1" : ""}`;

describe("public routes", () => {
  it("serves nothing through a locked link", async () => {
    const { file, token } = await setup({ password: "secret" });
    const res = await fileContent(new Request(contentUrl(token, file.id)), ctx({ token, fileId: file.id }));
    expect(res.status).toBe(404);
  });

  it("refuses downloads when the link turns them off", async () => {
    const { file, token, link } = await setup({ allowDownload: false });
    const res = await fileContent(new Request(contentUrl(token, file.id, true)), ctx({ token, fileId: file.id }));
    expect(res.status).toBe(403);
    const zip = await zipList(
      new Request("http://x", { method: "POST", body: JSON.stringify({ fileIds: [file.id] }) }),
      ctx({ token }),
    );
    expect(zip.status).toBe(403);
    expect((await stats(link.id)).downloadCount).toBe(0);
  });

  it("counts a visitor once a day, and never the folder's members", async () => {
    const { owner, token, link } = await setup();
    const visit = () => viewLink(new Request("http://x", { method: "POST" }), ctx({ token }));

    await visit();
    await visit();
    expect((await stats(link.id)).viewCount).toBe(1);
    expect((await stats(link.id)).lastViewedAt).not.toBeNull();

    clearCookies();
    await visit();
    expect((await stats(link.id)).viewCount).toBe(2);

    clearCookies();
    signIn(sessionFor(owner));
    await visit();
    expect((await stats(link.id)).viewCount).toBe(2);
  });
});
