"use client";

import React, { useState } from "react";
import { Question, Flag, CheckSquare, Square } from "@phosphor-icons/react";
import { useTrackedItems } from "@/lib/firebase-hooks";
import { answerQuestion, completeTask } from "@/lib/tags";

type Tab = "questions" | "decisions" | "tasks";

interface TrackedItemsPanelProps {
  parentCollection: "chats" | "groups";
  parentId: string;
  myUid: string;
  resolveName: (uid: string) => string;
}

function formatDate(value: unknown): string {
  const ts = value as { toDate?: () => Date } | undefined;
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Shared by GroupSettingsModal and UserProfileModal — mirrors mobile's
 * TrackedItemsCard.tsx. Every message tagged as a Question/Decision/Task in
 * this conversation, one place to review and act on them.
 */
export default function TrackedItemsPanel({ parentCollection, parentId, myUid, resolveName }: TrackedItemsPanelProps) {
  const { questions, decisions, tasks } = useTrackedItems(parentCollection, parentId);
  const [tab, setTab] = useState<Tab>("questions");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  if (questions.length === 0 && decisions.length === 0 && tasks.length === 0) return null;

  const submitAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;
    await answerQuestion(parentCollection, parentId, questionId, answerText.trim(), myUid);
    setAnsweringId(null);
    setAnswerText("");
  };

  const tabButton = (key: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        tab === key ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      }`}
    >
      {label} {count > 0 ? `(${count})` : ""}
    </button>
  );

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-500", "ring-offset-2", "ring-offset-zinc-50", "dark:ring-offset-zinc-900", "transition-all", "duration-500", "rounded-xl");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500", "ring-offset-2", "ring-offset-zinc-50", "dark:ring-offset-zinc-900", "rounded-xl");
      }, 2000);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl mb-2">
        {tabButton("questions", "Questions", questions.filter((q) => q.status === "open").length)}
        {tabButton("decisions", "Decisions", decisions.length)}
        {tabButton("tasks", "Tasks", tasks.filter((t) => t.status === "pending").length)}
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {tab === "questions" ? (
          questions.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-3">No questions tagged yet.</p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                onClick={() => scrollToMessage(q.sourceMessageId)}
                className="flex items-start gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <Question size={14} weight="fill" className={q.status === "open" ? "text-amber-500 mt-0.5" : "text-zinc-400 mt-0.5"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-800 dark:text-zinc-200">{q.sourceText}</p>
                  {q.status === "answered" ? (
                    <p className="text-[11px] text-zinc-500 mt-1">✅ {q.answerText}</p>
                  ) : answeringId === q.id ? (
                    <div className="flex gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Type an answer…"
                        className="flex-1 h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 text-[11px] outline-none"
                      />
                      <button onClick={() => submitAnswer(q.id)} className="text-[11px] font-bold text-emerald-500">
                        Send
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAnsweringId(q.id); setAnswerText(""); }}
                      className="text-[11px] text-emerald-500 mt-1"
                    >
                      Answer
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        ) : tab === "decisions" ? (
          decisions.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-3">No decisions recorded yet.</p>
          ) : (
            decisions.map((d) => (
              <div
                key={d.id}
                onClick={() => scrollToMessage(d.sourceMessageId)}
                className="flex items-start gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <Flag size={14} weight="fill" className="text-emerald-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-800 dark:text-zinc-200">{d.summary}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {resolveName(d.createdBy)} · {formatDate(d.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )
        ) : tasks.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3">No tasks created yet.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              onClick={() => scrollToMessage(t.sourceMessageId)}
              className="w-full flex items-start gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40 text-left cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); t.status === "pending" && completeTask(parentCollection, parentId, t.id); }}
                className="mt-0.5"
              >
                {t.status === "done" ? (
                  <CheckSquare size={14} weight="fill" className="text-emerald-500" />
                ) : (
                  <Square size={14} className="text-zinc-400 hover:text-emerald-500 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-xs text-zinc-800 dark:text-zinc-200 ${t.status === "done" ? "line-through opacity-60" : ""}`}>{t.title}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {resolveName(t.assignedTo)}
                  {t.dueAt ? ` · Due ${formatDate(t.dueAt)}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
