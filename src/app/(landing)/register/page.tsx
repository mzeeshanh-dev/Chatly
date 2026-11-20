"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  EnvelopeSimple,
  Lock,
  User,
  ShieldCheck,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createServerSession } from "@/lib/session";
import clsx from "clsx";

// ─── Spring config ─────────────────────────────────────────────────────────────
const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

// ─── Inline alert component ───────────────────────────────────────────────────
function Alert({ message, type }: { message: string; type: "error" | "success" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={spring}
      className={clsx(
        "px-4 py-3 rounded-xl text-sm font-medium border",
        type === "error"
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      )}
    >
      {message}
    </motion.div>
  );
}

// ─── OTP input grid ────────────────────────────────────────────────────────────
function OTPInputs({ onChange }: { onChange: (val: string) => void }) {
  const [values, setValues] = useState(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = [...values];
    next[index] = char;
    setValues(next);
    onChange(next.join(""));
    if (char && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
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

// ─── Page ─────────────────────────────────────────────────────────────────────
const RegisterPage = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const showAlert = (msg: string, type: "error" | "success" = "error") => setAlert({ msg, type });
  const clearAlert = () => setAlert(null);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlert();
    if (!form.displayName || !form.email || !form.password) {
      return showAlert("Please fill in all fields.");
    }
    if (form.password.length < 8) {
      return showAlert("Password must be at least 8 characters.");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep(2);
      showAlert("Verification code sent to your email.", "success");
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlert();
    if (otp.length < 6) return showAlert("Please enter the full 6-digit code.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Account created successfully -> Sign in, set session cookie, then trigger redirect
      const credential = await signInWithEmailAndPassword(auth, form.email, form.password);
      await createServerSession(await credential.user.getIdToken());

      // Hard navigation so the router cache cannot replay the earlier signed-out redirect.
      window.location.replace("/chat");
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Verification failed.");
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
        {/* Brand */}
        <div className="text-center mb-10">

          <h1 className="text-3xl font-semibold tracking-tight mb-2">Create Account</h1>
          <p className="text-muted-foreground text-sm">Join the zero-trust messaging ecosystem.</p>
        </div>

        {/* Card */}
        <div className="bg-[#11131a]/80 backdrop-blur-xl border border-zinc-800/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <AnimatePresence>{alert && <Alert key="alert" message={alert.msg} type={alert.type} />}</AnimatePresence>

            {step === 1 ? (
              <motion.form
                key="signup"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={spring}
                className="space-y-5 mt-4"
                onSubmit={handleSendOTP}
              >
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={form.displayName}
                      onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Email Address</label>
                  <div className="relative">
                    <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="w-full pl-11 pr-12 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.01 } : {}}
                  whileTap={!loading ? { scale: 0.97 } : {}}
                  transition={spring}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={spring}
                className="space-y-6 mt-4"
                onSubmit={handleVerifyOTP}
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={28} className="text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">Verify your identity</h2>
                  <p className="text-sm text-zinc-500 mt-1">Code sent to <span className="text-zinc-300">{form.email}</span></p>
                </div>

                <OTPInputs onChange={setOtp} />

                <motion.button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  whileHover={!loading && otp.length === 6 ? { scale: 1.01 } : {}}
                  whileTap={!loading && otp.length === 6 ? { scale: 0.97 } : {}}
                  transition={spring}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Activate</span>
                      <ShieldCheck size={18} />
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={() => { setStep(1); clearAlert(); }}
                  className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  ← Change email or go back
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-emerald-500 hover:text-emerald-400 transition-colors">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;