"use client";

import React, { useState, useEffect, useRef } from "react";
import { authFetch, ensureOk } from "@/lib/api-client";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Lock,
  Palette,
  Camera,
  Trash,
  MapPin,
  Phone,
  EnvelopeSimple,
  FloppyDisk,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, updateUser } from "@/lib/firestore";
import { useTheme } from "@/components/ui/ThemeProvider";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

type Tab = "profile" | "account" | "appearance";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "account", label: "Account", Icon: Lock },
  { id: "appearance", label: "Appearance", Icon: Palette },
];

// ─── Fieldset input ───────────────────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  icon?: React.ElementType;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-[#161922] border border-zinc-200 dark:border-zinc-800/60 focus:border-emerald-500/50 dark:focus:border-emerald-500/30 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-zinc-500 dark:placeholder:text-zinc-700"
        />
      </div>
      {hint && <p className="text-[11px] text-zinc-600 ml-1">{hint}</p>}
    </div>
  );
}

// ─── Appearance options ───────────────────────────────────────────────────────
const THEME_OPTIONS: { id: string; label: string; preview: string }[] = [
  { id: "dark", label: "Dark", preview: "bg-zinc-900 border-zinc-700" },
  { id: "light", label: "Light", preview: "bg-zinc-100 border-zinc-300" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const SettingsPanel = () => {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [form, setForm] = useState({
    displayName: profile?.displayName ?? "",
    phone: profile?.phone ?? "",
    location: profile?.location ?? "",
    bio: profile?.bio ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const [blockedProfiles, setBlockedProfiles] = useState<{ uid: string, name: string }[]>([]);

  useEffect(() => {
    if (!profile?.blockedUsers?.length) {
      setTimeout(() => setBlockedProfiles([]), 0);
      return;
    }
    const fetchBlocked = async () => {
      const names = await Promise.all(
        profile.blockedUsers!.map(async (id) => {
          const snap = await getDoc(doc(db, COLLECTIONS.USERS, id));
          return { uid: id, name: snap.exists() ? snap.data().displayName : "Unknown User" };
        })
      );
      setBlockedProfiles(names);
    };
    fetchBlocked();
  }, [profile?.blockedUsers]);

  const handleUnblock = async (uidToUnblock: string) => {
    if (!user) return;
    const newBlocked = (profile?.blockedUsers || []).filter(id => id !== uidToUnblock);
    await updateUser(user.uid, { blockedUsers: newBlocked });
  };

  const handleThemeChange = async (newTheme: "dark" | "light") => {
    if (!user) return;
    setTheme(newTheme);
    await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { "settings.theme": newTheme });
  };



  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUser(user.uid, {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("id", user.uid);
      fd.append("type", "profile");
      const res = await authFetch(user, "/api/upload", { method: "POST", body: fd });
      await ensureOk(res, "Upload failed");
      const { url, publicId } = await res.json();
      await updateUser(user.uid, { photoURL: url, photoPublicId: publicId });
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAvatarRemove = async () => {
    if (!user || !profile?.photoURL) return;

    const confirmed = window.confirm("Remove your profile image? This will delete it from Cloudinary and clear it from your profile.");
    if (!confirmed) return;

    setRemoveLoading(true);
    try {
      const publicIds = profile.photoPublicId
        ? [profile.photoPublicId]
        : [`Chatly/profiles/${user.uid}`, `chatly/profiles/${user.uid}`];

      const res = await authFetch(user, "/api/upload/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds }),
      });

      await ensureOk(res, "Remove failed");

      await updateUser(user.uid, { photoURL: null, photoPublicId: null });
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0e1015]">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your profile and preferences.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800/40 shadow-sm dark:shadow-none">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="relative flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              {activeTab === id && (
                <motion.div
                  layoutId="settings-tab-pill"
                  className="absolute inset-0 bg-zinc-800 border border-zinc-700/30 rounded-lg"
                  transition={spring}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${activeTab === id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                <Icon size={14} weight={activeTab === id ? "fill" : "regular"} />
                <span className="hidden sm:inline">{label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800/40 rounded-2xl p-6 shadow-sm dark:shadow-none">
          <AnimatePresence mode="wait">
            {/* ─── Profile Tab ── */}
            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="space-y-6"
              >
                {/* Avatar */}
                <div className="flex items-center gap-5">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700/40">
                      {profile?.photoURL ? (
                        <Image src={profile.photoURL} alt={profile.displayName} width={80} height={80} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-400 text-2xl font-semibold">
                          {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                    </div>
                    <motion.button
                      onClick={() => fileInputRef.current?.click()}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      disabled={uploadLoading || removeLoading}
                      transition={spring}
                      aria-label="Change profile image"
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white shadow-lg disabled:opacity-60 transition-colors"
                    >
                      <Camera size={14} weight="fill" />
                    </motion.button>
                    {profile?.photoURL && (
                      <motion.button
                        onClick={handleAvatarRemove}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.92 }}
                        disabled={uploadLoading || removeLoading}
                        transition={spring}
                        aria-label="Remove profile image"
                        className="absolute -bottom-1.5 -left-1.5 p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white shadow-lg disabled:opacity-60 transition-colors"
                      >
                        <Trash size={14} weight="fill" />
                      </motion.button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{profile?.displayName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{profile?.email}</p>
                    {uploadLoading && <p className="text-xs text-emerald-400 mt-1">Uploading...</p>}
                    {removeLoading && <p className="text-xs text-red-400 mt-1">Removing...</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Display Name" icon={User} value={form.displayName} onChange={set("displayName")} />
                  <Field label="Phone" icon={Phone} value={form.phone} onChange={set("phone")} />
                  <Field label="Location" icon={MapPin} value={form.location} onChange={set("location")} />
                  <Field label="Bio" value={form.bio} onChange={set("bio")} />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {saveSuccess && <p className="text-xs text-emerald-400">Changes saved!</p>}
                  <div className="ml-auto">
                    <motion.button
                      onClick={handleSave}
                      disabled={saving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/10 disabled:opacity-60 transition-colors"
                    >
                      <FloppyDisk size={16} weight="fill" />
                      {saving ? "Saving..." : "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Account Tab ── */}
            {activeTab === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="space-y-4"
              >
                <Field
                  label="Email Address"
                  icon={EnvelopeSimple}
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  hint="Email address cannot be changed. Contact support if needed."
                />
                <div className="pt-4 border-t border-zinc-800/40">
                  <p className="text-sm font-medium text-zinc-600 mb-3">Change Password</p>
                  <p className="text-xs text-zinc-500">
                    Use the <span className="text-zinc-600">Forgot password?</span> flow on the login page to reset your password via email verification.
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800/40">
                  <p className="text-sm font-medium text-red-400 mb-3">Blocked Users</p>
                  {blockedProfiles.length === 0 ? (
                    <p className="text-xs text-zinc-500">You have not blocked any users.</p>
                  ) : (
                    <div className="space-y-2">
                      {blockedProfiles.map(b => (
                        <div key={b.uid} className="flex items-center justify-between py-2 border-b border-zinc-800/30 last:border-0">
                          <p className="text-sm text-zinc-300">{b.name}</p>
                          <button onClick={() => handleUnblock(b.uid)} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── Appearance Tab ── */}
            {activeTab === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="space-y-5"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-600 mb-4">Theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    {THEME_OPTIONS.map((opt) => {
                      const isSelected = profile?.settings?.theme ? profile.settings.theme === opt.id : theme === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          onClick={() => handleThemeChange(opt.id as "dark" | "light")}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          transition={spring}
                          className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors ${theme === opt.id
                            ? "border-emerald-500/60 bg-emerald-500/5"
                            : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60"
                            }`}
                        >
                          <div className={`w-full h-10 rounded-lg border ${opt.preview}`} />
                          <span className="text-xs font-medium text-zinc-600">{opt.label}</span>
                          {isSelected && (
                            <motion.div
                              layoutId="theme-check"
                              className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                              transition={spring}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}


          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
