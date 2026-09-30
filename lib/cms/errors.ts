// One error type for the admin API, and one place that turns it into a response.
//
// Every write path raises a `CmsError` carrying the status the API should answer with — 400 for
// something the caller can fix, 404 for a slug that is gone, 409 for a stale edit or a taken slug,
// 422 for a precondition that only applies at publish time. Route handlers then share one
// `errorResponse`, so a new endpoint cannot invent its own status codes, and an unexpected
// failure is logged with its stack and reported to the browser as a sentence.

import { NextResponse } from "next/server";

export class CmsError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    /** Extra top-level fields for the response body, e.g. a 409's `changedBy`/`changedAt`. */
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CmsError";
  }
}

export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof CmsError) {
    return NextResponse.json(
      { error: error.message, ...(error.detail ?? {}) },
      { status: error.status },
    );
  }

  console.error("[cms]", fallbackMessage, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
