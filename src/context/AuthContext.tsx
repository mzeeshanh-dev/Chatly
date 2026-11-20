"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS, type FirestoreUser } from "@/lib/firestore";
import { clearServerSession, createServerSession } from "@/lib/session";
import { requestFCMToken, setupForegroundMessaging } from "@/lib/fcm";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  profile: FirestoreUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Exchange the ID token for an httpOnly server session cookie (route guard).
        try {
          await createServerSession(await firebaseUser.getIdToken());
        } catch (error) {
          console.error("Session sync failed:", error);
        }

        // Always request FCM token on login — requestFCMToken handles permission internally
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "denied") {
          requestFCMToken(firebaseUser.uid);
        }
        setupForegroundMessaging();
      } else {
        void clearServerSession();
        setProfile(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  // Sync Firestore profile in real-time whenever user changes
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, COLLECTIONS.USERS, user.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      const nextProfile = snap.exists() ? (snap.data() as FirestoreUser) : null;
      if (nextProfile?.isSuspended) {
        void clearServerSession();
        signOut(auth).finally(() => {
          window.location.href = "/login";
        });
        return;
      }
      setProfile(nextProfile);
      setLoading(false);
    });

    return unsubscribeProfile;
  }, [user]);

  // ─── Apply Theme ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profile?.settings?.theme) {
      const current = localStorage.getItem("theme");
      if (current !== profile.settings.theme) {
        localStorage.setItem("theme", profile.settings.theme);
        if (profile.settings.theme === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
        }
      }
    }
  }, [profile?.settings?.theme]);

  // ─── Presence Logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, COLLECTIONS.USERS, user.uid);

    const updateStatus = async (status: "online" | "offline") => {
      try {
        await updateDoc(userRef, {
          status,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        // Ignore errors during logout/cleanup
        console.warn("Presence update ignored during cleanup/error:", error);
      }
    };

    // Go online
    updateStatus("online");

    const handleFocus = () => updateStatus("online");
    const handleBlur = () => updateStatus("offline");
    const handleVisibilityChange = () => {
      updateStatus(document.visibilityState === "visible" ? "online" : "offline");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // We don't await here to avoid blocking unmount
      updateStatus("offline");
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // The cookie must exist before any navigation, otherwise the route guard
    // bounces the user straight back to /login.
    try {
      await createServerSession(await result.user.getIdToken());
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearServerSession();
    await signOut(auth);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
