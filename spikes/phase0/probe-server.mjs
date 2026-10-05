import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const host = process.env.PROBE_HOST ?? "127.0.0.1";
const port = Number(process.env.PROBE_PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "https://ian939.github.io";
const password = process.env.PROBE_PASSWORD;
const secret = process.env.PROBE_SESSION_SECRET;

if (!password || !secret || secret.length < 16) {
  console.error("PROBE_PASSWORD와 16자 이상의 PROBE_SESSION_SECRET이 필요합니다.");
  process.exit(1);
}

function corsHeaders(origin) {
  if (origin !== allowedOrigin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    vary: "Origin",
  };
}

function send(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createToken(user, expiresAt) {
  const value = `${user}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return Buffer.from(`${value}.${signature}`).toString("base64url");
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [user, expiresAt, signature] = decoded.split(".");
    if (!user || !expiresAt || !signature || Number(expiresAt) < Date.now()) return false;
    const expected = createHmac("sha256", secret).update(`${user}.${expiresAt}`).digest("base64url");
    return safeEqual(signature, expected);
  } catch {
    return false;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    if (origin !== allowedOrigin) return send(response, 403, { ok: false, error: "origin_not_allowed" });
    response.writeHead(204, cors);
    return response.end();
  }

  if (request.method === "GET" && request.url === "/health") {
    return send(response, 200, { ok: true, service: "phase0-probe" }, cors);
  }

  if (request.method === "POST" && request.url === "/login") {
    if (origin !== allowedOrigin) return send(response, 403, { ok: false, error: "origin_not_allowed" });
    try {
      const body = await readJson(request);
      if (body.user !== "owner" || !safeEqual(String(body.password ?? ""), password)) {
        return send(response, 401, { ok: false, error: "invalid_credentials" }, cors);
      }
      const expiresAt = Date.now() + 5 * 60 * 1000;
      return send(response, 200, { ok: true, token: createToken(body.user, expiresAt), expiresAt }, cors);
    } catch {
      return send(response, 400, { ok: false, error: "invalid_json" }, cors);
    }
  }

  if (request.method === "GET" && request.url === "/cards") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (!verifyToken(token)) return send(response, 401, { ok: false, error: "unauthorized" }, cors);
    return send(response, 200, { ok: true, cards: [] }, cors);
  }

  return send(response, 404, { ok: false, error: "not_found" }, cors);
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({ ok: true, listening: `http://${host}:${port}`, allowedOrigin }, null, 2),
  );
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
