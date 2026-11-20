"use client";

import { UserCircle } from "@phosphor-icons/react";

export interface GuestAccount {
  email: string;
  password: string;
}

/** Public demo accounts so reviewers can explore the app without registering. */
export const GUEST_ACCOUNTS: GuestAccount[] = [
  { email: "guest_user@gmail.com", password: "12345678" },
  { email: "guest_user1@gmail.com", password: "12345678" },
  { email: "guest_user2@gmail.com", password: "12345678" },
];

interface GuestAccountsProps {
  selectedEmail: string;
  disabled?: boolean;
  onSelect: (account: GuestAccount) => void;
}

export default function GuestAccounts({ selectedEmail, disabled, onSelect }: GuestAccountsProps) {
  return (
    <div className="mb-6 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
      <p className="text-xs text-zinc-400 mb-3 uppercase tracking-wider font-semibold text-center">
        Guest Accounts
      </p>
      <div className="flex flex-col gap-2" role="group" aria-label="Demo guest accounts">
        {GUEST_ACCOUNTS.map((guest) => {
          const active = guest.email === selectedEmail;
          return (
            <button
              key={guest.email}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onSelect(guest)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60 ${
                active
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : "bg-zinc-900/50 border-zinc-700/30 hover:border-emerald-500/30 hover:bg-zinc-800/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <UserCircle size={22} className={active ? "text-emerald-400" : "text-zinc-500"} aria-hidden />
                <span className="flex flex-col">
                  <span className={`text-sm transition-colors ${active ? "text-emerald-400" : "text-zinc-300 group-hover:text-emerald-400"}`}>
                    {guest.email}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">PWD: {guest.password}</span>
                </span>
              </span>
              <span className="text-xs text-zinc-500 whitespace-nowrap ml-4">
                {active ? "Selected" : "Click to use"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
