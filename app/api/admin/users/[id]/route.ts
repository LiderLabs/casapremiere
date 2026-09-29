// Role, status and display name for one user; DELETE soft-disables (spec §5.5).
//
// There is deliberately no hard delete: a user's audit trail and `created_by` references are
// the record of who did what, and a disabled account is exactly as powerless as a missing one.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { UserAdminError, updateUser } from "@/lib/admin/users";
import { fieldErrors, firstIssueMessage, updateUserSchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

/** Next 16 hands route params in as a promise. */
type Context = { params: Promise<{ id: string }> };

async function refuse(error: unknown) {
  if (error instanceof UserAdminError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("[cms] user update failed:", error);
  return NextResponse.json({ error: "Could not update the user." }, { status: 500 });
}

export async function PATCH(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    return NextResponse.json({ user: await updateUser(id, parsed.data, auth.user) });
  } catch (error) {
    return refuse(error);
  }
}

/**
 * The disable action. `last-admin` and `self` guards live in lib/admin/users.ts, so the API
 * cannot be the only caller that remembers them.
 */
export async function DELETE(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const { id } = await params;

  try {
    return NextResponse.json({ user: await updateUser(id, { status: "disabled" }, auth.user) });
  } catch (error) {
    return refuse(error);
  }
}
