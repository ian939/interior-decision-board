import { Bot } from "grammy";
import type { AppConfig } from "./config.js";
import { saveBuffer } from "./files.js";
import { detectSourceType } from "./source.js";
import { sourceTypeForUpload, type JobWorker } from "./worker.js";
import type { Store } from "./store.js";

const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

export class TelegramListener {
  private bot: Bot | null = null;

  constructor(
    private readonly store: Store,
    private readonly worker: JobWorker,
    private readonly appConfig: AppConfig,
  ) {}

  start(): void {
    if (!this.appConfig.telegramToken) {
      console.info("TELEGRAM_BOT_TOKEN이 없어 텔레그램 리스너를 비활성화합니다.");
      return;
    }
    const bot = new Bot(this.appConfig.telegramToken);
    this.bot = bot;

    bot.command("start", async (context) => {
      const user = this.store.getTelegramUser(String(context.from?.id ?? ""));
      if (!user) {
        await context.reply(
          `아직 등록되지 않은 사용자입니다.\n내 Telegram ID: ${context.from?.id ?? "확인 불가"}\n이 ID를 운영자에게 전달해 사용자 연결을 완료해 주세요.`,
        );
        return;
      }
      await context.reply(`${user.name}님, 인테리어 링크나 파일을 보내주세요. 결정 필요 보드에 자동으로 올릴게요.`);
    });

    bot.on("message:text", async (context) => {
      const user = this.store.getTelegramUser(String(context.from.id));
      if (!user) return void (await context.reply("등록되지 않은 사용자입니다."));
      const urls = [...new Set(context.message.text.match(URL_PATTERN) ?? [])];
      if (urls.length === 0) return void (await context.reply("URL을 찾지 못했습니다. 링크 또는 파일을 보내주세요."));
      const note = context.message.text.replace(URL_PATTERN, "").trim() || null;
      const cards = urls.map((url) =>
        this.store.createCard({
          title: new URL(url).hostname,
          sourceUrl: url,
          sourceType: detectSourceType(new URL(url)),
          sourceChannel: "telegram",
          sourceNote: note,
          createdBy: user.id,
          aiStatus: "queued",
        }),
      );
      this.worker.wake();
      const links = cards.map((card) => `${this.appConfig.publicWebUrl}/?card=${card.id}`).join("\n");
      await context.reply(`${cards.length}개 자료를 접수했습니다.\n${links}`);
    });

    bot.on(["message:document", "message:photo"], async (context) => {
      const user = this.store.getTelegramUser(String(context.from.id));
      if (!user) return void (await context.reply("등록되지 않은 사용자입니다."));
      const document = context.message.document;
      const photo = context.message.photo?.at(-1);
      const fileId = document?.file_id ?? photo?.file_id;
      if (!fileId) return;
      const file = await context.api.getFile(fileId);
      if (!file.file_path || !this.appConfig.telegramToken) throw new Error("텔레그램 파일 경로를 가져오지 못했습니다.");
      const response = await fetch(`https://api.telegram.org/file/bot${this.appConfig.telegramToken}/${file.file_path}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`텔레그램 파일 다운로드 실패 (${response.status})`);
      const mimeType = document?.mime_type ?? "image/jpeg";
      const originalName = document?.file_name ?? `telegram-${photo?.file_unique_id ?? fileId}.jpg`;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const saved = await saveBuffer(originalName, mimeType, bytes, this.appConfig);
      const card = this.store.createCard({
        title: saved.originalName,
        sourceType: sourceTypeForUpload(saved.mimeType),
        sourceChannel: "telegram",
        sourceNote: context.message.caption ?? null,
        createdBy: user.id,
        aiStatus: "manual",
      });
      this.store.createAttachment({ cardId: card.id, ...saved, kind: "source" });
      await context.reply(`파일을 결정 필요 보드에 올렸습니다.\n${this.appConfig.publicWebUrl}/?card=${card.id}`);
    });

    bot.catch((error) => console.error("텔레그램 리스너 오류", error.error));
    void bot.start({ drop_pending_updates: false, onStart: (info) => console.info(`Telegram @${info.username} 리스너 시작`) });
  }

  async stop(): Promise<void> {
    await this.bot?.stop();
  }
}
