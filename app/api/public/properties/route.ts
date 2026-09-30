// The one unauthenticated endpoint: published properties only, in grid order, as the
// components' own `Property` shape.
//
// Cacheable for a minute at the edge (`s-maxage=60`); the pages themselves keep the instant
// publish behaviour in Phase 7 through ISR plus `revalidatePath`.
import { NextResponse } from "next/server";

import { listPublicProperties } from "@/lib/cms/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.json({ properties: await listPublicProperties() });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300",
  );

  return response;
}
