// Signs a browser→R2 PUT (docs/cms-build-spec.md §8). Editors may upload; the bytes go
// straight to R2 — Vercel only ever signs, and the row is written by /uploads/confirm.

import { NextResponse } from "next/server";

import { assertSameOrigin, consumeRateLimit, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { isR2Configured } from "@/lib/cms/env";
import { MAX_UPLOAD_BYTES, signUpload, UPLOAD_CONTENT_TYPES } from "@/lib/cms/r2";
import { fieldErrors, firstIssueMessage, signUploadSchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured yet. Add the R2 values to the environment." },
      { status: 503 },
    );
  }

  const limit = await consumeRateLimit(`upload:sign:${auth.user.id}`, 30, 15);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = signUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  if (!UPLOAD_CONTENT_TYPES.includes(parsed.data.contentType) || parsed.data.bytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP or AVIF up to 1.5 MB." }, { status: 400 });
  }

  try {
    const signed = await signUpload(parsed.data);
    return NextResponse.json(signed);
  } catch (error) {
    return errorResponse(error, "Could not sign the upload.");
  }
}
