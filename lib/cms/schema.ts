// CMS schema — the admin's own tables, kept separate from anything the public sites read.
//
// SQLite in both environments (a local file in development, Turso in production), so the
// same SQL and the same migrations run everywhere. Column names are snake_case and
// timestamps are ISO-8601 `TEXT` in GMT, matching lib/booking.ts.
//
// Two halves, one file: the auth surface (users, sessions, rate_limits, audit_log — Phase 1)
// and the content surface (properties, property_media, settings — Phase 2). The CHECK
// constraints mirror docs/cms-build-spec.md §4 verbatim; they are the last line of defence
// behind the zod schemas, so a bad row cannot be written even by a script or a pasted SQL
// statement.

import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { PROPERTY_STATUSES } from "../properties";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Stored lowercased so sign-in is case-insensitive without a collation. */
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name").notNull().default(""),
  role: text("role", { enum: ["admin", "editor"] }).notNull(),
  /** argon2id, via @node-rs/argon2. Never leaves the server. */
  passwordHash: text("password_hash").notNull(),
  /** Set for a new user or after an admin reset; cleared when they choose a password. */
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(true),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  /** ISO timestamp while a lockout is in force, otherwise null. */
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** sha256 of the cookie value: a dump of this table cannot be replayed as a session. */
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    /** sha256(ip + IP_HASH_SALT) - coarse enough to spot abuse, not a raw IP store. */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

/** Fixed-window counters for sign-in throttling. No extra service required. */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: text("window_start").notNull(),
  count: integer("count").notNull(),
});

/** Who changed what, when: the substitute for git history that content in a database gives up. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    payload: text("payload"),
  },
  (table) => [index("audit_log_at_idx").on(table.at)],
);

// ---------------------------------------------------------------------------------------
// Content: the property catalogue both public sites read (Phase 2)
// ---------------------------------------------------------------------------------------

/**
 * Where an image sits in a property: the grid card, the drawer's opening shot, the rest.
 *
 * Unlike PROPERTY_STATUSES (which the public types also need, so it lives in lib/properties.ts),
 * this is an admin-only idea: the public Property type has `image`, `hero` and `gallery` fields,
 * not roles.
 */
export const PROPERTY_MEDIA_ROLES = ["card", "hero", "gallery"] as const;

export const properties = sqliteTable(
  "properties",
  {
    /** The `?property=` deep-link value. Immutable after create: renaming it would break
     *  every shared link and the interior site's cards, so the API refuses a slug change. */
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    status: text("status", { enum: PROPERTY_STATUSES }).notNull(),
    /** Grid order *and* drawer pager order — user-visible, rewritten only by reorder. */
    position: integer("position").notNull(),
    /** `meta` and `price` render exactly as written, and a value with no digits is treated
     *  as unfinished and hidden — the rule the drawer already applies. */
    meta: text("meta").notNull().default(""),
    price: text("price").notNull().default(""),
    description: text("description").notNull().default(""),
    /** The four JSON columns, validated by zod against the shapes in lib/properties.ts. */
    intro: text("intro").notNull().default("[]"),
    highlights: text("highlights").notNull().default("[]"),
    specs: text("specs").notNull().default("[]"),
    amenities: text("amenities").notNull().default("[]"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    /** Who put it live and when: the list shows both, so "who published this?" needs no audit dig. */
    publishedAt: text("published_at"),
    publishedBy: text("published_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull().default(""),
  },
  (table) => [
    index("properties_position_idx").on(table.position),
    check(
      "properties_status_check",
      sql`${table.status} in ('Available', 'Under construction', 'Sold', 'Coming soon')`,
    ),
  ],
);

export const propertyMedia = sqliteTable(
  "property_media",
  {
    id: text("id").primaryKey(),
    slug: text("slug")
      .notNull()
      .references(() => properties.slug, { onDelete: "cascade" }),
    role: text("role", { enum: PROPERTY_MEDIA_ROLES }).notNull(),
    position: integer("position").notNull().default(0),
    /** The R2 object key. The public URL is derived from it, never stored twice. */
    r2Key: text("r2_key").notNull(),
    /** Required for hero and gallery images: alt text is the public site's accessibility. */
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("property_media_slug_idx").on(table.slug, table.role, table.position),
    check("property_media_role_check", sql`${table.role} in ('card', 'hero', 'gallery')`),
  ],
);

/** Business details (phone, email, WhatsApp, hours, address, footer links) as key/value pairs. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
});

export type UserRole = (typeof users.role.enumValues)[number];
export type UserStatus = (typeof users.status.enumValues)[number];
export type PropertyStatusValue = (typeof properties.status.enumValues)[number];
export type PropertyMediaRole = (typeof propertyMedia.role.enumValues)[number];

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
export type PropertyRow = typeof properties.$inferSelect;
export type PropertyMediaRow = typeof propertyMedia.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
