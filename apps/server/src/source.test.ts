import { describe, expect, it } from "vitest";
import { assertPublicUrl, detectSourceType, normalizeSourceUrl } from "./source.js";

describe("source safety and classification", () => {
  it("classifies common source URLs", () => {
    expect(detectSourceType(new URL("https://www.youtube.com/watch?v=abc"))).toBe("youtube");
    expect(detectSourceType(new URL("https://www.instagram.com/reel/abc/"))).toBe("reels");
    expect(detectSourceType(new URL("https://www.instagram.com/reels/abc/"))).toBe("reels");
    expect(detectSourceType(new URL("https://blog.naver.com/example"))).toBe("blog");
    expect(detectSourceType(new URL("https://smartstore.naver.com/example"))).toBe("shopping");
  });

  it("normalizes Naver's short blog URL to its metadata-rich post view", () => {
    expect(normalizeSourceUrl("https://blog.naver.com/hansin2565/223638372982")).toBe(
      "https://blog.naver.com/PostView.naver?blogId=hansin2565&logNo=223638372982",
    );
  });

  it("rejects private and unsupported URLs", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/private")).rejects.toThrow("내부 네트워크");
    await expect(assertPublicUrl("file:///C:/secret.txt")).rejects.toThrow("HTTP 또는 HTTPS");
  });
});
