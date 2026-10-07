import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "./database.js";
import { Store } from "./store.js";
import type { AppConfig } from "./config.js";

describe("decision workflow", () => {
  let database: DatabaseSync;
  let store: Store;

  beforeEach(() => {
    const config = {
      databasePath: ":memory:",
      ownerName: "나",
      ownerPassword: "owner-password",
      partnerName: "배우자",
      partnerPassword: "partner-password",
      telegramOwnerId: undefined,
      telegramPartnerId: undefined,
    } as unknown as AppConfig;
    database = initializeDatabase(config);
    store = new Store(database);
  });

  afterEach(() => database.close());

  it("requires a real space before reviewing", () => {
    const owner = store.getUserByRole("owner")!;
    const card = store.createCard({
      title: "주방 참고",
      sourceType: "web",
      sourceChannel: "web",
      createdBy: owner.id,
      aiStatus: "manual",
    });
    expect(() => store.transitionCard(card.id, owner.id, { status: "reviewing", spaceIds: [] })).toThrow("SPACE_REQUIRED");
    const kitchen = store.listSpaces().find((space) => space.name === "주방")!;
    const reviewing = store.transitionCard(card.id, owner.id, { status: "reviewing", spaceIds: [kitchen.id] });
    expect(reviewing.status).toBe("reviewing");
    expect(reviewing.spaces.map((space) => space.name)).toEqual(["주방"]);
  });

  it("allows one person to approve and create a work request", () => {
    const owner = store.getUserByRole("owner")!;
    const partner = store.getUserByRole("partner")!;
    const kitchen = store.listSpaces().find((space) => space.name === "주방")!;
    const card = store.createCard({
      title: "아일랜드 상판",
      sourceType: "image",
      sourceChannel: "web",
      createdBy: partner.id,
      aiStatus: "manual",
    });
    store.transitionCard(card.id, partner.id, { status: "reviewing", spaceIds: [kitchen.id] });
    const approved = store.transitionCard(card.id, owner.id, { status: "approved", reason: "이 안으로 진행" });
    expect(approved.approvedBy?.id).toBe(owner.id);
    const requested = store.transitionCard(card.id, owner.id, {
      status: "requested",
      workRequestTitle: "아일랜드 상판 적용",
      workRequestBody: "참고 이미지와 유사한 밝은 상판으로 제안해 주세요.",
    });
    expect(requested.workRequest?.title).toBe("아일랜드 상판 적용");
    expect(store.listWorkRequests()).toHaveLength(1);
  });

  it("stores each person's preference independently", () => {
    const owner = store.getUserByRole("owner")!;
    const partner = store.getUserByRole("partner")!;
    const card = store.createCard({
      title: "조명",
      sourceType: "image",
      sourceChannel: "web",
      createdBy: owner.id,
      aiStatus: "manual",
    });
    store.setPreference(card.id, owner.id, "like");
    store.setPreference(card.id, partner.id, "hold");
    const detail = store.getCard(card.id)!;
    expect(detail.preferences[owner.id]).toBe("like");
    expect(detail.preferences[partner.id]).toBe("hold");
  });

  it("stores an image with a shared conversation comment", () => {
    const owner = store.getUserByRole("owner")!;
    const card = store.createCard({
      title: "이미지 의견",
      sourceType: "image",
      sourceChannel: "web",
      createdBy: owner.id,
      aiStatus: "manual",
    });
    const comment = store.addImageComment(card.id, owner.id, "이 색감이 좋아요", {
      originalName: "living-room.jpg",
      storedName: "stored-living-room.jpg",
      mimeType: "image/jpeg",
      size: 456,
      checksum: "image-checksum",
    });

    expect(comment.body).toBe("이 색감이 좋아요");
    expect(comment.images).toHaveLength(1);
    expect(comment.images[0]?.originalName).toBe("living-room.jpg");
    expect(store.getCard(card.id)?.comments[0]?.images[0]?.url).toMatch(/^\/api\/files\//);
    expect(store.deleteCard(card.id)).toEqual({ deleted: true, storedNames: ["stored-living-room.jpg"] });
  });

  it("recovers a job interrupted by a server restart", () => {
    const owner = store.getUserByRole("owner")!;
    store.createCard({
      title: "복구할 링크",
      sourceUrl: "https://example.com",
      sourceType: "web",
      sourceChannel: "web",
      createdBy: owner.id,
      aiStatus: "queued",
    });
    const claimed = store.claimNextJob();
    expect(claimed).not.toBeNull();
    expect(store.getQueueStats().processing).toBe(1);

    expect(store.recoverInterruptedJobs()).toBe(1);
    expect(store.getQueueStats()).toMatchObject({ queued: 1, processing: 0 });
    expect(store.claimNextJob()?.id).toBe(claimed?.id);
  });

  it("deletes a card with its dependent records and queued jobs", () => {
    const owner = store.getUserByRole("owner")!;
    const kitchen = store.listSpaces().find((space) => space.name === "주방")!;
    const card = store.createCard({
      title: "삭제할 주방 자료",
      sourceUrl: "https://example.com/delete-me",
      sourceType: "web",
      sourceChannel: "web",
      createdBy: owner.id,
      aiStatus: "queued",
    });
    const attachment = store.createAttachment({
      cardId: card.id,
      originalName: "sample.jpg",
      storedName: "stored-sample.jpg",
      mimeType: "image/jpeg",
      size: 123,
      checksum: "checksum",
      kind: "source",
    });
    const related = store.createRelatedUrl(card.id, owner.id, "https://example.com/related", "web");
    store.transitionCard(card.id, owner.id, { status: "reviewing", spaceIds: [kitchen.id] });
    store.transitionCard(card.id, owner.id, { status: "approved" });
    store.transitionCard(card.id, owner.id, {
      status: "requested",
      workRequestTitle: "삭제될 요청",
      workRequestBody: "삭제 검증",
    });

    expect(store.deleteCard(card.id)).toEqual({ deleted: true, storedNames: ["stored-sample.jpg"] });
    expect(store.getCard(card.id)).toBeNull();
    expect(store.getAttachmentRow(attachment.id)).toBeNull();
    expect(store.getRelatedSourceRow(related.id)).toBeNull();
    expect(store.listDashboard().cards).toHaveLength(0);
    expect(store.listWorkRequests()).toHaveLength(0);
    expect(store.getQueueStats()).toMatchObject({ queued: 0, processing: 0, failed: 0 });
    expect(store.deleteCard(card.id)).toEqual({ deleted: false, storedNames: [] });
  });

  it("shares and updates scaled planner layouts", () => {
    const owner = store.getUserByRole("owner")!;
    const layout = store.createPlannerLayout(owner.id, "거실 A안", [
      {
        id: "sofa-1",
        label: "3인 소파",
        category: "seating",
        xMm: 4_000,
        yMm: 7_000,
        widthMm: 2_200,
        depthMm: 900,
        rotation: 0,
        clearanceMm: 600,
        color: "#8fa58f",
      },
    ]);
    expect(store.listPlannerLayouts()).toHaveLength(1);
    expect(layout.items[0]?.widthMm).toBe(2_200);

    const updated = store.updatePlannerLayout(layout.id, { name: "거실 B안", items: [] });
    expect(updated?.name).toBe("거실 B안");
    expect(updated?.items).toEqual([]);
    expect(store.deletePlannerLayout(layout.id)).toBe(true);
    expect(store.listPlannerLayouts()).toEqual([]);
  });
});
