/**
 * Turns a message into a Question, Decision, Task, or personal Follow-up.
 * Mirrors mobile/src/lib/tags.ts exactly — same collections, same shapes —
 * so items created on one platform show up on the other. Each write lands in
 * a subcollection mirroring `messagesRef`. Open-question/pending-task/decision
 * counts are computed client-side (useTrackedItemCounts in firebase-hooks.ts)
 * rather than via a server-maintained counter field — no Cloud Functions
 * backend (see root README's "Server architecture" section).
 */
import { addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { questionsRef, decisionsRef, tasksRef, followUpsRef } from "./firestore";

type ParentCollection = "chats" | "groups";

export async function markAsQuestion(parent: ParentCollection, parentId: string, sourceMessageId: string, sourceText: string, askedBy: string) {
  await addDoc(questionsRef(parent, parentId), {
    sourceMessageId,
    sourceText,
    askedBy,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function answerQuestion(parent: ParentCollection, parentId: string, questionId: string, answerText: string, answeredBy: string) {
  await updateDoc(doc(questionsRef(parent, parentId), questionId), {
    status: "answered",
    answerText,
    answeredBy,
    answeredAt: serverTimestamp(),
  });
}

export async function markAsDecision(parent: ParentCollection, parentId: string, sourceMessageId: string, sourceText: string, summary: string, createdBy: string) {
  await addDoc(decisionsRef(parent, parentId), {
    sourceMessageId,
    sourceText,
    summary,
    decidedBy: [createdBy],
    createdBy,
    createdAt: serverTimestamp(),
  });
}

export async function createTask(
  parent: ParentCollection,
  parentId: string,
  sourceMessageId: string,
  sourceText: string,
  title: string,
  assignedTo: string,
  dueAt: Date | null,
  createdBy: string
) {
  await addDoc(tasksRef(parent, parentId), {
    sourceMessageId,
    sourceText,
    title,
    assignedTo,
    dueAt: dueAt ?? null,
    createdBy,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function completeTask(parent: ParentCollection, parentId: string, taskId: string) {
  await updateDoc(doc(tasksRef(parent, parentId), taskId), {
    status: "done",
    completedAt: serverTimestamp(),
  });
}

// Delivery on web is visual-only (shows up in TrackedItemsPanel) — there's no
// reliable way to fire a proactive browser notification at a future time
// without either a server (Cloud Functions, dropped) or a service worker +
// Push subscription (real infra of its own). Mobile schedules an actual local
// device notification instead — see mobile/src/lib/notifications.ts.
export async function createFollowUp(uid: string, chatId: string, isGroup: boolean, messageId: string, sourceText: string, remindAt: Date) {
  await addDoc(followUpsRef(), {
    uid,
    chatId,
    isGroup,
    messageId,
    sourceText,
    remindAt,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
