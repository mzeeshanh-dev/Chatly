"use client";

import { motion } from "framer-motion";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

export default function AuthAlert({
  message,
  type = "error",
}: {
  message: string;
  type?: "error" | "success";
}) {
  const tone =
    type === "success"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      : "bg-red-500/10 border-red-500/20 text-red-400";
  return (
    <motion.div
      role={type === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      className={`px-4 py-3 rounded-xl text-sm font-medium border ${tone}`}
    >
      {message}
    </motion.div>
  );
}
