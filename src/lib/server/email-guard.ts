import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError } from "./http";

/**
 * Chat-request emails may only go to someone who actually shares a DM with the
 * caller; otherwise the endpoint would be an open email relay.
 * The sender name is read server-side, never trusted from the request.
 */
export async function resolveEmailRecipient(callerUid: string, toEmail: string) {
  let recipientUid: string;
  try {
    recipientUid = (await adminAuth.getUserByEmail(toEmail)).uid;
  } catch {
    throw new ApiError(403, "You can only notify people you have a conversation with.");
  }

  const chats = await adminDb
    .collection("chats")
    .where("participants", "array-contains", callerUid)
    .get();
  const shared = chats.docs.some((d) => (d.data().participants ?? []).includes(recipientUid));
  if (!shared) throw new ApiError(403, "You can only notify people you have a conversation with.");

  const me = await adminDb.collection("users").doc(callerUid).get();
  const fromName = (me.data()?.displayName as string) || "Someone";
  return { fromName };
}
