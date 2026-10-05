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
});
