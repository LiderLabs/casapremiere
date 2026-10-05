// Who changed what, when (docs/cms.md Section 5.6, Section 7): the last 50 audit rows.
// Editors may read; every mutation in the admin already writes its own row.

import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/admin/auth";
import { listRecentAudit } from "@/lib/cms/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50, 1),
    200,
  );

  return NextResponse.json({ audit: await listRecentAudit(limit) });
}
