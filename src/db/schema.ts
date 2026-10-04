import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (core + admin plugin fields)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

/**
 * Folders form a tree via `parentId`. `path` is the materialized list of
 * ancestor ids *including the folder itself*, joined by "/" (e.g. "a/b/c").
 * Ids never change, so renames don't touch `path`; moves rewrite the prefix
 * of the whole subtree.
 */
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    path: text("path").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    index("folders_parent_idx").on(t.parentId),
    index("folders_path_idx").on(t.path.op("text_pattern_ops")),
    index("folders_deleted_idx").on(t.deletedAt),
    // Sibling folder names are unique (ignoring trashed ones).
    uniqueIndex("folders_sibling_name_uq")
      .on(sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const fileStatus = pgEnum("file_status", ["uploading", "ready"]);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    /** Object key of the original in R2. */
    r2Key: text("r2_key").notNull().unique(),
    /** Object key of the generated WebP thumbnail, if one was uploaded. */
    thumbKey: text("thumb_key"),
    width: bigint("width", { mode: "number" }),
    height: bigint("height", { mode: "number" }),
    durationMs: bigint("duration_ms", { mode: "number" }),
    status: fileStatus("status").notNull().default("uploading"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    index("files_folder_idx").on(t.folderId),
    index("files_deleted_idx").on(t.deletedAt),
    index("files_status_created_idx").on(t.status, t.createdAt),
  ],
);

export const folderRole = pgEnum("folder_role", ["viewer", "editor", "owner"]);

/**
 * A grant on a folder applies to the whole subtree. A user's effective role on
 * a folder is the highest role granted on that folder or any ancestor.
 */
export const folderPermissions = pgTable(
  "folder_permissions",
  {
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: folderRole("role").notNull(),
    grantedBy: text("granted_by").references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.folderId, t.userId] }),
    index("folder_permissions_user_idx").on(t.userId),
  ],
);

export const shareLinkKind = pgEnum("share_link_kind", ["folder", "files"]);

/**
 * A public link: anyone holding `token` may view, no sign-in needed. A
 * "folder" link exposes the folder's whole subtree; a "files" link exposes
 * only the files listed in `share_link_files`, which all live in `folderId`.
 * Links stop working once expired, once the folder is trashed, or once the
 * creator loses edit access to the folder.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    kind: shareLinkKind("kind").notNull(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    /** Null: never expires. */
    expiresAt: timestamp("expires_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("share_links_folder_idx").on(t.folderId),
    index("share_links_expires_idx").on(t.expiresAt),
  ],
);

export const shareLinkFiles = pgTable(
  "share_link_files",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.linkId, t.fileId] }),
    index("share_link_files_file_idx").on(t.fileId),
  ],
);

export const foldersRelations = relations(folders, ({ many }) => ({
  files: many(files),
  permissions: many(folderPermissions),
}));

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
}));

export const folderPermissionsRelations = relations(
  folderPermissions,
  ({ one }) => ({
    folder: one(folders, {
      fields: [folderPermissions.folderId],
      references: [folders.id],
    }),
    user: one(user, { fields: [folderPermissions.userId], references: [user.id] }),
  }),
);

export type Folder = typeof folders.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type FolderRole = (typeof folderRole.enumValues)[number];
export type ShareLink = typeof shareLinks.$inferSelect;
