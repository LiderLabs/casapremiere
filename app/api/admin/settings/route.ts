// Business details as key/value pairs (docs/cms.md Section 6, Section 7): the phone number, email,
// WhatsApp, opening hours, address and footer links the sites currently hard-code. Admin-only —
// an editor's screen arrives in Phase 5, which is also when this screen gets its form.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { getSettings, saveSettings } from "@/lib/cms/queries";
import { fieldErrors, firstIssueMessage, updateSettingsSchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  // Unset keys are absent from the response, so a reader knows to fall back to the value that
  // is still hard-coded in lib/booking.ts / lib/forms.ts rather than to a blank.
  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const parsed = updateSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ settings: await saveSettings(parsed.data, auth.user) });
  } catch (error) {
    return errorResponse(error, "Could not save the settings.");
  }
}
