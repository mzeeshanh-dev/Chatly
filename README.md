# Chatly

Real-time messaging built on Next.js and Firebase, deployed serverless on Vercel.
Direct chats with a message-request handshake, groups, media and voice notes, message tagging (questions, tasks, decisions), push notifications, and an admin portal.

**Live:** https://chatly-stream.vercel.app/

<img width="480" height="270" alt="Chatly preview" src="https://github.com/user-attachments/assets/ce3fba55-3fb4-4550-b3f0-d3cc90520dbd" />

## Features

- **Messaging:** one-to-one chats and groups, typing indicators, read state, presence, forwarding, selective delete (for me / for everyone), 3-minute edit window.
- **Request handshake:** the first message to a stranger becomes a request the recipient must accept or decline.
- **Media:** images, files (10 MB cap) and voice notes via Cloudinary.
- **Message tagging:** mark a message as a Question, Task (with assignees) or Decision, with a tracked-items panel and an unread digest banner.
- **Push notifications:** Firebase Cloud Messaging, honouring per-user opt-out.
- **Accounts:** email OTP registration, OTP password reset, public guest demo accounts on `/login`.
- **Admin portal:** user management and Vercel Analytics overview at `/admin`.
- **Light and dark themes**, responsive layout with a mobile tab bar.

## Architecture

```
Browser (Next.js client)
  |-- Firebase Auth ------------------------> identity
  |-- Firestore (real-time listeners) ------> chats, groups, messages, profiles
  |-- /api/* (Vercel serverless functions)
        |-- firebase-admin ------------------> verify tokens, privileged reads/writes
        |-- Cloudinary ----------------------> avatar and chat-media uploads
        |-- SMTP (nodemailer) ---------------> OTP and request emails
        |-- FCM -----------------------------> push notifications
```

Chat traffic does not pass through the serverless layer: messages are written to and streamed from Firestore directly by the client, so there is no server-side connection or in-memory state to lose between invocations. API routes exist only for operations that need a privileged credential (uploads, email, push, admin, OTP, session).

### Authentication flow

1. The client signs in with Firebase Auth (email and password).
2. It posts the ID token to `POST /api/auth/session`, which verifies it, rejects suspended users and sets an **httpOnly, SameSite=Lax, Secure** session cookie (`chatly_session`, 5 days).
3. `middleware.ts` uses that cookie as a route guard: anonymous requests to `/chat` redirect to `/login?from=/chat`.
4. After login, the page performs a **full navigation** to the validated `from` target. A soft `router.push` can replay the Next.js router-cache entry of the earlier signed-out `/chat -> /login` redirect, which was the cause of the "stuck on login page" bug.
5. `from` is validated by `getSafeRedirectPath` (same-origin, allow-listed `/chat` paths only; no external URLs, `//host`, backslashes or control characters).
6. If the cookie exists but Firebase has no user (expired or revoked), `/chat` clears the cookie and returns to `/login`.

The cookie is a coarse guard. Real authorization happens in each API route (Bearer ID token verified with `verifyIdToken(token, true)`, which also checks revocation) and in Firestore security rules.

### Registration and password reset

OTP handling is entirely server-side (`src/lib/server/otp.ts`): codes come from `crypto.randomInt`, only a salted SHA-256 hash is stored, codes expire after 10 minutes, allow 5 attempts and are single use. The Firebase account is created **disabled** and enabled only after the code is verified. Password reset verifies the code and updates the password in one server call, then revokes existing sessions. The forgot-password endpoint responds identically whether or not the account exists.

## Security measures

| Area | Implementation |
| --- | --- |
| AuthN/AuthZ | Bearer ID token on every non-public API route; conversation membership checked before notify and media upload; avatar upload and delete restricted to the owner (or group admin) with a strict public-id allow-list |
| Open redirect | `from` parameter allow-listed and normalised (`src/lib/safe-redirect.ts`, unit tested) |
| Sessions | httpOnly Secure cookie issued by the server; admin sessions are 8-hour session cookies verified with `verifySessionCookie` and `SameSite=Strict` |
| Abuse | Firestore-backed fixed-window rate limits (shared across serverless instances) on registration, OTP, reset, admin login, uploads and email/push |
| Email relay | Request and rejection emails only go to people the caller already has a DM with; sender name is read server-side; user-supplied names are HTML-escaped and stripped of control characters |
| Input handling | Central validators, JSON body size limits, upload size and MIME checks, sanitised Cloudinary file extensions |
| Headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `no-store` on API and authenticated pages |
| Errors | `handleApiError` returns generic messages for unexpected failures and logs details server-side |
| Admin | API routes return 401/403 (no redirects), admin accounts cannot be suspended or deleted via the API, device push tokens are never sent to the admin UI |
| Indexing | `/chat`, `/admin` and auth pages are `noindex` and disallowed in `robots.txt` |

### Known limitations

- **Firestore security rules are not versioned in this repository.** Because the client talks to Firestore directly, rules are the main data-isolation control. Review them in the Firebase console; the `otps` and `rateLimits` collections should deny all client access (the admin SDK bypasses rules).
- **Guest accounts are shared**: anyone using a demo account sees the same data. They exist for evaluation only.
- Rate limiting fails open if Firestore is unavailable. Add a Firestore TTL policy on `rateLimits.expiresAt` to clean up old windows.
- The middleware only checks that a session cookie exists; it does not cryptographically verify it at the edge.

## Project structure

```
src/
  app/                 routes: landing, auth pages, /chat, /admin, /api/*
  components/
    auth/              GuestAccounts, AuthAlert
    chat/              ChatWindow, ChatList, MessageItem, modals/ (edit, forward, clear)
    admin/  landing/  ui/
  context/AuthContext  Firebase auth state, presence, server session sync
  hooks/               useVoiceRecorder
  lib/
    server/            http (validation, errors), auth, rate-limit, otp, uploads, email-guard
    api-client.ts      authFetch for Bearer-authenticated calls
    safe-redirect.ts  session.ts  firebase*.ts  cloudinary.ts  nodemailer.ts
  middleware.ts        route guard
tests/                 vitest unit tests
```

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest: redirect validation, validators, upload id parsing, route guard
npm run build
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build on every push and pull request.

Automated tests cover pure logic and the middleware. API authorization was additionally verified manually against a running production build (unauthenticated requests rejected, cross-user avatar overwrite and delete rejected, non-member notify rejected, arbitrary email relay rejected). There is no automated browser end-to-end suite yet.

## Environment variables

Copy `.env.example` values into `.env` locally and into the Vercel project settings. Never commit real values.

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
# Admin analytics (optional)
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
```

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deployment

Deploy to Vercel with the variables above. Admin users are Firebase users with a `role: "admin"` document in the `admins` collection (or the `admin` custom claim).

## Android app

The separate React Native app shares this Firebase project and calls `/api/upload/chat-media`, `/api/notify`, `/api/notify/request` and `/api/notify/rejection` with a Bearer ID token. `/api/notify` now requires `chatId` and `collectionName` and verifies that sender and recipient both belong to that conversation; the request and rejection emails read the sender name server-side.
