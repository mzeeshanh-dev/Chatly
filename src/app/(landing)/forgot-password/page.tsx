"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  EnvelopeSimple,
  ShieldCheck,
  TagChevron,
  Lock,
} from "@phosphor-icons/react";
import clsx from "clsx";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

function Alert({ message, type }: { message: string; type?: "error" | "success" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      className={clsx(
        "px-4 py-3 rounded-xl text-sm font-medium border",
        type === "success"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-red-500/10 border-red-500/20 text-red-400"
      )}
    >
      {message}
    </motion.div>
  );
}

function OTPInputs({ onChange }: { onChange: (v: string) => void }) {
  const [values, setValues] = useState(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = [...values];
    next[i] = char;
    setValues(next);
    onChange(next.join(""));
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !values[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-14 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 rounded-xl text-center text-xl font-semibold text-zinc-100 outline-none transition-all duration-200"
        />
      ))}
    </div>
  );
}

const ForgotPasswordPage = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; type?: "error" | "success" } | null>(null);
  const router = useRouter();

  const showAlert = (msg: string, type?: "error" | "success") => setAlert({ msg, type });

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!email) return showAlert("Please enter your email.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(2);
      showAlert("Reset code sent to your email.", "success");
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  // The code is verified server-side together with the new password, so the
  // reset cannot be completed by skipping a client-side step.
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (otp.length < 6) return showAlert("Enter the full 6-digit code.");
    setStep(3);
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (newPassword.length < 8) return showAlert("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A bad code means the user has to re-enter it.
        if (res.status === 422) setStep(2);
        throw new Error(data.error ?? "Failed to reset password.");
      }
      showAlert("Password updated. Redirecting to sign in...", "success");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] py-24 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center space-x-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-semibold text-xl">C</span>
            </div>
            <span className="text-2xl font-semibold tracking-tight font-inter">Chatly</span>
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Reset Password</h1>
          <p className="text-muted-foreground text-sm">We&apos;ll help you back in securely.</p>
        </div>

        <div className="bg-[#11131a]/80 backdrop-blur-xl border border-zinc-800/40 p-8 rounded-3xl shadow-2xl">
          <AnimatePresence mode="wait">
            {/* Step 1 — Email */}
            {step === 1 && (
              <motion.form
                key="email"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={spring}
                className="space-y-5"
                onSubmit={handleSendCode}
              >
                <AnimatePresence>{alert && <Alert message={alert.msg} type={alert.type} />}</AnimatePresence>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Email Address</label>
                  <div className="relative">
                    <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading || !email}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                  <ArrowRight size={18} />
                </motion.button>
                <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors pt-1">
                  <TagChevron size={16} /> Back to Login
                </Link>
              </motion.form>
            )}

            {/* Step 2 — OTP */}
            {step === 2 && (
              <motion.form
                key="otp"
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={spring}
                className="space-y-6"
                onSubmit={handleVerifyCode}
              >
                <AnimatePresence>{alert && <Alert message={alert.msg} type={alert.type} />}</AnimatePresence>
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={28} className="text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">Check your inbox</h2>
                  <p className="text-sm text-zinc-500 mt-1">Code sent to <span className="text-zinc-300">{email}</span></p>
                </div>
                <OTPInputs onChange={setOtp} />
                <motion.button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                  <ShieldCheck size={18} />
                </motion.button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  Resend code or change email
                </button>
              </motion.form>
            )}

            {/* Step 3 — New Password (Firebase sends reset link) */}
            {step === 3 && (
              <motion.form
                key="newpass"
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={spring}
                className="space-y-6"
                onSubmit={handleNewPassword}
              >
                <AnimatePresence>{alert && <Alert message={alert.msg} type={alert.type} />}</AnimatePresence>
                <div className="text-center">
                  <h2 className="text-lg font-semibold tracking-tight">Set new password</h2>
                  <p className="text-sm text-zinc-500 mt-1">Identity verified. Almost there.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                  <ArrowRight size={18} />
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
