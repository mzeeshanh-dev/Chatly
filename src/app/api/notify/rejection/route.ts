import { NextResponse, type NextRequest } from "next/server";
import { sendRejectionEmail } from "@/lib/nodemailer";
import { asEmail, handleApiError, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { resolveEmailRecipient } from "@/lib/server/email-guard";

// Shared by web and mobile (mobile has no Cloud Functions backend), so it
// authenticates with a Bearer ID token and only emails existing conversation
// partners.
export async function POST(req: NextRequest) {
  try {
    const caller = await requireUser(req);
    await enforceRateLimit("notify-email", caller.uid, { limit: 20, windowSeconds: 3600 });

    const body = await readJson(req);
    const toEmail = asEmail(body.toEmail);
    const { fromName } = await resolveEmailRecipient(caller.uid, toEmail);

    await sendRejectionEmail(toEmail, fromName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "notify-rejection");
  }
}
