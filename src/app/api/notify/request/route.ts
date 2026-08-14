import { NextResponse, type NextRequest } from "next/server";
import { sendRequestEmail } from "@/lib/nodemailer";
import { adminAuth } from "@/lib/firebase-admin";

// Called by both web and mobile (mobile has no Cloud Functions backend of
// its own) — needs real auth since it's an arbitrary-recipient email relay.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { toEmail, fromName } = await req.json();

    if (!toEmail || !fromName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sendRequestEmail(toEmail, fromName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notify request error:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
