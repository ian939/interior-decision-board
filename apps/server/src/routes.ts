import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { plannerItemSchema, preferenceSchema, sourceTypeSchema, transitionInputSchema } from "@interior/shared";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { createSessionToken, verifyPassword } from "./auth.js";
import { getAuthenticatedUser, requireUser } from "./session.js";
import { detectSourceType } from "./source.js";
import { removeStoredFiles, saveMultipartFile } from "./files.js";
import { sourceTypeForUpload, type JobWorker } from "./worker.js";
import type { ClaudeClient } from "./claude.js";
import type { Store } from "./store.js";

const loginSchema = z.object({ role: z.enum(["owner", "partner"]), password: z.string().min(1).max(200) });
const createUrlSchema = z.object({ url: z.url(), note: z.string().trim().max(2000).optional() });
const updateCardSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(5000).nullable().optional(),
  topicTags: z.array(z.string().trim().max(50)).max(12).optional(),
  spaceIds: z.array(z.string()).max(20).optional(),
});
const commentSchema = z.object({ body: z.string().trim().min(1).max(3000) });
const imageCommentBodySchema = z.string().trim().max(3000);
const preferenceInputSchema = z.object({ value: preferenceSchema.nullable() });
const relatedUrlSchema = z.object({ url: z.url() });
const workRequestUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  completed: z.boolean().optional(),
});
const spaceCreateSchema = z.object({ name: z.string().trim().min(1).max(50) });
const spaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(500).optional(),
});
const plannerItemsSchema = z.array(plannerItemSchema).max(200);
const plannerLayoutCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: plannerItemsSchema.optional().default([]),
});
const plannerLayoutUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  items: plannerItemsSchema.optional(),
}).refine((value) => value.name !== undefined || value.items !== undefined);

function errorReply(reply: FastifyReply, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const known: Record<string, [number, string]> = {
    CARD_NOT_FOUND: [404, "카드를 찾을 수 없습니다."],
    INVALID_TRANSITION: [409, "허용되지 않은 상태 이동입니다."],
    SPACE_REQUIRED: [400, "확인 중으로 이동하려면 미정이 아닌 공간을 하나 이상 선택하세요."],
    REASON_REQUIRED: [400, "보완 또는 드롭 사유를 입력하세요."],
    WORK_REQUEST_REQUIRED: [400, "작업 요청 제목과 내용을 입력하세요."],
    RELATED_SOURCE_REQUIRED: [400, "비교할 보완 자료를 먼저 추가하세요."],
    UNSUPPORTED_FILE_TYPE: [415, "지원하지 않는 파일 형식입니다."],
    FILE_TOO_LARGE: [413, "파일 크기가 제한을 초과했습니다."],
  };
  const mapped = known[message];
  if (mapped) return void reply.code(mapped[0]).send({ error: mapped[1], code: message });
  console.error(error);
  void reply.code(500).send({ error: "요청 처리 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" });
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function registerRoutes(
  app: FastifyInstance,
  store: Store,
  worker: JobWorker,
  claude: ClaudeClient,
  appConfig: AppConfig,
): void {
  app.get("/api/health", async () => ({
    ok: true,
    setupRequired: store.getUserCount() < 2,
    queue: store.getQueueStats(),
    telegramConfigured: Boolean(appConfig.telegramToken),
  }));

  app.get("/api/setup/status", async () => ({ setupRequired: store.getUserCount() < 2 }));

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "로그인 정보를 확인하세요." });
      const user = store.getUserByRole(parsed.data.role);
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
        return reply.code(401).send({ error: "비밀번호가 올바르지 않습니다." });
      }
      const { passwordHash: _passwordHash, ...summary } = user;
      const session = createSessionToken(user.id, appConfig.sessionSecret);
      return { ...session, user: summary };
    },
  );

  app.get("/api/auth/me", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    return user ? { user } : undefined;
  });

  app.get("/api/dashboard", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    return store.listDashboard();
  });

  app.get<{ Params: { id: string } }>("/api/cards/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const card = store.getCard(request.params.id);
    return card ?? reply.code(404).send({ error: "카드를 찾을 수 없습니다." });
  });

  app.post("/api/cards/url", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = createUrlSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "올바른 URL을 입력하세요." });
    try {
      const url = new URL(parsed.data.url);
      const card = store.createCard({
        title: url.hostname,
        sourceUrl: url.href,
        sourceType: detectSourceType(url),
        sourceChannel: "web",
        sourceNote: parsed.data.note ?? null,
        createdBy: user.id,
        aiStatus: "queued",
      });
      worker.wake();
      return reply.code(201).send(card);
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Querystring: { note?: string } }>("/api/cards/file", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    try {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "파일을 선택하세요." });
      const saved = await saveMultipartFile(file, appConfig);
      const card = store.createCard({
        title: saved.originalName,
        sourceType: sourceTypeForUpload(saved.mimeType),
        sourceChannel: "web",
        sourceNote: request.query.note?.slice(0, 2000) ?? null,
        createdBy: user.id,
        aiStatus: "manual",
      });
      store.createAttachment({ cardId: card.id, ...saved, kind: "source" });
      return reply.code(201).send(store.getCard(card.id));
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.patch<{ Params: { id: string } }>("/api/cards/:id", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = updateCardSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "카드 수정 내용을 확인하세요." });
    try {
      const card = store.updateCard(request.params.id, user.id, parsed.data);
      return card ?? reply.code(404).send({ error: "카드를 찾을 수 없습니다." });
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/cards/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    try {
      const result = store.deleteCard(request.params.id);
      if (!result.deleted) return reply.code(404).send({ error: "카드를 찾을 수 없습니다." });
      try {
        await removeStoredFiles(result.storedNames, appConfig);
      } catch (error) {
        console.error("삭제된 카드의 첨부 파일 정리에 실패했습니다.", error);
      }
      return { ok: true };
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/transition", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = transitionInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "상태 변경 내용을 확인하세요." });
    try {
      return store.transitionCard(request.params.id, user.id, parsed.data);
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/comments", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "댓글을 입력하세요." });
    try {
      return reply.code(201).send(store.addComment(request.params.id, user.id, parsed.data.body));
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/comments/image", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    if (!store.getCard(request.params.id)) return reply.code(404).send({ error: "카드를 찾을 수 없습니다." });
    let body = "";
    let saved: Awaited<ReturnType<typeof saveMultipartFile>> | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "body") body = String(part.value ?? "");
          continue;
        }
        if (!part.mimetype.startsWith("image/")) throw new Error("UNSUPPORTED_FILE_TYPE");
        saved = await saveMultipartFile(part, appConfig);
      }
      if (!saved) return reply.code(400).send({ error: "이미지를 선택하세요." });
      const parsed = imageCommentBodySchema.safeParse(body);
      if (!parsed.success) {
        await removeStoredFiles([saved.storedName], appConfig);
        return reply.code(400).send({ error: "의견은 3,000자 이내로 입력하세요." });
      }
      return reply.code(201).send(store.addImageComment(request.params.id, user.id, parsed.data, saved));
    } catch (error) {
      if (saved) await removeStoredFiles([saved.storedName], appConfig);
      return errorReply(reply, error);
    }
  });

  app.put<{ Params: { id: string } }>("/api/cards/:id/preference", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = preferenceInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "의견 값을 확인하세요." });
    try {
      store.setPreference(request.params.id, user.id, parsed.data.value);
      return { ok: true };
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/related/url", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = relatedUrlSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "올바른 URL을 입력하세요." });
    try {
      const url = new URL(parsed.data.url);
      const related = store.createRelatedUrl(request.params.id, user.id, url.href, detectSourceType(url));
      worker.wake();
      return reply.code(201).send(related);
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/related/file", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    try {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "파일을 선택하세요." });
      const saved = await saveMultipartFile(file, appConfig);
      const attachment = store.createAttachment({ cardId: request.params.id, ...saved, kind: "supplement" });
      return reply
        .code(201)
        .send(store.createRelatedFile(request.params.id, user.id, attachment.id, saved.originalName, sourceTypeForUpload(saved.mimeType)));
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/compare", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    try {
      store.requestComparison(request.params.id, user.id);
      worker.wake();
      return reply.code(202).send({ ok: true });
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/cards/:id/work-request-draft", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const card = store.getCard(request.params.id);
    if (!card) return reply.code(404).send({ error: "카드를 찾을 수 없습니다." });
    try {
      const content = await claude.draftWorkRequest({
        title: card.title,
        summary: card.summary,
        spaces: card.spaces.map((space) => space.name),
      });
      return { content };
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.get<{ Params: { id: string }; Querystring: { access_token?: string } }>("/api/files/:id", async (request, reply) => {
    const user = getAuthenticatedUser(request, store, appConfig, request.query.access_token);
    if (!user) return reply.code(401).send({ error: "로그인이 필요합니다." });
    const row = store.getAttachmentRow(request.params.id);
    if (!row) return reply.code(404).send({ error: "파일을 찾을 수 없습니다." });
    const path = resolve(appConfig.uploadDir, String(row.stored_name));
    if (!path.startsWith(resolve(appConfig.uploadDir)) || !existsSync(path)) {
      return reply.code(404).send({ error: "파일을 찾을 수 없습니다." });
    }
    reply.header("content-type", String(row.mime_type));
    reply.header("content-length", String(row.size));
    reply.header("cache-control", "private, max-age=300");
    reply.header("x-content-type-options", "nosniff");
    if (!String(row.mime_type).startsWith("image/") && row.mime_type !== "application/pdf") {
      reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(row.original_name))}`);
    }
    return reply.send(createReadStream(path));
  });

  app.get("/api/work-requests", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    return { items: store.listWorkRequests() };
  });

  app.get("/api/planner/layouts", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    return { layouts: store.listPlannerLayouts() };
  });

  app.post("/api/planner/layouts", async (request, reply) => {
    const user = requireUser(request, reply, store, appConfig);
    if (!user) return;
    const parsed = plannerLayoutCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "배치안 정보를 확인하세요." });
    return reply.code(201).send(store.createPlannerLayout(user.id, parsed.data.name, parsed.data.items));
  });

  app.patch<{ Params: { id: string } }>("/api/planner/layouts/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const parsed = plannerLayoutUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "배치안 수정 내용을 확인하세요." });
    return store.updatePlannerLayout(request.params.id, parsed.data) ?? reply.code(404).send({ error: "배치안을 찾을 수 없습니다." });
  });

  app.delete<{ Params: { id: string } }>("/api/planner/layouts/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    return store.deletePlannerLayout(request.params.id) ? { ok: true } : reply.code(404).send({ error: "배치안을 찾을 수 없습니다." });
  });

  app.patch<{ Params: { id: string } }>("/api/work-requests/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const parsed = workRequestUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "작업 요청 내용을 확인하세요." });
    return store.updateWorkRequest(request.params.id, parsed.data) ?? reply.code(404).send({ error: "요청을 찾을 수 없습니다." });
  });

  app.get<{ Querystring: { format?: string } }>("/api/work-requests/export", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const items = store.listWorkRequests();
    if (request.query.format === "csv") {
      const rows = [
        ["공간", "제목", "요청 내용", "완료", "원문"].map(csvCell).join(","),
        ...items.map((item) =>
          [item.spaces.map((space) => space.name).join("/"), item.title, item.body, item.completed ? "완료" : "진행 전", item.sourceUrl ?? ""]
            .map(csvCell)
            .join(","),
        ),
      ];
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", "attachment; filename=interior-work-requests.csv");
      return `\uFEFF${rows.join("\r\n")}`;
    }
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.spaces.map((space) => space.name).join(", ") || "공간 미지정";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    const markdown = ["# 인테리어 반영 요청 목록", ""];
    for (const [space, group] of grouped) {
      markdown.push(`## ${space}`, "");
      for (const item of group) {
        markdown.push(`- [${item.completed ? "x" : " "}] **${item.title}**`, `  - ${item.body.replaceAll("\n", " ")}`);
        if (item.sourceUrl) markdown.push(`  - 참고: ${item.sourceUrl}`);
      }
      markdown.push("");
    }
    reply.header("content-type", "text/markdown; charset=utf-8");
    reply.header("content-disposition", "attachment; filename=interior-work-requests.md");
    return markdown.join("\n");
  });

  app.get("/api/spaces", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    return { spaces: store.listSpaces(true) };
  });

  app.post("/api/spaces", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const parsed = spaceCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "공간 이름을 입력하세요." });
    try {
      return reply.code(201).send(store.createSpace(parsed.data.name));
    } catch (error) {
      return errorReply(reply, error);
    }
  });

  app.patch<{ Params: { id: string } }>("/api/spaces/:id", async (request, reply) => {
    if (!requireUser(request, reply, store, appConfig)) return;
    const parsed = spaceUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "공간 수정 내용을 확인하세요." });
    return store.updateSpace(request.params.id, parsed.data) ?? reply.code(404).send({ error: "공간을 찾을 수 없습니다." });
  });

  app.get("/api/source-types", async () => ({ sourceTypes: sourceTypeSchema.options }));
}
