export type PresenceDotColor = "green" | "red" | "yellow";

/**
 * DM presence dot color — mirrors the same rule on the mobile app
 * (mobile/src/components/Avatar.tsx: getPresenceDotColor). Pending always
 * shows yellow regardless of online status; once active, the dot only
 * appears while the other user is online, red taking priority over green
 * when either side has blocked the other.
 */
export function getPresenceDotColor({
  status,
  isBlocked,
  isOnline,
}: {
  status: "pending" | "active" | "rejected";
  isBlocked: boolean;
  isOnline: boolean;
}): PresenceDotColor | null {
  if (status === "pending") return "yellow";
  if (status !== "active" || !isOnline) return null;
  return isBlocked ? "red" : "green";
}
