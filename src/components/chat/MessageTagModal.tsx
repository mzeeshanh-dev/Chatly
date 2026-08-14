"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Question, Flag, ListChecks, BellRinging, X, CaretLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { markAsQuestion, markAsDecision, createTask, createFollowUp } from "@/lib/tags";

interface Assignee {
  uid: string;
  name: string;
}

interface MessageTagModalProps {
  open: boolean;
  onClose: () => void;
  message: { id: string; text: string } | null;
  parentCollection: "chats" | "groups";
  parentId: string;
  myUid: string;
  assignees: Assignee[];
}

type Mode = "menu" | "question" | "decision" | "task" | "followup";

export default function MessageTagModal({ open, onClose, message, parentCollection, parentId, myUid, assignees }: MessageTagModalProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<string>("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !message) return;
    setMode("menu");
    setDecisionSummary(message.text);
    setTaskTitle(message.text);
    setTaskAssignee(assignees.find((a) => a.uid !== myUid)?.uid ?? assignees[0]?.uid ?? "");
    setTaskDueAt("");
    setFollowUpAt("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message]);

  if (!open || !message) return null;

  const handleMarkQuestion = async () => {
    setSaving(true);
    try {
      await markAsQuestion(parentCollection, parentId, message.id, message.text, myUid);
      toast.success("Marked as Question");
      onClose();
    } catch {
      toast.error("Could not mark as Question");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDecision = async () => {
    if (!decisionSummary.trim()) return;
    setSaving(true);
    try {
      await markAsDecision(parentCollection, parentId, message.id, message.text, decisionSummary.trim(), myUid);
      toast.success("Decision recorded");
      onClose();
    } catch {
      toast.error("Could not save decision");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !taskAssignee) return;
    setSaving(true);
    try {
      await createTask(parentCollection, parentId, message.id, message.text, taskTitle.trim(), taskAssignee, taskDueAt ? new Date(taskDueAt) : null, myUid);
      toast.success("Task created");
      onClose();
    } catch {
      toast.error("Could not create task");
    } finally {
      setSaving(false);
    }
  };

  const handleSetFollowUp = async () => {
    if (!followUpAt) return;
    setSaving(true);
    try {
      await createFollowUp(myUid, parentId, parentCollection === "groups", message.id, message.text, new Date(followUpAt));
      toast.success("Follow-up set");
      onClose();
    } catch {
      toast.error("Could not set follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1d28] border border-zinc-200 dark:border-white/[0.08] shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              {mode !== "menu" ? (
                <button onClick={() => setMode("menu")} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                  <CaretLeft size={14} /> Back
                </button>
              ) : (
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Mark this message as…</span>
              )}
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            {mode === "menu" ? (
              <div className="flex flex-col gap-1">
                {[
                  { key: "question" as const, icon: Question, label: "Question", sub: "Track it in Open Questions" },
                  { key: "decision" as const, icon: Flag, label: "Decision", sub: "Record it in Decisions" },
                  { key: "task" as const, icon: ListChecks, label: "Task", sub: "Assign it with a due date" },
                  { key: "followup" as const, icon: BellRinging, label: "Follow-up", sub: "Remind me about this later" },
                ].map(({ key, icon: Icon, label, sub }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Icon size={17} weight="fill" className="text-zinc-700 dark:text-zinc-300" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
                      <span className="block text-xs text-zinc-500">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : mode === "question" ? (
              <div>
                <p className="text-xs text-zinc-500 mb-4 italic">&quot;{message.text}&quot;</p>
                <button
                  disabled={saving}
                  onClick={handleMarkQuestion}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Mark as Question
                </button>
              </div>
            ) : mode === "decision" ? (
              <div>
                <textarea
                  value={decisionSummary}
                  onChange={(e) => setDecisionSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-transparent focus:border-emerald-500/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 outline-none mb-4 resize-none"
                />
                <button
                  disabled={saving || !decisionSummary.trim()}
                  onClick={handleSaveDecision}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Save Decision
                </button>
              </div>
            ) : mode === "task" ? (
              <div>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-transparent focus:border-emerald-500/50 px-3 text-sm text-zinc-900 dark:text-zinc-200 outline-none mb-3"
                />
                <p className="text-xs text-zinc-500 mb-1.5">Assign to</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {assignees.map((a) => (
                    <button
                      key={a.uid}
                      onClick={() => setTaskAssignee(a.uid)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        taskAssignee === a.uid
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
                  className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-transparent focus:border-emerald-500/50 px-3 text-sm text-zinc-900 dark:text-zinc-200 outline-none mb-4"
                />
                <button
                  disabled={saving || !taskTitle.trim() || !taskAssignee}
                  onClick={handleCreateTask}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-zinc-500 mb-4 italic">&quot;{message.text}&quot;</p>
                <input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-transparent focus:border-emerald-500/50 px-3 text-sm text-zinc-900 dark:text-zinc-200 outline-none mb-4"
                />
                <button
                  disabled={saving || !followUpAt}
                  onClick={handleSetFollowUp}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Set Follow-up
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
