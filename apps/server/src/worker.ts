import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { SourceType } from "@interior/shared";
import type { AppConfig } from "./config.js";
import { ClaudeClient } from "./claude.js";
import { downloadThumbnail, fetchSourceMetadata } from "./source.js";
import { createId } from "./database.js";
import { Store, type ClaimedJob } from "./store.js";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

export class JobWorker {
  private timer: NodeJS.Timeout | null = null;
  private working = false;
  private stopped = false;

  constructor(
    private readonly store: Store,
    private readonly claude: ClaudeClient,
    private readonly appConfig: AppConfig,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(200);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  wake(): void {
    if (!this.working && !this.stopped) this.schedule(10);
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (this.working || this.stopped) return;
    this.working = true;
    let foundJob = false;
    try {
      const job = this.store.claimNextJob();
      if (job) {
        foundJob = true;
        await this.process(job);
        this.store.completeJob(job.id);
      }
    } catch (error) {
      console.error("작업 워커 오류", error);
    } finally {
      this.working = false;
      this.schedule(foundJob ? 50 : 1_500);
    }
  }

  private async process(job: ClaimedJob): Promise<void> {
    try {
      if (job.type === "analyze_card") await this.analyzeCard(String(job.payload.cardId));
      if (job.type === "analyze_related") await this.analyzeRelated(String(job.payload.relatedSourceId));
      if (job.type === "compare") await this.compare(String(job.payload.cardId));
      if (job.type === "draft_work_request") await this.draftWorkRequest(String(job.payload.cardId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.failJob(job, message);
      if (job.attempts >= job.maxAttempts) {
        if (job.type === "analyze_card") this.store.setCardAiFailure(String(job.payload.cardId), message);
        if (job.type === "analyze_related") this.store.setRelatedAiFailure(String(job.payload.relatedSourceId));
      }
      throw error;
    }
  }

  private async analyzeCard(cardId: string): Promise<void> {
    const row = this.store.getCardRow(cardId);
    if (!row?.source_url) throw new Error("분석할 URL이 없습니다.");
    const metadata = await fetchSourceMetadata(String(row.source_url), {
      ytDlpCommand: this.appConfig.ytDlpCommand,
      ytDlpTimeoutMs: this.appConfig.ytDlpTimeoutMs,
    });
    const analysis = await this.claude.analyze(metadata);
    this.store.updateCardAnalysis(cardId, {
      title: analysis.title || metadata.title,
      summary: analysis.summary,
      sourceType: analysis.sourceType,
      topicTags: analysis.tags,
      metadataQuality: metadata.metadataQuality,
      thumbnailRemoteUrl: metadata.thumbnailUrl,
    });
    if (metadata.thumbnailUrl) await this.cacheThumbnail(cardId, metadata.thumbnailUrl);
  }

  private async analyzeRelated(relatedSourceId: string): Promise<void> {
    const row = this.store.getRelatedSourceRow(relatedSourceId);
    if (!row?.url) throw new Error("분석할 보완 URL이 없습니다.");
    const metadata = await fetchSourceMetadata(String(row.url), {
      ytDlpCommand: this.appConfig.ytDlpCommand,
      ytDlpTimeoutMs: this.appConfig.ytDlpTimeoutMs,
    });
    const analysis = await this.claude.analyze(metadata);
    this.store.updateRelatedAnalysis(relatedSourceId, {
      title: analysis.title || metadata.title,
      summary: analysis.summary,
      sourceType: analysis.sourceType,
      thumbnailRemoteUrl: metadata.thumbnailUrl,
    });
  }

  private async compare(cardId: string): Promise<void> {
    const card = this.store.getCard(cardId);
    if (!card) throw new Error("카드를 찾을 수 없습니다.");
    const content = await this.claude.compare(
      { title: card.title, summary: card.summary },
      card.relatedSources.map(({ title, summary, url }) => ({ title, summary, url })),
    );
    this.store.saveComparison(cardId, content);
  }

  private async draftWorkRequest(cardId: string): Promise<void> {
    const card = this.store.getCard(cardId);
    if (!card) throw new Error("카드를 찾을 수 없습니다.");
    await this.claude.draftWorkRequest({
      title: card.title,
      summary: card.summary,
      spaces: card.spaces.map((space) => space.name),
    });
  }

  private async cacheThumbnail(cardId: string, url: string): Promise<void> {
    try {
      const { bytes, mimeType } = await downloadThumbnail(url);
      const extension = MIME_EXTENSIONS[mimeType] ?? (extname(new URL(url).pathname).slice(0, 8) || ".img");
      const storedName = `${createId()}${extension}`;
      await writeFile(resolve(this.appConfig.uploadDir, storedName), bytes, { flag: "wx" });
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const attachment = this.store.createAttachment({
        cardId,
        originalName: `thumbnail${extension}`,
        storedName,
        mimeType,
        size: bytes.byteLength,
        checksum,
        kind: "thumbnail",
      });
      this.store.setCardThumbnailAttachment(cardId, attachment.id);
    } catch (error) {
      console.warn(`썸네일 캐시 실패 (${cardId}):`, error instanceof Error ? error.message : error);
    }
  }
}

export function sourceTypeForUpload(mimeType: string): "image" | "file" {
  return mimeType.startsWith("image/") ? "image" : "file";
}
