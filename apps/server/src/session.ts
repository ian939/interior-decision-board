import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserSummary } from "@interior/shared";
import type { AppConfig } from "./config.js";
import { verifySessionToken } from "./auth.js";
import type { Store } from "./store.js";

export function getBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export function getAuthenticatedUser(
  request: FastifyRequest,
  store: Store,
  appConfig: AppConfig,
  explicitToken?: string,
): UserSummary | null {
  const token = explicitToken ?? getBearerToken(request);
  if (!token) return null;
  const session = verifySessionToken(token, appConfig.sessionSecret);
  return session ? store.getUserById(session.userId) : null;
}

export function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  store: Store,
  appConfig: AppConfig,
): UserSummary | null {
  const user = getAuthenticatedUser(request, store, appConfig);
  if (!user) {
    void reply.code(401).send({ error: "로그인이 필요합니다.", code: "UNAUTHORIZED" });
    return null;
  }
  return user;
}
