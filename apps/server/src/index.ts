import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { initializeDatabase } from "./database.js";
import { Store } from "./store.js";
import { ClaudeClient } from "./claude.js";
import { JobWorker } from "./worker.js";
import { TelegramListener } from "./telegram.js";
import { registerRoutes } from "./routes.js";

const database = initializeDatabase(config);
const store = new Store(database);
const claude = new ClaudeClient(config);
const worker = new JobWorker(store, claude, config);
const telegram = new TelegramListener(store, worker, config);
const app = Fastify({ logger: false, bodyLimit: config.maxUploadBytes + 1024 * 1024 });

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.origins.includes(origin)) return callback(null, true);
    return callback(new Error("허용되지 않은 Origin입니다."), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["authorization", "content-type"],
  maxAge: 600,
});
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: { files: 1, fileSize: config.maxUploadBytes, fields: 10, parts: 11 },
});

registerRoutes(app, store, worker, claude, config);

app.setErrorHandler((error, _request, reply) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (message.includes("Origin")) return void reply.code(403).send({ error: "허용되지 않은 웹 출처입니다." });
  if (code === "FST_REQ_FILE_TOO_LARGE") return void reply.code(413).send({ error: "파일 크기가 제한을 초과했습니다." });
  console.error(error);
  void reply.code(500).send({ error: "서버 오류가 발생했습니다." });
});

await app.listen({ host: config.host, port: config.port });
console.info(`Interior Decision API: http://${config.host}:${config.port}`);
const recoveredJobs = store.recoverInterruptedJobs();
if (recoveredJobs > 0) console.info(`중단된 작업 ${recoveredJobs}개를 다시 대기열에 넣었습니다.`);
worker.start();
telegram.start();

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  worker.stop();
  await telegram.stop();
  await app.close();
  database.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
