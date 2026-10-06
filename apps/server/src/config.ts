import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { loadEnvFile } from "node:process";

const projectRoot = process.env.INIT_CWD ?? resolve(process.cwd(), "../..");
const envPath = resolve(projectRoot, ".env");
if (existsSync(envPath)) {
  try {
    loadEnvFile(envPath);
  } catch (error) {
    console.warn(`.env 파일을 읽지 못했습니다: ${String(error)}`);
  }
}

function pathFromRoot(value: string): string {
  return isAbsolute(value) ? value : resolve(projectRoot, value);
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dataDir = pathFromRoot(process.env.DATA_DIR ?? "data");
const uploadDir = pathFromRoot(process.env.UPLOAD_DIR ?? "uploads");
mkdirSync(dataDir, { recursive: true });
mkdirSync(uploadDir, { recursive: true });

const production = process.env.NODE_ENV === "production";
const configuredSecret = process.env.SESSION_SECRET?.trim();

if (production && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("운영 환경에서는 32자 이상의 SESSION_SECRET이 필요합니다.");
}

export const config = {
  projectRoot,
  production,
  host: process.env.HOST ?? "127.0.0.1",
  port: integer(process.env.PORT, 8787),
  origins: (process.env.APP_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicWebUrl: (process.env.PUBLIC_WEB_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  dataDir,
  uploadDir,
  databasePath: resolve(dataDir, "interior.sqlite"),
  maxUploadBytes: integer(process.env.MAX_UPLOAD_MB, 20) * 1024 * 1024,
  sessionSecret: configuredSecret ?? "development-only-secret-change-before-public-use",
  ownerName: process.env.OWNER_NAME?.trim() || "나",
  ownerPassword: process.env.OWNER_PASSWORD,
  partnerName: process.env.PARTNER_NAME?.trim() || "배우자",
  partnerPassword: process.env.PARTNER_PASSWORD,
  claudeCommand: process.env.CLAUDE_COMMAND?.trim() || "claude",
  claudeTimeoutMs: integer(process.env.CLAUDE_TIMEOUT_MS, 60_000),
  ytDlpCommand: process.env.YT_DLP_COMMAND?.trim() || "yt-dlp",
  ytDlpTimeoutMs: integer(process.env.YT_DLP_TIMEOUT_MS, 45_000),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
  telegramOwnerId: process.env.TELEGRAM_OWNER_ID?.trim(),
  telegramPartnerId: process.env.TELEGRAM_PARTNER_ID?.trim(),
};

export type AppConfig = typeof config;
