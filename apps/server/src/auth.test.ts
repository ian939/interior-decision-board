import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "./auth.js";

describe("auth", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const hash = hashPassword("our-safe-password");
    expect(hash).not.toContain("our-safe-password");
    expect(verifyPassword("our-safe-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("signs and verifies session tokens", () => {
    const secret = "test-session-secret-that-is-long-enough";
    const session = createSessionToken("user-1", secret);
    expect(verifySessionToken(session.token, secret)?.userId).toBe("user-1");
    expect(verifySessionToken(`${session.token}broken`, secret)).toBeNull();
    expect(verifySessionToken(session.token, "different-secret")).toBeNull();
  });
});
