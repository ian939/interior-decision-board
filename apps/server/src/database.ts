import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth.js";
import type { AppConfig } from "./config.js";

export type DbRow = Record<string, unknown>;

const DEFAULT_SPACES = [
  "방 1",
  "방 2",
  "방 3",
  "방 4",
  "화장실 1",
  "화장실 2",
  "거실",
  "주방",
  "베란다",
  "현관",
  "공용/여러 공간",
  "미정",
];

export function now(): string {
  return new Date().toISOString();
}

export function createId(): string {
  return randomUUID();
}

export function initializeDatabase(appConfig: AppConfig): DatabaseSync {
  const db = new DatabaseSync(appConfig.databasePath, { timeout: 5_000 });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL UNIQUE CHECK (role IN ('owner', 'partner')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      is_unassigned INTEGER NOT NULL DEFAULT 0 CHECK (is_unassigned IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL CHECK (status IN ('decision_needed', 'reviewing', 'supplement', 'approved', 'requested', 'dropped')),
      source_url TEXT,
      source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'reels', 'blog', 'shopping', 'web', 'image', 'file', 'other')),
      source_channel TEXT NOT NULL CHECK (source_channel IN ('web', 'telegram')),
      source_note TEXT,
      topic_tags TEXT NOT NULL DEFAULT '[]',
      ai_status TEXT NOT NULL CHECK (ai_status IN ('queued', 'processing', 'ready', 'failed', 'manual')),
      ai_error TEXT,
      metadata_quality TEXT CHECK (metadata_quality IN ('full', 'partial', 'unavailable')),
      thumbnail_remote_url TEXT,
      thumbnail_attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
      supplement_request TEXT,
      dropped_reason TEXT,
      approval_reason TEXT,
      approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      approved_at TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS card_spaces (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      PRIMARY KEY (card_id, space_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('source', 'thumbnail', 'supplement')),
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS preferences (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      value TEXT NOT NULL CHECK (value IN ('like', 'dislike', 'hold')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (card_id, user_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS related_sources (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      url TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'reels', 'blog', 'shopping', 'web', 'image', 'file', 'other')),
      ai_status TEXT NOT NULL CHECK (ai_status IN ('queued', 'processing', 'ready', 'failed', 'manual')),
      thumbnail_remote_url TEXT,
      thumbnail_attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
      attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS comparisons (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL CHECK (action IN ('approved', 'revoked')),
      reason TEXT,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS work_requests (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('analyze_card', 'analyze_related', 'compare', 'draft_work_request')),
      payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 2,
      last_error TEXT,
      run_after TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS telegram_accounts (
      telegram_user_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS planner_layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_cards_status_updated ON cards(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_card_created ON comments(card_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_related_card_created ON related_sources(card_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_card_created ON activity_logs(card_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after ON jobs(status, run_after);
    CREATE INDEX IF NOT EXISTS idx_planner_layouts_updated ON planner_layouts(updated_at DESC);
  `);

  seedSpaces(db);
  seedUsers(db, appConfig);
  seedTelegramAccounts(db, appConfig);
  return db;
}

function seedSpaces(db: DatabaseSync): void {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM spaces").get() as DbRow;
  if (Number(countRow.count) > 0) return;
  const insert = db.prepare(
    "INSERT INTO spaces (id, name, sort_order, active, is_unassigned, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
  );
  const timestamp = now();
  db.exec("BEGIN");
  try {
    DEFAULT_SPACES.forEach((name, index) => {
      insert.run(createId(), name, index, name === "미정" ? 1 : 0, timestamp, timestamp);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedUsers(db: DatabaseSync, appConfig: AppConfig): void {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM users").get() as DbRow;
  if (Number(countRow.count) > 0) return;
  if (!appConfig.ownerPassword || !appConfig.partnerPassword) {
    console.warn("사용자가 아직 생성되지 않았습니다. OWNER_PASSWORD와 PARTNER_PASSWORD를 설정한 뒤 재시작하세요.");
    return;
  }
  const insert = db.prepare(
    "INSERT INTO users (id, name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const timestamp = now();
  db.exec("BEGIN");
  try {
    insert.run(createId(), appConfig.ownerName, "owner", hashPassword(appConfig.ownerPassword), timestamp, timestamp);
    insert.run(createId(), appConfig.partnerName, "partner", hashPassword(appConfig.partnerPassword), timestamp, timestamp);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedTelegramAccounts(db: DatabaseSync, appConfig: AppConfig): void {
  const rows = db.prepare("SELECT id, role FROM users").all() as DbRow[];
  const insert = db.prepare(
    "INSERT INTO telegram_accounts (telegram_user_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(telegram_user_id) DO UPDATE SET user_id = excluded.user_id",
  );
  for (const row of rows) {
    const telegramId = row.role === "owner" ? appConfig.telegramOwnerId : appConfig.telegramPartnerId;
    if (telegramId) insert.run(telegramId, String(row.id), now());
  }
}
