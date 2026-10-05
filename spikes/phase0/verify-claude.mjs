import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const schema = {
  type: "object",
  properties: {
    sourceType: {
      type: "string",
      enum: ["youtube", "reels", "blog", "shopping", "web", "file", "other"],
    },
    summary: { type: "string", minLength: 1, maxLength: 500 },
    tags: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
  },
  required: ["sourceType", "summary", "tags"],
  additionalProperties: false,
};

function resolveClaudeCommand() {
  if (process.platform === "win32") {
    const executable = join(
      process.env.APPDATA ?? "",
      "npm",
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    );
    if (existsSync(executable)) return executable;
  }
  return "claude";
}

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

const prompt = [
  "다음 인테리어 소스 메타데이터를 분석하세요.",
  "공간은 추정하거나 출력하지 마세요.",
  "제목: 작은 주방의 수납을 늘리는 7가지 아이디어",
  "설명: 상부장과 코너장을 활용한 주방 수납 사례를 소개합니다.",
  "URL 도메인: example.com",
].join("\n");

const args = [
  "-p",
  prompt,
  "--output-format",
  "json",
  "--json-schema",
  JSON.stringify(schema),
  "--tools",
  "",
  "--restricted",
  "--safe-mode",
  "--permission-prompts",
  "none",
  "--no-session-persistence",
];

const startedAt = performance.now();
const result = await run(resolveClaudeCommand(), args, 60_000);
const elapsedMs = Math.round(performance.now() - startedAt);

if (result.timedOut) {
  console.error(JSON.stringify({ ok: false, reason: "timeout", elapsedMs }, null, 2));
  process.exit(1);
}

if (result.code !== 0) {
  console.error(
    JSON.stringify(
      { ok: false, reason: "non_zero_exit", code: result.code, stderr: result.stderr.trim(), elapsedMs },
      null,
      2,
    ),
  );
  process.exit(1);
}

let envelope;
try {
  envelope = JSON.parse(result.stdout);
} catch {
  console.error(
    JSON.stringify({ ok: false, reason: "invalid_json_envelope", stdout: result.stdout, elapsedMs }, null, 2),
  );
  process.exit(1);
}

const structured = envelope.structured_output ?? envelope.structuredOutput;
const valid =
  structured &&
  typeof structured.sourceType === "string" &&
  typeof structured.summary === "string" &&
  Array.isArray(structured.tags) &&
  !("space" in structured);

console.log(
  JSON.stringify(
    {
      ok: Boolean(valid),
      elapsedMs,
      restrictedMode: true,
      noSessionPersistence: true,
      result: structured ?? null,
      model: envelope.model ?? null,
      usage: envelope.usage ?? null,
    },
    null,
    2,
  ),
);

if (!valid) process.exit(1);
