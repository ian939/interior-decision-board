import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../apps/server/dist/auth.js";

const projectRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(projectRoot, ".env");
if (!existsSync(envPath)) throw new Error(".env 파일이 없습니다.");
loadEnvFile(envPath);

const credentials = [
  ["owner", process.env.OWNER_PASSWORD],
  ["partner", process.env.PARTNER_PASSWORD],
];
for (const [role, password] of credentials) {
  if (!password || password.length < 8) throw new Error(`${role} 비밀번호는 8자 이상이어야 합니다.`);
}

const configuredDataDir = process.env.DATA_DIR ?? "data";
const dataDir = isAbsolute(configuredDataDir) ? configuredDataDir : resolve(projectRoot, configuredDataDir);
const databasePath = resolve(dataDir, "interior.sqlite");
if (!existsSync(databasePath)) throw new Error(`데이터베이스가 없습니다: ${databasePath}`);

const database = new DatabaseSync(databasePath);
try {
  const update = database.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE role = ?");
  const timestamp = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const [role, password] of credentials) {
      const result = update.run(hashPassword(password), timestamp, role);
      if (Number(result.changes) !== 1) throw new Error(`${role} 사용자를 찾지 못했습니다.`);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
} finally {
  database.close();
}

console.log(JSON.stringify({ ok: true, updatedRoles: ["owner", "partner"] }));
