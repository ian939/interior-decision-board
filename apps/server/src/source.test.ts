import { describe, expect, it } from "vitest";
import { assertPublicUrl, detectSourceType } from "./source.js";

describe("source safety and classification", () => {
  it("classifies common source URLs", () => {
    expect(detectSourceType(new URL("https://www.youtube.com/watch?v=abc"))).toBe("youtube");
    expect(detectSourceType(new URL("https://www.instagram.com/reel/abc/"))).toBe("reels");
    expect(detectSourceType(new URL("https://blog.naver.com/example"))).toBe("blog");
    expect(detectSourceType(new URL("https://smartstore.naver.com/example"))).toBe("shopping");
  });

  it("rejects private and unsupported URLs", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/private")).rejects.toThrow("내부 네트워크");
    await expect(assertPublicUrl("file:///C:/secret.txt")).rejects.toThrow("HTTP 또는 HTTPS");
  });
});
