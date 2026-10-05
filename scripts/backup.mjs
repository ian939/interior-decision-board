import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { backup, DatabaseSync } from "node:sqlite";

const projectRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(projectRoot, ".env");
if (existsSync(envPath)) loadEnvFile(envPath);

const absolute = (value) => (isAbsolute(value) ? value : resolve(projectRoot, value));
const dataDir = absolute(process.env.DATA_DIR ?? "data");
const uploadDir = absolute(process.env.UPLOAD_DIR ?? "uploads");
const backupRoot = absolute(process.env.BACKUP_DIR ?? "backups");
const retention = Math.max(1, Number.parseInt(process.env.BACKUP_RETENTION ?? "14", 10));
const databasePath = resolve(dataDir, "interior.sqlite");

if (!existsSync(databasePath)) throw new Error(`데이터베이스가 없습니다: ${databasePath}`);
await mkdir(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const destination = resolve(backupRoot, stamp);
if (relative(backupRoot, destination).startsWith("..")) throw new Error("백업 경로가 안전하지 않습니다.");
await mkdir(destination, { recursive: false });

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  await backup(database, resolve(destination, "interior.sqlite"));
} finally {
  database.close();
}

if (existsSync(uploadDir)) await cp(uploadDir, resolve(destination, "uploads"), { recursive: true });
await writeFile(
  resolve(destination, "manifest.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), databasePath, uploadDir }, null, 2),
  "utf8",
);

const backups = (await readdir(backupRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .reverse();
for (const oldName of backups.slice(retention)) {
  const oldPath = resolve(backupRoot, oldName);
  if (relative(backupRoot, oldPath).startsWith("..")) throw new Error("삭제할 백업 경로가 안전하지 않습니다.");
  await rm(oldPath, { recursive: true, force: false });
}

console.log(JSON.stringify({ ok: true, destination, retained: Math.min(backups.length, retention) }, null, 2));
