/**
 * Firebase real-time hooks using TanStack Query + Firestore onSnapshot.
 * Pattern: useQuery for initial data + onSnapshot to push live updates via queryClient.setQueryData
 */
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  questionsRef,
  decisionsRef,
  tasksRef,
  type ChatDoc,
  type GroupDoc,
  type FirestoreUser,
  type QuestionDoc,
  type DecisionDoc,
  type TaskDoc,
} from "@/lib/firestore";
import type { SelectedConversation } from "@/components/chat/ChatList";

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const queryKeys = {
  chats: (uid: string) => ["chats", uid] as const,
  groups: (uid: string) => ["groups", uid] as const,
  users: () => ["users"] as const,
  chatStatus: (chatId: string) => ["chatStatus", chatId] as const,
} as const;

// ─── useChatsQuery ─────────────────────────────────────────────────────────────
/**
 * Real-time DM chats for the current user.
 * Uses onSnapshot → setQueryData so TanStack Query cache stays live.
 */
export function useChatsQuery(currentUserId: string | undefined): UseQueryResult<SelectedConversation[]> {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUserId) return;

    const q = query(
      collection(db, COLLECTIONS.CHATS),
      where("participants", "array-contains", currentUserId),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const promises = snap.docs.map(async (docSnap) => {
        const chat = docSnap.data() as ChatDoc;
        const otherUid = chat.participants.find((p) => p !== currentUserId)!;

        let other = null;
        try {
          const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, otherUid));
          if (userSnap.exists()) {
            other = userSnap.data() as FirestoreUser;
          }
        } catch (error) {
          console.warn(`Could not fetch user ${otherUid}:`, error);
        }
        
        // If we can't fetch the user (e.g. they were deactivated or deleted), use a fallback
        if (!other) {
           other = {
             uid: otherUid,
             displayName: "Unknown User",
             email: "",
             photoURL: null,
             isActivated: false,
           } as FirestoreUser;
        }

        return {
          type: "dm",
          chatId: docSnap.id,
          other,
          participants: chat.participants,
          status: chat.status,
          requestedBy: chat.requestedBy,
          unreadCount: (chat as any).unreadCount,
          lastRead: (chat as any).lastRead,
          lastMessage: chat.lastMessage,
          lastMessageAt: chat.lastMessageAt,
        } as SelectedConversation;
      });

      const results = (await Promise.all(promises)).filter(Boolean) as SelectedConversation[];
      queryClient.setQueryData(queryKeys.chats(currentUserId), results);
    }, (error) => {
      console.warn("Error in useChatsQuery listener:", error);
    });

    return unsub;
  }, [currentUserId, queryClient]);

  return useQuery<SelectedConversation[]>({
    queryKey: queryKeys.chats(currentUserId ?? ""),
    queryFn: () => queryClient.getQueryData<SelectedConversation[]>(queryKeys.chats(currentUserId ?? "")) ?? [],
    enabled: Boolean(currentUserId),
    staleTime: Infinity, // onSnapshot keeps it fresh
  });
}

// ─── useGroupsQuery ────────────────────────────────────────────────────────────
export function useGroupsQuery(currentUserId: string | undefined): UseQueryResult<SelectedConversation[]> {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUserId) return;

    const q = query(
      collection(db, COLLECTIONS.GROUPS),
      where("memberIds", "array-contains", currentUserId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const results: SelectedConversation[] = snap.docs.map((d) => {
        const g = d.data() as GroupDoc;
        return {
          type: "group",
          groupId: d.id,
          name: g.name,
          photoURL: g.photoURL,
          members: g.members,
          adminId: g.adminId,
          unreadCount: (g as any).unreadCount,
          lastRead: (g as any).lastRead,
          lastMessage: g.lastMessage,
          lastMessageAt: g.lastMessageAt,
          description: g.description,
        };
      });
      queryClient.setQueryData(queryKeys.groups(currentUserId), results);
    }, (error) => {
      console.warn("Error in useGroupsQuery listener:", error);
    });

    return unsub;
  }, [currentUserId, queryClient]);

  return useQuery<SelectedConversation[]>({
    queryKey: queryKeys.groups(currentUserId ?? ""),
    queryFn: () => queryClient.getQueryData<SelectedConversation[]>(queryKeys.groups(currentUserId ?? "")) ?? [],
    enabled: Boolean(currentUserId),
    staleTime: Infinity,
  });
}

// ─── useUsersQuery ─────────────────────────────────────────────────────────────
export function useUsersQuery(currentUserId: string | undefined): UseQueryResult<FirestoreUser[]> {
  return useQuery<FirestoreUser[]>({
    queryKey: queryKeys.users(),
    queryFn: async () => {
      const q = query(
        collection(db, COLLECTIONS.USERS),
        where("isActivated", "==", true)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => d.data() as FirestoreUser)
        .filter((u) => u.uid !== currentUserId);
    },
    enabled: Boolean(currentUserId),
    staleTime: 30_000, // refetch every 30s
  });
}

// ─── useChatStatusQuery ────────────────────────────────────────────────────────
/**
 * Live subscription to a single chat/group document status.
 * Used in ChatWindow to get real-time status (pending → active → rejected).
 */
export function useLiveChatDoc(
  collection_: "chats" | "groups",
  docId: string | undefined
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!docId) return;
    const key = queryKeys.chatStatus(docId);

    const unsub = onSnapshot(doc(db, collection_, docId), (snap) => {
      if (snap.exists()) {
        queryClient.setQueryData(key, snap.data());
      }
    }, (error) => {
      console.warn(`Error in useLiveChatDoc listener for ${docId}:`, error);
    });

    return unsub;
  }, [collection_, docId, queryClient]);

  return useQuery({
    queryKey: queryKeys.chatStatus(docId ?? ""),
    queryFn: () => queryClient.getQueryData(queryKeys.chatStatus(docId ?? "")) ?? null,
    enabled: Boolean(docId),
    staleTime: Infinity,
  });
}

// ─── useTrackedItems ───────────────────────────────────────────────────────────
/**
 * Live Questions/Decisions/Tasks for one conversation — mirrors mobile's
 * TrackedItemsCard.tsx. Plain useState/onSnapshot rather than TanStack Query
 * since this only ever backs one open modal at a time, no cross-component
 * cache sharing needed.
 */
export function useTrackedItems(parentCollection: "chats" | "groups", parentId: string | undefined) {
  const [questions, setQuestions] = useState<Array<QuestionDoc & { id: string }>>([]);
  const [decisions, setDecisions] = useState<Array<DecisionDoc & { id: string }>>([]);
  const [tasks, setTasks] = useState<Array<TaskDoc & { id: string }>>([]);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      query(questionsRef(parentCollection, parentId), orderBy("createdAt", "desc")),
      (snap) => setQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) }))),
      (err) => console.warn("questions onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      query(decisionsRef(parentCollection, parentId), orderBy("createdAt", "desc")),
      (snap) => setDecisions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DecisionDoc) }))),
      (err) => console.warn("decisions onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      query(tasksRef(parentCollection, parentId), orderBy("createdAt", "desc")),
      (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskDoc) }))),
      (err) => console.warn("tasks onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  return { questions, decisions, tasks };
}

// ─── useTrackedItemCounts ──────────────────────────────────────────────────────
/**
 * Live open-question/pending-task/decision counts for one conversation,
 * computed client-side from the subcollections. This app has no Cloud
 * Functions backend (see root README's "Server architecture" section), so
 * there's no server-maintained denormalized counter field to read instead.
 */
export function useTrackedItemCounts(parentCollection: "chats" | "groups", parentId: string | undefined) {
  const [openQuestionsCount, setOpenQuestionsCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [pendingDecisionsCount, setPendingDecisionsCount] = useState(0);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      questionsRef(parentCollection, parentId),
      (snap) => setOpenQuestionsCount(snap.docs.filter((d) => (d.data() as QuestionDoc).status === "open").length),
      (err) => console.warn("questions count onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      tasksRef(parentCollection, parentId),
      (snap) => setPendingTasksCount(snap.docs.filter((d) => (d.data() as TaskDoc).status === "pending").length),
      (err) => console.warn("tasks count onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  useEffect(() => {
    if (!parentId) return;
    const unsub = onSnapshot(
      decisionsRef(parentCollection, parentId),
      (snap) => setPendingDecisionsCount(snap.size),
      (err) => console.warn("decisions count onSnapshot error:", err)
    );
    return unsub;
  }, [parentCollection, parentId]);

  return { openQuestionsCount, pendingTasksCount, pendingDecisionsCount };
}
