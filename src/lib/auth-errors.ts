/** Maps Firebase Auth error codes to messages that are safe and helpful to show. */
export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-email":
      return "Invalid email or password.";
    case "auth/user-disabled":
      return "This account has been suspended.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error && !code ? error.message : "Sign in failed. Please try again.";
  }
}
