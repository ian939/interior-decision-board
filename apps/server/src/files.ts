import { createHash } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import type { MultipartFile } from "@fastify/multipart";
import type { AppConfig } from "./config.js";
import { createId } from "./database.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export interface SavedUpload {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  checksum: string;
}

export async function saveMultipartFile(file: MultipartFile, appConfig: AppConfig): Promise<SavedUpload> {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new Error("UNSUPPORTED_FILE_TYPE");
  const buffer = await file.toBuffer();
  return saveBuffer(file.filename, file.mimetype, buffer, appConfig);
}

export async function saveBuffer(
  originalName: string,
  mimeType: string,
  buffer: Uint8Array,
  appConfig: AppConfig,
): Promise<SavedUpload> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("UNSUPPORTED_FILE_TYPE");
  if (buffer.byteLength > appConfig.maxUploadBytes) throw new Error("FILE_TOO_LARGE");
  const cleanName = basename(originalName).replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "upload";
  const originalExtension = extname(cleanName).toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType] ?? (originalExtension.match(/^\.[a-z0-9]{1,8}$/) ? originalExtension : ".bin");
  const storedName = `${createId()}${extension}`;
  await writeFile(resolve(appConfig.uploadDir, storedName), buffer, { flag: "wx" });
  return {
    originalName: cleanName,
    storedName,
    mimeType,
    size: buffer.byteLength,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}
