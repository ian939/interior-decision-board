import { isIP } from "node:net";

const DEFAULT_URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.instagram.com/reel/DOewbQpEwbG/",
  "https://blog.naver.com/PostView.naver?blogId=becks0809&logNo=223872305934",
];

const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

function sourceType(url) {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("instagram.com") && url.pathname.includes("/reel")) return "reels";
  if (host.includes("blog.naver.com") || host.includes("tistory.com") || host.includes("blogspot.com")) {
    return "blog";
  }
  return "web";
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function assertSafeUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("unsupported_protocol");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("private_hostname");
  }
  if (isPrivateIpv4(hostname)) throw new Error("private_ipv4");
  if (isIP(hostname) === 6 && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"))) {
    throw new Error("private_ipv6");
  }
  return url;
}

async function fetchWithSafeRedirects(rawUrl) {
  let current = assertSafeUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 InteriorDecisionBot/0.1",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect_without_location_${response.status}`);
      current = assertSafeUrl(new URL(location, current).href);
      continue;
    }
    return { response, finalUrl: current.href, redirectCount };
  }
  throw new Error("too_many_redirects");
}

async function readLimitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return { html: "", bytes: 0, truncated: false };

  const chunks = [];
  let bytes = 0;
  let truncated = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (bytes + value.byteLength > MAX_BYTES) {
      const remaining = Math.max(0, MAX_BYTES - bytes);
      if (remaining > 0) chunks.push(value.subarray(0, remaining));
      bytes = MAX_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }

  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headerCharset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1];
  const asciiPrefix = new TextDecoder("ascii").decode(merged.subarray(0, Math.min(4096, merged.length)));
  const metaCharset = asciiPrefix.match(/charset=["']?\s*([\w-]+)/i)?.[1];
  const charset = (headerCharset ?? metaCharset ?? "utf-8").trim().toLowerCase();
  let decoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return { html: decoder.decode(merged), bytes, truncated };
}

function decodeEntities(text = "") {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return text
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&([a-z]+);/gi, (match, value) => named[value.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function extractMetadata(html, finalUrl) {
  const meta = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (key && attributes.content && !(key in meta)) meta[key] = attributes.content;
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const url = new URL(finalUrl);
  const videoId =
    url.hostname === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
  const youtubeFallback = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

  return {
    title: decodeEntities(meta["og:title"] ?? meta["twitter:title"] ?? titleMatch?.[1] ?? "") || null,
    description:
      decodeEntities(meta["og:description"] ?? meta["twitter:description"] ?? meta.description ?? "") || null,
    thumbnail: meta["og:image"] ?? meta["twitter:image"] ?? youtubeFallback,
  };
}

async function inspect(rawUrl) {
  const startedAt = performance.now();
  try {
    const { response, finalUrl, redirectCount } = await fetchWithSafeRedirects(rawUrl);
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("html")
      ? await readLimitedText(response)
      : { html: "", bytes: 0, truncated: false };
    const metadata = extractMetadata(body.html, finalUrl);
    const metadataFieldCount = [metadata.title, metadata.description, metadata.thumbnail].filter(Boolean).length;
    return {
      ok: response.ok,
      inputUrl: rawUrl,
      finalUrl,
      sourceType: sourceType(new URL(finalUrl)),
      status: response.status,
      contentType,
      redirectCount,
      bytesRead: body.bytes,
      truncated: body.truncated,
      hasTitle: Boolean(metadata.title),
      hasDescription: Boolean(metadata.description),
      hasThumbnail: Boolean(metadata.thumbnail),
      metadataQuality: metadataFieldCount === 3 ? "full" : metadataFieldCount > 0 ? "partial" : "unavailable",
      metadata,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      ok: false,
      inputUrl: rawUrl,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }
}

const results = [];
for (const url of urls) results.push(await inspect(url));
console.log(JSON.stringify({ ok: results.every((result) => result.ok), results }, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
