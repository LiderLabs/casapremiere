// Public image reads, proxied through the app (docs/cms-build-spec.md §22.1).
//
// Why this exists: the bucket has no public URL yet (S3 API only), and a browser <img>
// cannot speak SigV4 — so with no R2_PUBLIC_BASE_URL there is nothing to put in src="".
// This route fetches server-side, where the secret key lives, and streams plain bytes to
// the browser. The day a public domain exists, mediaSrc() flips every src to direct with
// one env var and this route goes quiet — keys are identical either way.
//
// Public GET, no session: catalogue images are public content, and the admin gate is
// irrelevant here. The key regex below is the ONLY security boundary — it pins reads to
// properties/<slug>/<hash>.<ext>, so this can never become an open proxy into the bucket.

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getEnv, isR2Configured } from "@/lib/cms/env";
import { r2Client } from "@/lib/cms/r2";

export const dynamic = "force-dynamic";

const KEY_PATTERN = /^properties\/[a-z0-9-]+\/[a-f0-9]+\.(jpg|png|webp|avif)$/;

type Context = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: Context) {
  const key = (await params).key.join("/");

  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const object = await r2Client().send(
      new GetObjectCommand({ Bucket: getEnv().R2_BUCKET as string, Key: key }),
    );

    if (!object.Body) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Keys are content hashes — immutable forever. Browsers and the edge cache hard,
    // so R2 is hit once per key per edge, not once per visitor.
    return new NextResponse(object.Body as unknown as BodyInit, {
      headers: {
        "Content-Type": object.ContentType ?? "image/webp",
        ...(object.ContentLength !== undefined
          ? { "Content-Length": String(object.ContentLength) }
          : {}),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // NoSuchKey and friends: a missing image is a 404, never a stack trace or a bucket name.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
