// R2 object storage: presigned browser→R2 uploads and server-side deletes.
// Server-only: it holds the S3-compatible credentials and must never reach the browser.
// R2 speaks the S3 API, so @aws-sdk/client-s3 signs; bytes never pass through Vercel.

import { createHash, randomBytes } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getEnv, requireR2 } from "@/lib/cms/env";

/** Browser-resized WebP only; the client enforces this too, the server re-checks. */
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** 1.5 MB after the browser resize (spec Section 8). */
export const MAX_UPLOAD_BYTES = 1_500_000;

/** Presigned PUT lifetime: long enough to upload, short enough to steal nothing. */
export const UPLOAD_URL_TTL_SECONDS = 300;

function s3() {
  const env = requireR2(getEnv());
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    }),
    bucket: env.R2_BUCKET,
  };
}

/**
 * The shared S3 client for server-side R2 reads (GET /api/media/[...key]). Writes keep
 * using s3() above so their call sites do not change.
 */
export function r2Client(): S3Client {
  return s3().client;
}

/** `properties/<slug>/<sha1>.<ext>` — content-addressed so a retry never duplicates. */
export function uploadKey(slug: string, contentType: string): string {
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] ?? "webp";
  const hash = createHash("sha1").update(`${slug}:${Date.now()}:${randomBytes(8).toString("hex")}`).digest("hex").slice(0, 16);
  return `properties/${slug}/${hash}.${ext}`;
}

/** Signs a browser PUT. Throws 400-style Error when the request itself is invalid. */
export async function signUpload(input: {
  slug: string;
  contentType: string;
  bytes: number;
}): Promise<{ url: string; key: string; expiresIn: number }> {
  if (!UPLOAD_CONTENT_TYPES.includes(input.contentType as (typeof UPLOAD_CONTENT_TYPES)[number])) {
    throw new Error("Only JPEG, PNG, WebP or AVIF images can be uploaded.");
  }
  if (!Number.isInteger(input.bytes) || input.bytes <= 0 || input.bytes > MAX_UPLOAD_BYTES) {
    throw new Error("That file is too large. Images must be 1.5 MB or less after resizing.");
  }

  const key = uploadKey(input.slug, input.contentType);
  const { client, bucket } = s3();

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType, ContentLength: input.bytes }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return { url, key, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

/** Removes one object. Missing keys are fine: the row is the source of truth. */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = s3();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.error("[cms] r2 delete failed:", key, error);
  }
}
