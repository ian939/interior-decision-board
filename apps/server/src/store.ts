import type {
  ActivityLog,
  Attachment,
  CardDetail,
  CardStatus,
  CardSummary,
  Comment,
  Comparison,
  DashboardResponse,
  PlannerItem,
  PlannerLayout,
  PreferenceValue,
  RelatedSource,
  SourceType,
  Space,
  TransitionInput,
  UserSummary,
  WorkRequest,
} from "@interior/shared";
import { canTransition, statusLabel } from "@interior/shared";
import type { DatabaseSync } from "node:sqlite";
import { createId, now, type DbRow } from "./database.js";

function text(value: unknown): string {
  return String(value ?? "");
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function jsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function plannerItems(value: unknown): PlannerItem[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? (parsed as PlannerItem[]) : [];
  } catch {
    return [];
  }
}

export interface CreateCardInput {
  title: string;
  sourceUrl?: string | null;
  sourceType: SourceType;
  sourceChannel: "web" | "telegram";
  sourceNote?: string | null;
  createdBy: string;
  aiStatus: "queued" | "manual";
}

export interface CreateAttachmentInput {
  cardId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  checksum: string;
  kind: "source" | "thumbnail" | "supplement";
}

export interface ClaimedJob {
  id: string;
  type: "analyze_card" | "analyze_related" | "compare" | "draft_work_request";
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export class Store {
  constructor(private readonly db: DatabaseSync) {}

  getUserByRole(role: "owner" | "partner"): (UserSummary & { passwordHash: string }) | null {
    const row = this.db.prepare("SELECT * FROM users WHERE role = ?").get(role) as DbRow | undefined;
    return row ? { ...this.userFromRow(row), passwordHash: text(row.password_hash) } : null;
  }

  getUserById(id: string): UserSummary | null {
    const row = this.db.prepare("SELECT id, name, role FROM users WHERE id = ?").get(id) as DbRow | undefined;
    return row ? this.userFromRow(row) : null;
  }

  getUserCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM users").get() as DbRow;
    return Number(row.count);
  }

  listUsers(): UserSummary[] {
    return (this.db.prepare("SELECT id, name, role FROM users ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END").all() as DbRow[]).map(
      (row) => this.userFromRow(row),
    );
  }

  listSpaces(includeInactive = false): Space[] {
    const rows = this.db
      .prepare(`SELECT * FROM spaces ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, name`)
      .all() as DbRow[];
    return rows.map((row) => this.spaceFromRow(row));
  }

  createSpace(name: string): Space {
    const maxRow = this.db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM spaces").get() as DbRow;
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO spaces (id, name, sort_order, active, is_unassigned, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)",
      )
      .run(id, name, Number(maxRow.max_order) + 1, timestamp, timestamp);
    return this.spaceFromRow(this.db.prepare("SELECT * FROM spaces WHERE id = ?").get(id) as DbRow);
  }

  updateSpace(id: string, input: { name?: string; active?: boolean; sortOrder?: number }): Space | null {
    const current = this.db.prepare("SELECT * FROM spaces WHERE id = ?").get(id) as DbRow | undefined;
    if (!current) return null;
    this.db
      .prepare("UPDATE spaces SET name = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?")
      .run(
        input.name?.trim() || text(current.name),
        input.active === undefined ? Number(current.active) : input.active ? 1 : 0,
        input.sortOrder ?? Number(current.sort_order),
        now(),
        id,
      );
    return this.spaceFromRow(this.db.prepare("SELECT * FROM spaces WHERE id = ?").get(id) as DbRow);
  }

  listPlannerLayouts(): PlannerLayout[] {
    return (this.db.prepare("SELECT * FROM planner_layouts ORDER BY updated_at DESC").all() as DbRow[]).map((row) =>
      this.plannerLayoutFromRow(row),
    );
  }

  createPlannerLayout(userId: string, name: string, items: PlannerItem[]): PlannerLayout {
    const id = createId();
    const timestamp = now();
    this.db
      .prepare("INSERT INTO planner_layouts (id, name, items_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, name.trim(), JSON.stringify(items), userId, timestamp, timestamp);
    return this.plannerLayoutFromRow(this.db.prepare("SELECT * FROM planner_layouts WHERE id = ?").get(id) as DbRow);
  }

  updatePlannerLayout(id: string, input: { name?: string; items?: PlannerItem[] }): PlannerLayout | null {
    const current = this.db.prepare("SELECT * FROM planner_layouts WHERE id = ?").get(id) as DbRow | undefined;
    if (!current) return null;
    this.db
      .prepare("UPDATE planner_layouts SET name = ?, items_json = ?, updated_at = ? WHERE id = ?")
      .run(
        input.name?.trim() || text(current.name),
        input.items === undefined ? text(current.items_json) : JSON.stringify(input.items),
        now(),
        id,
      );
    return this.plannerLayoutFromRow(this.db.prepare("SELECT * FROM planner_layouts WHERE id = ?").get(id) as DbRow);
  }

  deletePlannerLayout(id: string): boolean {
    return Number(this.db.prepare("DELETE FROM planner_layouts WHERE id = ?").run(id).changes) > 0;
  }

  createCard(input: CreateCardInput): CardDetail {
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO cards (
          id, title, summary, status, source_url, source_type, source_channel, source_note,
          topic_tags, ai_status, created_by, created_at, updated_at
        ) VALUES (?, ?, NULL, 'decision_needed', ?, ?, ?, ?, '[]', ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title,
        input.sourceUrl ?? null,
        input.sourceType,
        input.sourceChannel,
        input.sourceNote ?? null,
        input.aiStatus,
        input.createdBy,
        timestamp,
        timestamp,
      );
    this.addActivity(id, input.createdBy, "card_created", input.sourceChannel === "telegram" ? "텔레그램으로 등록" : "웹에서 등록");
    if (input.aiStatus === "queued") this.enqueueJob("analyze_card", { cardId: id });
    return this.getCard(id) as CardDetail;
  }

  updateCardAnalysis(
    cardId: string,
    input: {
      title: string;
      summary: string;
      sourceType: SourceType;
      topicTags: string[];
      metadataQuality: "full" | "partial" | "unavailable";
      thumbnailRemoteUrl: string | null;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE cards SET title = ?, summary = ?, source_type = ?, topic_tags = ?, metadata_quality = ?,
          thumbnail_remote_url = ?, ai_status = 'ready', ai_error = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.title,
        input.summary,
        input.sourceType,
        JSON.stringify(input.topicTags),
        input.metadataQuality,
        input.thumbnailRemoteUrl,
        now(),
        cardId,
      );
    this.addActivity(cardId, null, "ai_analysis_ready", "자동 요약과 태그 생성 완료");
  }

  setCardAiFailure(cardId: string, message: string): void {
    this.db.prepare("UPDATE cards SET ai_status = 'failed', ai_error = ?, updated_at = ? WHERE id = ?").run(message, now(), cardId);
    this.addActivity(cardId, null, "ai_analysis_failed", message.slice(0, 500));
  }

  updateCard(
    cardId: string,
    actorId: string,
    input: { title?: string; summary?: string | null; topicTags?: string[]; spaceIds?: string[] },
  ): CardDetail | null {
    const current = this.db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as DbRow | undefined;
    if (!current) return null;
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("UPDATE cards SET title = ?, summary = ?, topic_tags = ?, updated_at = ? WHERE id = ?")
        .run(
          input.title?.trim() || text(current.title),
          input.summary === undefined ? nullableText(current.summary) : input.summary,
          input.topicTags === undefined ? text(current.topic_tags) : JSON.stringify(input.topicTags),
          now(),
          cardId,
        );
      if (input.spaceIds) this.replaceCardSpaces(cardId, input.spaceIds);
      this.addActivity(cardId, actorId, "card_updated", "카드 정보를 수정함");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getCard(cardId);
  }

  listDashboard(): DashboardResponse {
    const cards = (this.db.prepare("SELECT * FROM cards ORDER BY updated_at DESC").all() as DbRow[]).map((row) =>
      this.cardSummaryFromRow(row),
    );
    const counts = {
      decision_needed: 0,
      reviewing: 0,
      supplement: 0,
      approved: 0,
      requested: 0,
      dropped: 0,
    } satisfies Record<CardStatus, number>;
    for (const card of cards) counts[card.status] += 1;
    return { cards, spaces: this.listSpaces(), users: this.listUsers(), counts };
  }

  getCard(cardId: string): CardDetail | null {
    const row = this.db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as DbRow | undefined;
    if (!row) return null;
    const summary = this.cardSummaryFromRow(row);
    return {
      ...summary,
      sourceNote: nullableText(row.source_note),
      supplementRequest: nullableText(row.supplement_request),
      droppedReason: nullableText(row.dropped_reason),
      approvalReason: nullableText(row.approval_reason),
      approvedAt: nullableText(row.approved_at),
      attachments: this.listAttachments(cardId),
      comments: this.listComments(cardId),
      activities: this.listActivities(cardId),
      relatedSources: this.listRelatedSources(cardId),
      comparison: this.getComparison(cardId),
      workRequest: this.getWorkRequestByCard(cardId),
    };
  }

  deleteCard(cardId: string): { deleted: boolean; storedNames: string[] } {
    if (!this.cardExists(cardId)) return { deleted: false, storedNames: [] };
    const storedNames = (this.db.prepare("SELECT stored_name FROM attachments WHERE card_id = ?").all(cardId) as DbRow[]).map((row) =>
      text(row.stored_name),
    );
    const relatedIds = new Set(
      (this.db.prepare("SELECT id FROM related_sources WHERE card_id = ?").all(cardId) as DbRow[]).map((row) => text(row.id)),
    );
    const jobIds = (this.db.prepare("SELECT id, payload FROM jobs").all() as DbRow[])
      .filter((row) => {
        try {
          const payload = JSON.parse(text(row.payload)) as Record<string, unknown>;
          return payload.cardId === cardId || (typeof payload.relatedSourceId === "string" && relatedIds.has(payload.relatedSourceId));
        } catch {
          return false;
        }
      })
      .map((row) => text(row.id));

    this.db.exec("BEGIN");
    try {
      const deleteJob = this.db.prepare("DELETE FROM jobs WHERE id = ?");
      for (const jobId of jobIds) deleteJob.run(jobId);
      this.db.prepare("DELETE FROM cards WHERE id = ?").run(cardId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { deleted: true, storedNames };
  }

  transitionCard(cardId: string, actorId: string, input: TransitionInput): CardDetail {
    const row = this.db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as DbRow | undefined;
    if (!row) throw new Error("CARD_NOT_FOUND");
    const from = text(row.status) as CardStatus;
    const to = input.status;
    if (!canTransition(from, to)) throw new Error("INVALID_TRANSITION");

    const existingSpaces = this.spacesForCard(cardId);
    const candidateSpaces = input.spaceIds ?? existingSpaces.map((space) => space.id);
    if (to === "reviewing") {
      const validSpaces = this.getSpacesByIds(candidateSpaces).filter((space) => !space.isUnassigned && space.active);
      if (validSpaces.length === 0) throw new Error("SPACE_REQUIRED");
    }
    if (to === "supplement" && !input.reason?.trim()) throw new Error("REASON_REQUIRED");
    if (to === "dropped" && !input.reason?.trim()) throw new Error("REASON_REQUIRED");
    if (to === "requested" && (!input.workRequestTitle?.trim() || !input.workRequestBody?.trim())) {
      throw new Error("WORK_REQUEST_REQUIRED");
    }

    const timestamp = now();
    this.db.exec("BEGIN");
    try {
      if (input.spaceIds) this.replaceCardSpaces(cardId, input.spaceIds);
      let approvedBy = nullableText(row.approved_by);
      let approvedAt = nullableText(row.approved_at);
      let approvalReason = nullableText(row.approval_reason);
      let supplementRequest = nullableText(row.supplement_request);
      let droppedReason = nullableText(row.dropped_reason);

      if (to === "supplement") supplementRequest = input.reason?.trim() ?? null;
      if (to === "dropped") droppedReason = input.reason?.trim() ?? null;
      if (to === "approved" && from !== "requested") {
        approvedBy = actorId;
        approvedAt = timestamp;
        approvalReason = input.reason?.trim() || null;
        this.db
          .prepare("INSERT INTO approvals (id, card_id, user_id, action, reason, created_at) VALUES (?, ?, ?, 'approved', ?, ?)")
          .run(createId(), cardId, actorId, approvalReason, timestamp);
      }
      if (from === "approved" && to === "reviewing") {
        this.db
          .prepare("INSERT INTO approvals (id, card_id, user_id, action, reason, created_at) VALUES (?, ?, ?, 'revoked', ?, ?)")
          .run(createId(), cardId, actorId, input.reason?.trim() || null, timestamp);
        approvedBy = null;
        approvedAt = null;
        approvalReason = null;
      }
      if (to === "requested") {
        this.upsertWorkRequest(cardId, actorId, input.workRequestTitle as string, input.workRequestBody as string);
      }

      this.db
        .prepare(
          `UPDATE cards SET status = ?, supplement_request = ?, dropped_reason = ?, approval_reason = ?,
            approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(to, supplementRequest, droppedReason, approvalReason, approvedBy, approvedAt, timestamp, cardId);
      this.addActivity(cardId, actorId, "status_changed", `${statusLabel(from)} → ${statusLabel(to)}`);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getCard(cardId) as CardDetail;
  }

  addComment(cardId: string, userId: string, body: string): Comment {
    if (!this.cardExists(cardId)) throw new Error("CARD_NOT_FOUND");
    const id = createId();
    const timestamp = now();
    this.db
      .prepare("INSERT INTO comments (id, card_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, cardId, userId, body.trim(), timestamp, timestamp);
    this.addActivity(cardId, userId, "comment_added", null);
    return this.listComments(cardId).find((comment) => comment.id === id) as Comment;
  }

  setPreference(cardId: string, userId: string, value: PreferenceValue | null): void {
    if (!this.cardExists(cardId)) throw new Error("CARD_NOT_FOUND");
    if (value === null) {
      this.db.prepare("DELETE FROM preferences WHERE card_id = ? AND user_id = ?").run(cardId, userId);
    } else {
      this.db
        .prepare(
          `INSERT INTO preferences (card_id, user_id, value, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(card_id, user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(cardId, userId, value, now());
    }
    this.addActivity(cardId, userId, "preference_changed", value);
  }

  createAttachment(input: CreateAttachmentInput): Attachment {
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO attachments (id, card_id, original_name, stored_name, mime_type, size, checksum, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.cardId,
        input.originalName,
        input.storedName,
        input.mimeType,
        input.size,
        input.checksum,
        input.kind,
        timestamp,
      );
    if (input.kind === "source" && input.mimeType.startsWith("image/")) {
      this.db.prepare("UPDATE cards SET thumbnail_attachment_id = ?, updated_at = ? WHERE id = ?").run(id, timestamp, input.cardId);
    }
    this.addActivity(input.cardId, null, "attachment_added", input.originalName);
    return this.attachmentFromRow(this.db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as DbRow);
  }

  getAttachmentRow(id: string): DbRow | null {
    return (this.db.prepare("SELECT * FROM attachments WHERE id = ?").get(id) as DbRow | undefined) ?? null;
  }

  setCardThumbnailAttachment(cardId: string, attachmentId: string): void {
    this.db.prepare("UPDATE cards SET thumbnail_attachment_id = ?, updated_at = ? WHERE id = ?").run(attachmentId, now(), cardId);
  }

  createRelatedUrl(cardId: string, userId: string, url: string, sourceType: SourceType): RelatedSource {
    if (!this.cardExists(cardId)) throw new Error("CARD_NOT_FOUND");
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO related_sources (
          id, card_id, url, title, source_type, ai_status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
      )
      .run(id, cardId, url, "추가 자료 분석 중", sourceType, userId, timestamp, timestamp);
    this.enqueueJob("analyze_related", { relatedSourceId: id });
    this.addActivity(cardId, userId, "related_source_added", url);
    return this.listRelatedSources(cardId).find((source) => source.id === id) as RelatedSource;
  }

  createRelatedFile(
    cardId: string,
    userId: string,
    attachmentId: string,
    title: string,
    sourceType: "image" | "file",
  ): RelatedSource {
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO related_sources (
          id, card_id, url, title, source_type, ai_status, attachment_id, created_by, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, 'manual', ?, ?, ?, ?)`,
      )
      .run(id, cardId, title, sourceType, attachmentId, userId, timestamp, timestamp);
    this.addActivity(cardId, userId, "related_file_added", title);
    return this.listRelatedSources(cardId).find((source) => source.id === id) as RelatedSource;
  }

  getRelatedSourceRow(id: string): DbRow | null {
    return (this.db.prepare("SELECT * FROM related_sources WHERE id = ?").get(id) as DbRow | undefined) ?? null;
  }

  updateRelatedAnalysis(
    id: string,
    input: {
      title: string;
      summary: string;
      sourceType: SourceType;
      thumbnailRemoteUrl: string | null;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE related_sources SET title = ?, summary = ?, source_type = ?, thumbnail_remote_url = ?,
          ai_status = 'ready', updated_at = ? WHERE id = ?`,
      )
      .run(input.title, input.summary, input.sourceType, input.thumbnailRemoteUrl, now(), id);
  }

  setRelatedAiFailure(id: string): void {
    this.db.prepare("UPDATE related_sources SET ai_status = 'failed', updated_at = ? WHERE id = ?").run(now(), id);
  }

  requestComparison(cardId: string, actorId: string): void {
    const sources = this.listRelatedSources(cardId);
    if (sources.length === 0) throw new Error("RELATED_SOURCE_REQUIRED");
    this.enqueueJob("compare", { cardId });
    this.addActivity(cardId, actorId, "comparison_requested", `${sources.length}개 자료 비교 요청`);
  }

  saveComparison(cardId: string, content: string): void {
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO comparisons (id, card_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(createId(), cardId, content, timestamp, timestamp);
    this.addActivity(cardId, null, "comparison_ready", "유사 사례 비교 초안 생성 완료");
  }

  listWorkRequests(): WorkRequest[] {
    const rows = this.db
      .prepare(
        `SELECT wr.*, c.source_url, c.thumbnail_remote_url, c.thumbnail_attachment_id
         FROM work_requests wr JOIN cards c ON c.id = wr.card_id
         WHERE c.status = 'requested' ORDER BY wr.completed, wr.updated_at DESC`,
      )
      .all() as DbRow[];
    return rows.map((row) => this.workRequestFromRow(row));
  }

  updateWorkRequest(
    id: string,
    input: { title?: string; body?: string; completed?: boolean },
  ): WorkRequest | null {
    const row = this.db.prepare("SELECT * FROM work_requests WHERE id = ?").get(id) as DbRow | undefined;
    if (!row) return null;
    this.db
      .prepare("UPDATE work_requests SET title = ?, body = ?, completed = ?, updated_at = ? WHERE id = ?")
      .run(
        input.title?.trim() || text(row.title),
        input.body?.trim() || text(row.body),
        input.completed === undefined ? Number(row.completed) : input.completed ? 1 : 0,
        now(),
        id,
      );
    const joined = this.db
      .prepare(
        `SELECT wr.*, c.source_url, c.thumbnail_remote_url, c.thumbnail_attachment_id
         FROM work_requests wr JOIN cards c ON c.id = wr.card_id WHERE wr.id = ?`,
      )
      .get(id) as DbRow;
    return this.workRequestFromRow(joined);
  }

  enqueueJob(type: ClaimedJob["type"], payload: Record<string, unknown>): string {
    const id = createId();
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, run_after, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', 0, 2, ?, ?, ?)`,
      )
      .run(id, type, JSON.stringify(payload), timestamp, timestamp, timestamp);
    return id;
  }

  recoverInterruptedJobs(): number {
    const timestamp = now();
    const result = this.db
      .prepare("UPDATE jobs SET status = 'queued', run_after = ?, updated_at = ? WHERE status = 'processing'")
      .run(timestamp, timestamp);
    return Number(result.changes);
  }

  claimNextJob(): ClaimedJob | null {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare("SELECT * FROM jobs WHERE status = 'queued' AND run_after <= ? ORDER BY created_at LIMIT 1")
        .get(now()) as DbRow | undefined;
      if (!row) {
        this.db.exec("COMMIT");
        return null;
      }
      this.db
        .prepare("UPDATE jobs SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?")
        .run(now(), text(row.id));
      this.db.exec("COMMIT");
      return {
        id: text(row.id),
        type: text(row.type) as ClaimedJob["type"],
        payload: JSON.parse(text(row.payload)) as Record<string, unknown>,
        attempts: Number(row.attempts) + 1,
        maxAttempts: Number(row.max_attempts),
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  completeJob(id: string): void {
    this.db.prepare("UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), id);
  }

  failJob(job: ClaimedJob, message: string): void {
    if (job.attempts < job.maxAttempts) {
      const delayMs = job.attempts * 5_000;
      this.db
        .prepare("UPDATE jobs SET status = 'queued', last_error = ?, run_after = ?, updated_at = ? WHERE id = ?")
        .run(message.slice(0, 2000), new Date(Date.now() + delayMs).toISOString(), now(), job.id);
    } else {
      this.db
        .prepare("UPDATE jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?")
        .run(message.slice(0, 2000), now(), job.id);
    }
  }

  getQueueStats(): { queued: number; processing: number; failed: number } {
    const rows = this.db.prepare("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status").all() as DbRow[];
    const stats = { queued: 0, processing: 0, failed: 0 };
    for (const row of rows) {
      if (row.status === "queued" || row.status === "processing" || row.status === "failed") {
        stats[row.status] = Number(row.count);
      }
    }
    return stats;
  }

  getCardRow(cardId: string): DbRow | null {
    return (this.db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as DbRow | undefined) ?? null;
  }

  getTelegramUser(telegramUserId: string): UserSummary | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.name, u.role FROM telegram_accounts ta
         JOIN users u ON u.id = ta.user_id WHERE ta.telegram_user_id = ?`,
      )
      .get(telegramUserId) as DbRow | undefined;
    return row ? this.userFromRow(row) : null;
  }

  private cardSummaryFromRow(row: DbRow): CardSummary {
    const approvedBy = row.approved_by ? this.getUserById(text(row.approved_by)) : null;
    const createdBy = this.getUserById(text(row.created_by));
    if (!createdBy) throw new Error(`카드 생성자를 찾을 수 없습니다: ${text(row.id)}`);
    const preferenceRows = this.db
      .prepare("SELECT user_id, value FROM preferences WHERE card_id = ?")
      .all(text(row.id)) as DbRow[];
    const preferences: Partial<Record<string, PreferenceValue>> = {};
    for (const preference of preferenceRows) {
      preferences[text(preference.user_id)] = text(preference.value) as PreferenceValue;
    }
    const commentCount = this.db.prepare("SELECT COUNT(*) AS count FROM comments WHERE card_id = ?").get(text(row.id)) as DbRow;
    const relatedCount = this.db.prepare("SELECT COUNT(*) AS count FROM related_sources WHERE card_id = ?").get(text(row.id)) as DbRow;
    return {
      id: text(row.id),
      title: text(row.title),
      summary: nullableText(row.summary),
      status: text(row.status) as CardStatus,
      sourceUrl: nullableText(row.source_url),
      sourceType: text(row.source_type) as SourceType,
      sourceChannel: text(row.source_channel) as "web" | "telegram",
      thumbnailUrl: row.thumbnail_attachment_id
        ? `/api/files/${text(row.thumbnail_attachment_id)}`
        : nullableText(row.thumbnail_remote_url),
      metadataQuality: nullableText(row.metadata_quality) as CardSummary["metadataQuality"],
      aiStatus: text(row.ai_status) as CardSummary["aiStatus"],
      aiError: nullableText(row.ai_error),
      topicTags: jsonArray(row.topic_tags),
      spaces: this.spacesForCard(text(row.id)),
      createdBy,
      approvedBy,
      preferences,
      commentCount: Number(commentCount.count),
      relatedSourceCount: Number(relatedCount.count),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
    };
  }

  private listComments(cardId: string): Comment[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, u.id AS user_id_value, u.name AS user_name, u.role AS user_role
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.card_id = ? ORDER BY c.created_at`,
      )
      .all(cardId) as DbRow[];
    return rows.map((row) => ({
      id: text(row.id),
      body: text(row.body),
      author: { id: text(row.user_id_value), name: text(row.user_name), role: text(row.user_role) as "owner" | "partner" },
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
    }));
  }

  private listActivities(cardId: string): ActivityLog[] {
    const rows = this.db
      .prepare(
        `SELECT a.*, u.id AS user_id_value, u.name AS user_name, u.role AS user_role
         FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.card_id = ? ORDER BY a.created_at DESC LIMIT 100`,
      )
      .all(cardId) as DbRow[];
    return rows.map((row) => ({
      id: text(row.id),
      action: text(row.action),
      detail: nullableText(row.detail),
      actor: row.user_id_value
        ? { id: text(row.user_id_value), name: text(row.user_name), role: text(row.user_role) as "owner" | "partner" }
        : null,
      createdAt: text(row.created_at),
    }));
  }

  private listAttachments(cardId: string): Attachment[] {
    return (this.db.prepare("SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at").all(cardId) as DbRow[]).map(
      (row) => this.attachmentFromRow(row),
    );
  }

  private listRelatedSources(cardId: string): RelatedSource[] {
    const rows = this.db.prepare("SELECT * FROM related_sources WHERE card_id = ? ORDER BY created_at").all(cardId) as DbRow[];
    return rows.map((row) => ({
      id: text(row.id),
      url: nullableText(row.url),
      title: text(row.title),
      summary: nullableText(row.summary),
      sourceType: text(row.source_type) as SourceType,
      aiStatus: text(row.ai_status) as RelatedSource["aiStatus"],
      thumbnailUrl: row.thumbnail_attachment_id
        ? `/api/files/${text(row.thumbnail_attachment_id)}`
        : row.attachment_id
          ? `/api/files/${text(row.attachment_id)}`
          : nullableText(row.thumbnail_remote_url),
      createdAt: text(row.created_at),
    }));
  }

  private getComparison(cardId: string): Comparison | null {
    const row = this.db.prepare("SELECT * FROM comparisons WHERE card_id = ?").get(cardId) as DbRow | undefined;
    return row ? { id: text(row.id), content: text(row.content), createdAt: text(row.created_at) } : null;
  }

  private getWorkRequestByCard(cardId: string): WorkRequest | null {
    const row = this.db
      .prepare(
        `SELECT wr.*, c.source_url, c.thumbnail_remote_url, c.thumbnail_attachment_id
         FROM work_requests wr JOIN cards c ON c.id = wr.card_id WHERE wr.card_id = ?`,
      )
      .get(cardId) as DbRow | undefined;
    return row ? this.workRequestFromRow(row) : null;
  }

  private upsertWorkRequest(cardId: string, actorId: string, title: string, body: string): void {
    const timestamp = now();
    this.db
      .prepare(
        `INSERT INTO work_requests (id, card_id, title, body, completed, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at`,
      )
      .run(createId(), cardId, title.trim(), body.trim(), actorId, timestamp, timestamp);
  }

  private workRequestFromRow(row: DbRow): WorkRequest {
    return {
      id: text(row.id),
      cardId: text(row.card_id),
      title: text(row.title),
      body: text(row.body),
      completed: Number(row.completed) === 1,
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      spaces: this.spacesForCard(text(row.card_id)),
      sourceUrl: nullableText(row.source_url),
      thumbnailUrl: row.thumbnail_attachment_id
        ? `/api/files/${text(row.thumbnail_attachment_id)}`
        : nullableText(row.thumbnail_remote_url),
    };
  }

  private spacesForCard(cardId: string): Space[] {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM spaces s JOIN card_spaces cs ON cs.space_id = s.id
         WHERE cs.card_id = ? ORDER BY s.sort_order, s.name`,
      )
      .all(cardId) as DbRow[];
    return rows.map((row) => this.spaceFromRow(row));
  }

  private getSpacesByIds(ids: string[]): Space[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return (this.db.prepare(`SELECT * FROM spaces WHERE id IN (${placeholders})`).all(...ids) as DbRow[]).map((row) =>
      this.spaceFromRow(row),
    );
  }

  private replaceCardSpaces(cardId: string, spaceIds: string[]): void {
    const uniqueIds = [...new Set(spaceIds)];
    this.db.prepare("DELETE FROM card_spaces WHERE card_id = ?").run(cardId);
    const insert = this.db.prepare("INSERT INTO card_spaces (card_id, space_id) VALUES (?, ?)");
    for (const spaceId of uniqueIds) insert.run(cardId, spaceId);
  }

  private cardExists(cardId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 AS found FROM cards WHERE id = ?").get(cardId));
  }

  private addActivity(cardId: string, actorId: string | null, action: string, detail: string | null): void {
    this.db
      .prepare("INSERT INTO activity_logs (id, card_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(createId(), cardId, actorId, action, detail, now());
  }

  private userFromRow(row: DbRow): UserSummary {
    return { id: text(row.id), name: text(row.name), role: text(row.role) as "owner" | "partner" };
  }

  private spaceFromRow(row: DbRow): Space {
    return {
      id: text(row.id),
      name: text(row.name),
      sortOrder: Number(row.sort_order),
      active: Number(row.active) === 1,
      isUnassigned: Number(row.is_unassigned) === 1,
    };
  }

  private attachmentFromRow(row: DbRow): Attachment {
    return {
      id: text(row.id),
      originalName: text(row.original_name),
      mimeType: text(row.mime_type),
      size: Number(row.size),
      kind: text(row.kind) as Attachment["kind"],
      url: `/api/files/${text(row.id)}`,
      createdAt: text(row.created_at),
    };
  }

  private plannerLayoutFromRow(row: DbRow): PlannerLayout {
    const createdBy = this.getUserById(text(row.created_by));
    if (!createdBy) throw new Error(`배치안 생성자를 찾을 수 없습니다: ${text(row.id)}`);
    return {
      id: text(row.id),
      name: text(row.name),
      items: plannerItems(row.items_json),
      createdBy,
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
    };
  }
}
