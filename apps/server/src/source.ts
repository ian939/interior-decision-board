import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { existsSync, readdirSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import type { SourceType } from "@interior/shared";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;

export interface SourceMetadata {
  finalUrl: string;
  sourceType: SourceType;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  excerpt: string | null;
  metadataQuality: "full" | "partial" | "unavailable";
}

export interface SourceExtractorOptions {
  ytDlpCommand?: string;
  ytDlpTimeoutMs?: number;
}

interface ExtractorMetadata {
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0]! >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("HTTP 또는 HTTPS 주소만 지원합니다.");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  }

  if (isIP(hostname)) {
    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("주소를 확인할 수 없습니다.");
  if (addresses.some(({ address }) => isPrivateIpv4(address) || isPrivateIpv6(address))) {
    throw new Error("내부 네트워크로 연결되는 주소는 사용할 수 없습니다.");
  }
  return url;
}

export function detectSourceType(url: URL): SourceType {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("instagram.com") && /\/(reel|reels)\//.test(url.pathname)) return "reels";
  if (host.includes("blog.naver.com") || host.includes("tistory.com") || host.includes("blogspot.com")) return "blog";
  if (
    host.includes("smartstore.naver.com") ||
    host.includes("coupang.com") ||
    host.includes("ikea.com") ||
    host.includes("11st.co.kr") ||
    host.includes("gmarket.co.kr")
  ) {
    return "shopping";
  }
  return "web";
}

export function normalizeSourceUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  if (host === "blog.naver.com" || host === "m.blog.naver.com") {
    const match = url.pathname.match(/^\/([^/]+)\/(\d+)\/?$/);
    if (match) {
      const normalized = new URL("https://blog.naver.com/PostView.naver");
      normalized.searchParams.set("blogId", match[1]!);
      normalized.searchParams.set("logNo", match[2]!);
      return normalized.href;
    }
  }
  return url.href;
}

function resolveYtDlpCommand(configured = "yt-dlp"): string {
  if (configured !== "yt-dlp" || process.platform !== "win32") return configured;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return configured;
  const link = join(localAppData, "Microsoft", "WinGet", "Links", "yt-dlp.exe");
  if (existsSync(link)) return link;
  const packages = join(localAppData, "Microsoft", "WinGet", "Packages");
  try {
    const packageDirectory = readdirSync(packages).find((name) => name.startsWith("yt-dlp.yt-dlp_"));
    if (packageDirectory) {
      const executable = join(packages, packageDirectory, "yt-dlp.exe");
      if (existsSync(executable)) return executable;
    }
  } catch {
    // PATH lookup below remains the portable fallback.
  }
  return configured;
}

function fetchExtractorMetadata(rawUrl: string, options: SourceExtractorOptions): Promise<ExtractorMetadata | null> {
  const command = resolveYtDlpCommand(options.ytDlpCommand);
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--no-playlist",
    "--encoding",
    "utf-8",
    rawUrl,
  ];
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let settled = false;
    const finish = (value: ExtractorMetadata | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, options.ytDlpTimeoutMs ?? 45_000);
    child.stdout.setEncoding("utf8");
    child.stderr.resume();
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length <= 10 * 1024 * 1024) stdout += chunk;
      if (stdout.length > 10 * 1024 * 1024) {
        child.kill();
        finish(null);
      }
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => {
      if (code !== 0) return finish(null);
      try {
        const result = JSON.parse(stdout) as Record<string, unknown>;
        finish({
          title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : null,
          description:
            typeof result.description === "string" && result.description.trim() ? result.description.trim() : null,
          thumbnailUrl: typeof result.thumbnail === "string" && result.thumbnail.trim() ? result.thumbnail : null,
        });
      } catch {
        finish(null);
      }
    });
  });
}

async function fetchPublic(rawUrl: string, accept: string): Promise<{ response: Response; finalUrl: string }> {
  let current = await assertPublicUrl(rawUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept,
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 InteriorDecisionBot/0.1",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`리다이렉트 위치가 없습니다 (${response.status}).`);
      current = await assertPublicUrl(new URL(location, current).href);
      continue;
    }
    return { response, finalUrl: current.href };
  }
  throw new Error("리다이렉트가 너무 많습니다.");
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > limit) {
      await reader.cancel();
      throw new Error(`응답이 허용 크기 ${Math.round(limit / 1024 / 1024)}MB를 초과했습니다.`);
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const prefix = new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(4096, bytes.length)));
  const charset =
    contentType.match(/charset=["']?([^;"']+)/i)?.[1] ?? prefix.match(/charset=["']?\s*([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.trim()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeEntities(value = ""): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1]!.toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function textExcerpt(html: string): string | null {
  const cleaned = decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  return cleaned ? cleaned.slice(0, 12_000) : null;
}

export async function fetchSourceMetadata(rawUrl: string, options: SourceExtractorOptions = {}): Promise<SourceMetadata> {
  const normalizedUrl = normalizeSourceUrl(rawUrl);
  const requestedType = detectSourceType(new URL(normalizedUrl));
  const { response, finalUrl } = await fetchPublic(normalizedUrl, "text/html,application/xhtml+xml");
  if (!response.ok) throw new Error(`원문 요청 실패 (${response.status})`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) throw new Error("HTML 문서가 아닙니다.");
  const bytes = await readLimited(response, MAX_HTML_BYTES);
  const html = decodeHtml(bytes, contentType);
  const meta: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content && !meta[key]) meta[key] = attrs.content;
  }
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const final = new URL(finalUrl);
  const videoId = final.hostname === "youtu.be" ? final.pathname.split("/").filter(Boolean)[0] : final.searchParams.get("v");
  const youtubeThumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
  const extractor = requestedType === "reels" ? await fetchExtractorMetadata(normalizedUrl, options) : null;
  const title =
    extractor?.title ??
    (decodeEntities(meta["og:title"] ?? meta["twitter:title"] ?? titleTag ?? final.hostname) || final.hostname);
  const description =
    extractor?.description ??
    (decodeEntities(meta["og:description"] ?? meta["twitter:description"] ?? meta.description ?? "") || null);
  const thumbnailUrl = extractor?.thumbnailUrl ?? meta["og:image"] ?? meta["twitter:image"] ?? youtubeThumbnail;
  const usefulTitle = title.toLowerCase() !== "instagram";
  const count = [usefulTitle ? title : null, description, thumbnailUrl].filter(Boolean).length;
  return {
    finalUrl: requestedType === "reels" && final.pathname.startsWith("/accounts/login") ? normalizedUrl : finalUrl,
    sourceType: requestedType,
    title,
    description,
    thumbnailUrl,
    excerpt: extractor?.description ?? textExcerpt(html),
    metadataQuality: count === 3 ? "full" : count > 0 ? "partial" : "unavailable",
  };
}

export async function downloadThumbnail(rawUrl: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { response } = await fetchPublic(rawUrl, "image/avif,image/webp,image/png,image/jpeg,image/gif");
  if (!response.ok) throw new Error(`썸네일 요청 실패 (${response.status})`);
  const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]).has(mimeType)) {
    throw new Error("지원하지 않는 썸네일 형식입니다.");
  }
  return { bytes: await readLimited(response, MAX_IMAGE_BYTES), mimeType };
}
