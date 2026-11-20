"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, EnvelopeSimple, Lock, Eye, EyeSlash } from "@phosphor-icons/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import GuestAccounts, { type GuestAccount } from "@/components/auth/GuestAccounts";
import AuthAlert from "@/components/auth/AuthAlert";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { createServerSession } from "@/lib/session";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

const LoginContent = () => {
  const searchParams = useSearchParams();
  const { login, user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const redirecting = useRef(false);

  // Only same-origin, allow-listed paths are honoured (prevents open redirects).
  const destination = getSafeRedirectPath(searchParams.get("from"));

  /**
   * A full navigation (not router.push) is deliberate: the App Router caches
   * the redirect response it received for /chat while signed out
   * (/chat -> /login?from=/chat). A soft navigation can replay that cached
   * redirect and leave the user on the login page even though the session
   * cookie now exists. A document load always hits the server with the cookie.
   */
  const goToDestination = () => {
    if (redirecting.current) return;
    redirecting.current = true;
    window.location.replace(destination);
  };

  // Already signed in (e.g. opened /login in a new tab): skip the form.
  useEffect(() => {
    if (authLoading || !user) return;
    // Make sure the server cookie exists before navigating, or the route guard
    // would bounce the user back here.
    user
      .getIdToken()
      .then(createServerSession)
      .then(goToDestination)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const handleGuestSelect = (guest: GuestAccount) => {
    setError(null);
    setForm({ email: guest.email, password: guest.password });
    submitRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      goToDestination();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSubmitting(false);
    }
  };

  const busy = submitting || (!authLoading && Boolean(user));

  return (
    <div className="min-h-[100dvh] py-24 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-md"
      >
        <div className="bg-[#11131a]/80 backdrop-blur-xl border border-zinc-800/40 p-8 rounded-3xl shadow-2xl">
          <h1 className="sr-only">Sign in to Chatly</h1>
          <GuestAccounts selectedEmail={form.email} disabled={busy} onSelect={handleGuestSelect} />

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <AnimatePresence>{error && <AuthAlert key="err" message={error} />}</AnimatePresence>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} aria-hidden />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} aria-hidden />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full pl-11 pr-12 py-3.5 bg-[#1a1d28] border border-zinc-800/60 focus:border-emerald-500/40 focus:bg-[#1e2130] rounded-xl outline-none transition-all text-sm text-zinc-200 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                Forgot password?
              </Link>
            </div>

            <motion.button
              ref={submitRef}
              type="submit"
              disabled={busy || !form.email || !form.password}
              aria-busy={busy}
              whileHover={!busy ? { scale: 1.01 } : {}}
              whileTap={!busy ? { scale: 0.97 } : {}}
              transition={spring}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {busy ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Signing in" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} aria-hidden />
                </>
              )}
            </motion.button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-emerald-500 hover:text-emerald-400 transition-colors">
            Create Account
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

const LoginPage = () => (
  <AuthProvider>
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  </AuthProvider>
);

export default LoginPage;
